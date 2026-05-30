# Catalogue import — Dynamic new-product datasets

This folder bulk-loads the supplier's new-product CSV exports into the shop's
`products` table (plus `categories` and `product_categories` so the items show
up under the right browse filters).

```
data/imports/
├── csv/                     supplier exports (source of truth for a run)
│   ├── furniture.csv
│   ├── seating.csv
│   ├── soft-seating.csv
│   └── bundles.csv
├── import-catalogue.ts      the importer
├── package.json             marks this folder as an ES module (for `node`)
└── README.md                this file
```

## What it does

- **Idempotent.** Products are matched on **SKU** (`upsert ... onConflict sku`),
  so re-running the importer **updates** existing rows instead of creating
  duplicates. Re-run it whenever the supplier sends a fresh export.
- **Imports as `draft` + `new`.** Imported products are hidden from the public
  shop until an admin adds photos and hits **Publish** in `/admin/products`.
  These exports ship with no images, and the listing/detail pages lean on a
  hero image, so going straight to `live` would surface imageless products.
- **Loses nothing.** A curated set of columns is promoted to first-class DB
  fields (name, brand, price, weight, dimensions). **Every other column** is
  preserved verbatim in the `specifications` jsonb (snake-cased keys), so all
  the supplier data is retained for search, the admin UI, and future surfacing.
- **Builds the taxonomy.** Each row's `Category` becomes a `functional`
  category and its `Brand` a `brand` category; products are linked to both.

### Field mapping (per file)

| DB field          | Source                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `sku`             | `SKU`                                                              |
| `slug`            | `slugify(name)` + `-<sku>` (unique & stable per SKU)              |
| `name`            | `Product Name`                                                    |
| `description`     | `Marketing Text`                                                  |
| `brand`           | `Brand` (bundles have none)                                       |
| `price_pence`     | `Sale Price` if present, else `RRP`/`Price`, × 100               |
| `was_price_pence` | `RRP`/`Price` when it's higher than the sale price, else null     |
| `weight_kg`       | `Weight (kg)` / `Product Weight (kg)`                             |
| `dimensions`      | `Width`/`Depth`/`Height` (mm → cm); ranges kept raw in specs      |
| `condition`       | always `new`                                                      |
| `status`          | `draft` (override with `--status=live`)                           |
| `specifications`  | every non-promoted column + `product_features[]` (+ `components[]`for bundles) |
| `tags`            | `new`, category, brand, colour, material, range (+ `bundle`)      |

Bundles have no first-class schema support, so their up-to-three components are
stored as a structured `specifications.components` array.

## Running it

Needs **Node 22+** (uses native TypeScript type-stripping — no build step, no
extra dependency to run a dry run).

### 1. Dry run first (no DB, no writes)

```bash
node --experimental-strip-types data/imports/import-catalogue.ts --dry-run
```

Prints per-file counts, the categories it would create, and a sample mapped
product. Works on a fresh clone with nothing installed.

### 2. Real import

The write path uses `@supabase/supabase-js` (already a project dependency) with
the **service-role** key, so install deps and load your env first:

```bash
npm install
set -a; . ./.env.local; set +a      # exports NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY
node --experimental-strip-types data/imports/import-catalogue.ts            # sample: 25 rows/file
```

Then review the drafts in `/admin/products`, add images, and publish.

### Flags

| Flag                  | Effect                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `--dry-run`           | Parse + map + summarise. No writes. Safe.                         |
| `--limit=N`           | At most N rows per file. **Default 25** (sample-first).           |
| `--all`               | Import every row in every selected file (~13k furniture, etc.).   |
| `--file=a,b`          | Restrict to `furniture`, `seating`, `soft-seating`, `bundles`.    |
| `--status=draft\|live`| Status for imported rows. Default `draft`.                        |

Examples:

```bash
# Full furniture catalogue only
node --experimental-strip-types data/imports/import-catalogue.ts --file=furniture --all

# Everything, all four files
node --experimental-strip-types data/imports/import-catalogue.ts --all
```

## Notes / gotchas

- **Encoding.** Three of the four exports are Windows-1252 (Excel), not UTF-8.
  The importer auto-detects: strict UTF-8 first, Windows-1252 fallback, so `£`,
  `é`, `®`, `°` and non-breaking spaces come through correctly.
- **Row counts.** Marketing/feature cells contain embedded newlines, so the
  real row count is lower than the file's line count — the CSV parser handles
  multi-line quoted fields.
- **Prices** are read as whole-pound figures and stored as integer pence.
- **No images** are imported (the exports contain none). That's why everything
  lands as `draft`.
