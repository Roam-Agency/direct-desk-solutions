/**
 * Catalogue importer — Dynamic new-product datasets → Supabase `products`.
 *
 * Reads the supplier CSV exports in ./csv and upserts them into the shop's
 * `products` table (plus `categories` + `product_categories` for browse).
 * It is **idempotent**: products are matched on their SKU, so re-running it
 * updates existing rows in place rather than creating duplicates. Run it
 * again whenever the supplier sends a fresh export.
 *
 * Design decisions (agreed with the team):
 *   - Every imported product lands as `status = 'draft'` and `condition =
 *     'new'`. Draft keeps them out of the public shop until an admin has
 *     added photos and hit Publish — these exports ship with no images, and
 *     the listing/detail pages lean on a hero image.
 *   - The four files have very different column sets. Each has its own
 *     field map, but they all funnel into one `ProductInsert` shape. Every
 *     column that isn't promoted to a first-class DB field is preserved
 *     verbatim in the `specifications` jsonb, so nothing from the export is
 *     lost — it's all there for search, the admin, and future surfacing.
 *   - Bundles have no first-class schema support yet, so their component
 *     list is stored under `specifications.components`.
 *
 * Runs on Node 22+ with no build step or extra dependency — Node strips the
 * TypeScript types natively:
 *
 *     node --experimental-strip-types data/imports/import-catalogue.ts --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the
 * environment (load your .env.local first, e.g. `set -a; . ./.env.local; set +a`).
 *
 * Flags:
 *   --dry-run            Parse + map + print a summary. No writes. (Safe.)
 *   --limit=N            Import at most N rows per file. Default 25 (sample).
 *   --all                Import every row in every selected file.
 *   --file=a,b           Only these datasets: furniture, seating,
 *                        soft-seating, bundles. Default: all four.
 *   --status=draft|live  Status for imported rows. Default draft.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
// NOTE: `@supabase/supabase-js` is imported lazily inside the write path so a
// `--dry-run` works with no dependencies installed (handy in CI / fresh clones).

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_DIR = join(HERE, "csv");

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Minimal RFC-4180 CSV parser. Handles quoted fields, escaped quotes (""),
 * and embedded commas/newlines inside quotes — all of which appear in the
 * supplier marketing/feature columns (bundle features even span lines).
 */
function parseCsv(input: string): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += c;
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (c === "\r") {
      i += 1;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }
  // Flush the final field/row if the file didn't end on a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type CsvRow = Record<string, string>;

/**
 * Decode a file buffer to text, auto-detecting the encoding. These supplier
 * exports come out of Excel as Windows-1252 (so £, é, ®, ° and non-breaking
 * spaces are single high bytes that are NOT valid UTF-8) — but a future
 * export might be genuine UTF-8. Try strict UTF-8 first; on any invalid byte
 * fall back to Windows-1252. Pure-ASCII files decode identically either way.
 */
function decodeFile(path: string): string {
  const buf = readFileSync(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** Trim a cell, normalising non-breaking spaces (U+00A0) to plain spaces. */
function cleanCell(value: string): string {
  return value.replace(/\u00a0/g, " ").trim();
}

/** Parse a CSV file into header-keyed row objects. */
function readCsvRows(path: string): CsvRow[] {
  const grid = parseCsv(decodeFile(path));
  if (grid.length === 0) return [];
  const headers = grid[0].map((h) => cleanCell(h));
  const rows: CsvRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    // Skip fully blank lines (a stray trailing newline, etc.).
    if (cells.every((v) => v.trim() === "")) continue;
    const obj: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cleanCell(cells[c] ?? "");
    }
    rows.push(obj);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

/** URL-safe slug — mirrors src/lib/categories/schema.ts slugify(). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** snake_case a CSV header so it reads well as a jsonb key. */
function snakeKey(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Parse a £ amount (may include £, commas) to a number, or null. */
function parsePounds(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const toPence = (pounds: number): number => Math.round(pounds * 100);

/** Parse a plain numeric cell (weight etc.) to a number, or null. */
function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Supplier dimensions are in millimetres; the shop stores centimetres
 * (see products.dimensions sample in migration 0001). Convert mm→cm.
 * Ranges like "660-1150" (telescopic widths) can't be a single number, so
 * they return null here — the raw value is still kept in `specifications`.
 */
function mmCellToCm(raw: string | undefined): number | null {
  if (!raw || raw.includes("-")) return null;
  const mm = Number(raw);
  if (!Number.isFinite(mm) || mm <= 0) return null;
  return Math.round((mm / 10) * 10) / 10; // 1 decimal place
}

type Dimensions = {
  width_cm: number | null;
  depth_cm: number | null;
  height_cm: number | null;
};

function buildDimensions(row: CsvRow): Dimensions | null {
  const width_cm = mmCellToCm(row["Width"]);
  const depth_cm = mmCellToCm(row["Depth"]);
  const height_cm = mmCellToCm(row["Height"]);
  if (width_cm === null && depth_cm === null && height_cm === null) return null;
  return { width_cm, depth_cm, height_cm };
}

/**
 * The "Product Features" column packs several bullets into one cell,
 * separated by runs of whitespace (and sometimes newlines, in bundles).
 * Split them back into a clean array.
 */
function splitFeatures(raw: string | undefined): string[] {
  if (!raw) return [];
  // The supplier delimits bullets inconsistently: runs of 2+ spaces, real
  // newlines, and a stray control character (0x1A) standing in for a bullet
  // glyph. Normalise every run of control characters to a double-space, then
  // split on 2+ spaces and tidy each bullet.
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]+/g, "  ")
    .split(/ {2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Mapping CSV rows → ProductInsert
// ---------------------------------------------------------------------------

type ProductInsert = {
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  price_pence: number;
  was_price_pence: number | null;
  condition: "new";
  status: "draft" | "live";
  weight_kg: number | null;
  dimensions: Dimensions | null;
  specifications: Record<string, unknown>;
  tags: string[];
  published_at: string | null;
};

/** A mapped product plus the category names it should be linked to. */
type MappedRow = {
  product: ProductInsert;
  functionalCategory: string | null; // from the CSV "Category" column
  brandCategory: string | null; // from the CSV "Brand" column
};

type DatasetKey = "furniture" | "seating" | "soft-seating" | "bundles";

type DatasetConfig = {
  key: DatasetKey;
  file: string;
  // Columns promoted to first-class fields, so they're not duplicated into
  // the generic `specifications` dump below.
  promoted: string[];
  // Per-file pricing — each file labels the price columns differently.
  price: (row: CsvRow) => { price: number | null; was: number | null };
  // Per-file weight column name.
  weightKey: string;
  // Optional hook to enrich specifications (e.g. bundle components).
  enrich?: (row: CsvRow, specs: Record<string, unknown>) => void;
};

const DATASETS: DatasetConfig[] = [
  {
    key: "furniture",
    file: "furniture.csv",
    weightKey: "Weight (kg)",
    promoted: [
      "SKU",
      "Product Name",
      "Brand",
      "Marketing Text",
      "Product Features",
      "RRP",
      "Width",
      "Depth",
      "Height",
      "Weight (kg)",
      "Category",
    ],
    price: (row) => ({ price: parsePounds(row["RRP"]), was: null }),
  },
  {
    key: "seating",
    file: "seating.csv",
    weightKey: "Product Weight (kg)",
    promoted: [
      "SKU",
      "Product Name",
      "Brand",
      "Marketing Text",
      "Product Features",
      "Sale Price",
      "RRP",
      "Width",
      "Depth",
      "Height",
      "Product Weight (kg)",
      "Category",
    ],
    price: (row) => priceWithRrp(row["Sale Price"], row["RRP"]),
  },
  {
    key: "soft-seating",
    file: "soft-seating.csv",
    weightKey: "Product Weight (kg)",
    promoted: [
      "SKU",
      "Product Name",
      "Brand",
      "Marketing Text",
      "Product Features",
      "Sales Price",
      "RRP",
      "Width",
      "Depth",
      "Height",
      "Product Weight (kg)",
      "Category",
    ],
    price: (row) => priceWithRrp(row["Sales Price"], row["RRP"]),
  },
  {
    key: "bundles",
    file: "bundles.csv",
    weightKey: "__none__",
    // The per-component columns are promoted so they aren't dumped raw into
    // specifications — they're re-assembled into the `components` array below.
    promoted: [
      "SKU",
      "Product Name",
      "Marketing Text",
      "Product Features",
      "Price",
      "Sale Price",
      "Category",
      ...[1, 2, 3].flatMap((n) => [
        `Component ${n} Code`,
        `Component ${n} Qty`,
        `Component ${n} Name`,
        `Component ${n} Category`,
        `Component ${n} SubCategory`,
        `Component ${n} Features`,
      ]),
    ],
    price: (row) => priceWithRrp(row["Sale Price"], row["Price"]),
    enrich: (row, specs) => {
      const components: Record<string, unknown>[] = [];
      for (let n = 1; n <= 3; n++) {
        const code = row[`Component ${n} Code`];
        if (!code) continue;
        components.push({
          code,
          qty: parseNumber(row[`Component ${n} Qty`]) ?? row[`Component ${n} Qty`] ?? "",
          name: row[`Component ${n} Name`] ?? "",
          category: row[`Component ${n} Category`] ?? "",
          subcategory: row[`Component ${n} SubCategory`] ?? "",
          features: splitFeatures(row[`Component ${n} Features`]),
        });
      }
      if (components.length > 0) specs.components = components;
    },
  },
];

/** Shared sale-price-vs-RRP logic. price = sale if present else list. */
function priceWithRrp(
  saleRaw: string | undefined,
  listRaw: string | undefined
): { price: number | null; was: number | null } {
  const sale = parsePounds(saleRaw);
  const list = parsePounds(listRaw);
  if (sale !== null && sale > 0) {
    // Only show a strikethrough was-price when the list price is genuinely
    // higher than what we're charging.
    return { price: sale, was: list !== null && list > sale ? list : null };
  }
  return { price: list, was: null };
}

const STATUS: "draft" | "live" = parseStatus();

function mapRow(row: CsvRow, cfg: DatasetConfig): MappedRow | null {
  const sku = (row["SKU"] ?? "").trim();
  const name = (row["Product Name"] ?? "").trim();
  if (!sku || !name) return null; // malformed row — skip

  // Bundle component SKUs sometimes overlap with standalone products; that's
  // fine. We just need a stable, unique slug per SKU.
  const slugBase = slugify(name).slice(0, 80) || "product";
  const slug = `${slugBase}-${slugify(sku)}`;

  const { price, was } = cfg.price(row);
  const marketing = (row["Marketing Text"] ?? "").trim();

  // Build the specifications dump: every non-empty column that wasn't
  // promoted to a first-class field, snake-cased.
  const promoted = new Set(cfg.promoted);
  const specs: Record<string, unknown> = { _source_file: cfg.file };
  for (const [header, value] of Object.entries(row)) {
    if (promoted.has(header)) continue;
    const v = value.trim();
    if (v === "") continue;
    specs[snakeKey(header)] = v;
  }
  const features = splitFeatures(row["Product Features"]);
  if (features.length > 0) specs.product_features = features;

  // Preserve raw dimension cells that couldn't become a clean cm number
  // (e.g. telescopic "660-1150" widths) so the range isn't lost.
  for (const axis of ["Width", "Depth", "Height"] as const) {
    const v = (row[axis] ?? "").trim();
    if (v.includes("-")) specs[`${axis.toLowerCase()}_mm_raw`] = v;
  }

  if (cfg.enrich) cfg.enrich(row, specs);
  if (price === null) specs._price_missing = true;

  const brand = (row["Brand"] ?? "").trim() || null;
  const category = (row["Category"] ?? "").trim() || null;

  // Tags power the substring search — keep them lowercase + de-duped.
  const tagCandidates = [
    "new",
    category,
    brand,
    row["Colour"],
    row["Material"],
    row["Range"],
    cfg.key === "bundles" ? "bundle" : null,
  ];
  const tags = Array.from(
    new Set(
      tagCandidates
        .filter((t): t is string => !!t && t.trim() !== "")
        .map((t) => slugify(t))
        .filter((t) => t !== "")
    )
  );

  const product: ProductInsert = {
    sku,
    slug,
    name,
    description: marketing || null,
    brand,
    price_pence: price !== null ? toPence(price) : 0,
    was_price_pence: was !== null ? toPence(was) : null,
    condition: "new",
    status: STATUS,
    weight_kg: parseNumber(row[cfg.weightKey]),
    dimensions: buildDimensions(row),
    specifications: specs,
    tags,
    published_at: STATUS === "live" ? new Date().toISOString() : null,
  };

  return {
    product,
    functionalCategory: category,
    // Bundles have no Brand column, so don't try to make a brand category.
    brandCategory: cfg.key === "bundles" ? null : brand,
  };
}

// ---------------------------------------------------------------------------
// CLI args + env
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const hasFlag = (name: string): boolean =>
  process.argv.includes(`--${name}`);

function parseStatus(): "draft" | "live" {
  const s = arg("status");
  if (s === "live") return "live";
  if (s && s !== "draft") {
    console.warn(`Unknown --status=${s}; defaulting to draft.`);
  }
  return "draft";
}

function parseLimit(): number {
  if (hasFlag("all")) return Infinity;
  const fromArg = arg("limit");
  const fromEnv = process.env.IMPORT_LIMIT;
  const raw = fromArg ?? fromEnv;
  if (raw === undefined) return 25; // sample-first default
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 25;
  return n === 0 ? Infinity : n;
}

function selectedDatasets(): DatasetConfig[] {
  const only = arg("file");
  if (!only) return DATASETS;
  const keys = new Set(only.split(",").map((s) => s.trim()));
  const picked = DATASETS.filter((d) => keys.has(d.key));
  if (picked.length === 0) {
    console.error(
      `No datasets matched --file=${only}. Valid: ${DATASETS.map((d) => d.key).join(", ")}`
    );
    process.exit(1);
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = hasFlag("dry-run");
  const limit = parseLimit();
  const datasets = selectedDatasets();

  console.log("Catalogue import");
  console.log(`  mode:     ${dryRun ? "DRY RUN (no writes)" : "WRITE"}`);
  console.log(`  status:   ${STATUS}`);
  console.log(
    `  limit:    ${limit === Infinity ? "all rows" : `${limit} per file`}`
  );
  console.log(`  datasets: ${datasets.map((d) => d.key).join(", ")}`);
  console.log("");

  // Parse + map every selected file first, so a dry run is a complete
  // preview and so we can collect categories across all files before writing.
  const mapped: MappedRow[] = [];
  const skusSeen = new Set<string>();
  for (const cfg of datasets) {
    const path = join(CSV_DIR, cfg.file);
    const rows = readCsvRows(path);
    let taken = 0;
    let skipped = 0;
    for (const row of rows) {
      if (taken >= limit) break;
      const m = mapRow(row, cfg);
      if (!m) {
        skipped++;
        continue;
      }
      // De-dupe SKUs within this run — a repeated SKU would make the
      // upsert fight itself. First occurrence wins.
      if (skusSeen.has(m.product.sku)) {
        skipped++;
        continue;
      }
      skusSeen.add(m.product.sku);
      mapped.push(m);
      taken++;
    }
    console.log(
      `  ${cfg.key.padEnd(13)} parsed ${rows.length}, took ${taken}` +
        (skipped ? `, skipped ${skipped}` : "")
    );
  }
  console.log(`\n  ${mapped.length} products mapped total.`);

  // Collect the unique categories we'll need.
  const categories = new Map<
    string,
    { name: string; slug: string; kind: "functional" | "brand" }
  >();
  const addCategory = (name: string, kind: "functional" | "brand") => {
    const slug = slugify(name);
    if (slug) categories.set(slug, { name, slug, kind });
  };
  for (const m of mapped) {
    if (m.functionalCategory) addCategory(m.functionalCategory, "functional");
    if (m.brandCategory) addCategory(m.brandCategory, "brand");
  }
  console.log(`  ${categories.size} categories referenced.`);

  if (dryRun) {
    const sample = mapped[0];
    if (sample) {
      console.log("\n  Sample mapped product:");
      console.log(JSON.stringify(sample.product, null, 2));
    }
    console.log("\nDry run complete — nothing written.");
    return;
  }

  // ---- Writes -------------------------------------------------------------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      "\nMissing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in the environment."
    );
    console.error(
      "Load your .env.local first, e.g.:  set -a; . ./.env.local; set +a"
    );
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Upsert categories (conflict on slug) and map slug → id.
  const categoryRows = Array.from(categories.values());
  const categoryIdBySlug = new Map<string, string>();
  if (categoryRows.length > 0) {
    const { data, error } = await supabase
      .from("categories")
      .upsert(categoryRows, { onConflict: "slug" })
      .select("id, slug");
    if (error) {
      console.error("Category upsert failed:", error.message);
      process.exit(1);
    }
    for (const c of data ?? []) categoryIdBySlug.set(c.slug, c.id);
    console.log(`\n  Upserted ${data?.length ?? 0} categories.`);
  }

  // 2. Upsert products in batches (conflict on sku) and map sku → id.
  const productIdBySku = new Map<string, string>();
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < mapped.length; i += BATCH) {
    const batch = mapped.slice(i, i + BATCH).map((m) => m.product);
    const { data, error } = await supabase
      .from("products")
      .upsert(batch, { onConflict: "sku" })
      .select("id, sku");
    if (error) {
      console.error(`Product upsert failed (batch at ${i}):`, error.message);
      process.exit(1);
    }
    for (const p of data ?? []) productIdBySku.set(p.sku, p.id);
    written += data?.length ?? 0;
    console.log(`  Upserted products ${i + 1}–${i + batch.length}…`);
  }
  console.log(`  ${written} products upserted.`);

  // 3. Build + upsert the product↔category join rows.
  const joins: { product_id: string; category_id: string }[] = [];
  for (const m of mapped) {
    const productId = productIdBySku.get(m.product.sku);
    if (!productId) continue;
    const slugs = [
      m.functionalCategory ? slugify(m.functionalCategory) : null,
      m.brandCategory ? slugify(m.brandCategory) : null,
    ].filter((s): s is string => !!s);
    for (const slug of slugs) {
      const categoryId = categoryIdBySlug.get(slug);
      if (categoryId) joins.push({ product_id: productId, category_id: categoryId });
    }
  }
  if (joins.length > 0) {
    for (let i = 0; i < joins.length; i += BATCH) {
      const batch = joins.slice(i, i + BATCH);
      const { error } = await supabase
        .from("product_categories")
        .upsert(batch, {
          onConflict: "product_id,category_id",
          ignoreDuplicates: true,
        });
      if (error) {
        console.error(`Join upsert failed (batch at ${i}):`, error.message);
        process.exit(1);
      }
    }
    console.log(`  ${joins.length} product-category links upserted.`);
  }

  console.log("\nDone. Imported products are in DRAFT — add photos and");
  console.log("publish them from /admin/products when ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
