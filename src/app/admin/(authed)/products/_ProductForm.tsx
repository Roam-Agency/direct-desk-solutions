"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  deleteProduct,
} from "./_actions";
import type { ProductInput } from "@/lib/products/schema";
import { parseDisplayPriceToPence, formatPence } from "@/lib/products/format";
import { describeActionFailure } from "@/lib/admin/action-errors";
import { ImageUploader } from "./_ImageUploader";
import { ConditionReportSection } from "./_ConditionReportSection";
import { MarginCalculator } from "./_MarginCalculator";
import { CategoryPicker } from "./_CategoryPicker";
import { setProductCategories } from "../categories/_actions";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductImageRow =
  Database["public"]["Tables"]["product_images"]["Row"];
type ConditionReportRow =
  Database["public"]["Tables"]["condition_reports"]["Row"];
type ConditionReportItemRow =
  Database["public"]["Tables"]["condition_report_items"]["Row"];

interface ProductFormProps {
  /** Present = edit mode, absent = create mode. */
  initialProduct?: ProductRow;
  /** Already-attached images (edit mode only). Defaults to empty. */
  initialImages?: ProductImageRow[];
  /** All active categories (used to render the picker in edit mode). */
  allCategories?: Array<{
    id: string;
    name: string;
    slug: string;
    kind: Database["public"]["Enums"]["category_kind"];
  }>;
  /** Existing category assignments for this product (edit mode only). */
  initialCategoryIds?: string[];
  /** Existing condition report for this product (edit mode, used items only). May be null. */
  initialReport?: ConditionReportRow | null;
  /** Items belonging to the report. Empty if no report yet. */
  initialReportItems?: ConditionReportItemRow[];
}

/**
 * Shared form for creating and editing products.
 *
 * On submit, gathers form values into a ProductInput, calls the appropriate
 * Server Action, and either redirects on success or renders inline errors
 * on failure. The "Used item" fieldset is conditionally rendered based on
 * the condition radio; toggling clears used-only fields to keep data clean.
 *
 * In edit mode, an ImageUploader renders below the form fields, letting
 * admins drag-drop or pick files which upload directly to Cloudinary and
 * are persisted via the attachImage Server Action. In create mode the
 * Images section is hidden — you can't attach to a product without an ID.
 */
export default function ProductForm({
  initialProduct,
  initialImages = [],
  initialReport = null,
  initialReportItems = [],
  allCategories = [],
  initialCategoryIds = [],
}: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialProduct);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialCategoryIds);
  const [categoriesWarning, setCategoriesWarning] = useState<string | null>(
    null
  );

  // Track whether the visible bottom action row is in the viewport.
  // When it scrolls off, we render a fixed-position sticky save bar at
  // the bottom of the screen so the admin never loses sight of Save.
  // setState here is inside the IntersectionObserver callback (async),
  // not in the effect body itself, so react-hooks/set-state-in-effect
  // is satisfied.
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const [isBottomVisible, setIsBottomVisible] = useState(true);

  useEffect(() => {
    const node = bottomRowRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBottomVisible(entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Strip the £ symbol so the input shows "499.00" not "£499.00"
  const priceDisplay = (pence: number | null | undefined): string => {
    if (pence === null || pence === undefined) return "";
    return (pence / 100).toFixed(2);
  };

  // Convert pence to a £-stripped display value for date inputs etc
  const dateDisplay = (iso: string | null): string => {
    if (!iso) return "";
    return iso.slice(0, 10);
  };

  // Form state
  const [sku, setSku] = useState(initialProduct?.sku ?? "");
  const [slug, setSlug] = useState(initialProduct?.slug ?? "");
  const [name, setName] = useState(initialProduct?.name ?? "");
  const [description, setDescription] = useState(
    initialProduct?.description ?? ""
  );
  const [brand, setBrand] = useState(initialProduct?.brand ?? "");

  const [price, setPrice] = useState(priceDisplay(initialProduct?.price_pence));
  const [wasPrice, setWasPrice] = useState(
    priceDisplay(initialProduct?.was_price_pence)
  );
  const [costPrice, setCostPrice] = useState(
    priceDisplay(initialProduct?.cost_price_pence)
  );

  const [stockQty, setStockQty] = useState(
    initialProduct?.stock_quantity?.toString() ?? "0"
  );
  const [lowStock, setLowStock] = useState(
    initialProduct?.low_stock_alert?.toString() ?? ""
  );
  const [warehouseLocation, setWarehouseLocation] = useState(
    initialProduct?.warehouse_location ?? ""
  );

  const [status, setStatus] = useState<"draft" | "live" | "archived">(
    (initialProduct?.status as "draft" | "live" | "archived") ?? "draft"
  );

  const [weightKg, setWeightKg] = useState(
    initialProduct?.weight_kg?.toString() ?? ""
  );

  const initialDims =
    (initialProduct?.dimensions as {
      width_cm?: number | null;
      depth_cm?: number | null;
      height_cm?: number | null;
    } | null) ?? null;
  const [widthCm, setWidthCm] = useState(
    initialDims?.width_cm?.toString() ?? ""
  );
  const [depthCm, setDepthCm] = useState(
    initialDims?.depth_cm?.toString() ?? ""
  );
  const [heightCm, setHeightCm] = useState(
    initialDims?.height_cm?.toString() ?? ""
  );

  const [condition, setCondition] = useState<"new" | "used">(
    (initialProduct?.condition as "new" | "used") ?? "new"
  );
  const [conditionGrade, setConditionGrade] = useState<"A" | "B" | "C" | "">(
    (initialProduct?.condition_grade as "A" | "B" | "C" | null) ?? ""
  );
  const [conditionNotes, setConditionNotes] = useState(
    initialProduct?.condition_notes ?? ""
  );
  const [source, setSource] = useState(initialProduct?.source ?? "");
  const [refurbDate, setRefurbDate] = useState(
    dateDisplay(initialProduct?.refurb_date ?? null)
  );

  const [tags, setTags] = useState((initialProduct?.tags ?? []).join(", "));

  // Auto-slug from name when in create mode and slug is empty
  function handleNameChange(value: string) {
    setName(value);
    if (!isEdit && slug === "") {
      const auto = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(auto);
    }
  }

  // Clear used-only fields when switching to "new"
  function handleConditionChange(value: "new" | "used") {
    setCondition(value);
    if (value === "new") {
      setConditionGrade("");
      setConditionNotes("");
      setSource("");
      setRefurbDate("");
    }
  }

  /**
   * Track which fields the most recent Apply Draft action filled, so the
   * suggestion strip can show "Filled N fields" and the corresponding
   * field labels can flash briefly. Cleared automatically after 4s.
   */
  const [lastApplied, setLastApplied] = useState<{
    count: number;
    fields: ReadonlyArray<"name" | "brand" | "description" | "grade">;
    at: number;
  } | null>(null);

  useEffect(() => {
    if (!lastApplied) return;
    const timer = setTimeout(() => setLastApplied(null), 4000);
    return () => clearTimeout(timer);
  }, [lastApplied]);

  /**
   * Apply AI-drafted product details from the hero image's suggestion strip.
   *
   * Fill-blanks-only semantics — never overwrites a value the admin has
   * already typed. Carve-out: the name placeholder "Untitled draft" (case-
   * insensitive, allowing trailing whitespace) is treated as empty so the
   * draft can fill it.
   *
   * When a condition_grade is set and the product is currently new, infer
   * condition='used' (grade is meaningless on new items).
   *
   * Records the set of fields it actually filled in `lastApplied` so the
   * UI can surface visible feedback (strip footnote swap + label flash).
   */
  function handleApplyDraft(draft: {
    name: string | null;
    description: string | null;
    brand: string | null;
    condition_grade: "A" | "B" | "C" | null;
  }) {
    const filled: Array<"name" | "brand" | "description" | "grade"> = [];

    const trimmedName = name.trim();
    const isUntitledPlaceholder =
      trimmedName === "" || /^untitled\s+draft$/i.test(trimmedName);
    if (draft.name && isUntitledPlaceholder) {
      setName(draft.name);
      filled.push("name");
    }
    if (draft.description && description.trim() === "") {
      setDescription(draft.description);
      filled.push("description");
    }
    if (draft.brand && brand.trim() === "") {
      setBrand(draft.brand);
      filled.push("brand");
    }
    if (draft.condition_grade) {
      if (condition === "new") {
        setCondition("used");
      }
      if (conditionGrade === "") {
        setConditionGrade(draft.condition_grade);
        filled.push("grade");
      }
    }

    setLastApplied({ count: filled.length, fields: filled, at: Date.now() });
  }

  /**
   * Rebuild the slug from the current name, replacing a "draft-XXXXXX"
   * placeholder slug. Visible only when slug still starts with "draft-"
   * and name has moved away from "Untitled draft".
   */
  function handleRegenerateSlug() {
    const auto = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (auto.length >= 3) setSlug(auto);
  }

  function buildInput(): ProductInput {
    return {
      sku: sku.trim(),
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim() || null,
      brand: brand.trim() || null,
      price_pence: parseDisplayPriceToPence(price) ?? 0,
      was_price_pence: parseDisplayPriceToPence(wasPrice),
      cost_price_pence: parseDisplayPriceToPence(costPrice),
      stock_quantity: parseInt(stockQty, 10) || 0,
      low_stock_alert: lowStock === "" ? null : parseInt(lowStock, 10),
      warehouse_location: warehouseLocation.trim() || null,
      status,
      weight_kg: weightKg === "" ? null : Number(weightKg),
      dimensions:
        widthCm === "" && depthCm === "" && heightCm === ""
          ? null
          : {
              width_cm: widthCm === "" ? null : Number(widthCm),
              depth_cm: depthCm === "" ? null : Number(depthCm),
              height_cm: heightCm === "" ? null : Number(heightCm),
            },
      condition,
      condition_grade:
        condition === "used" && conditionGrade !== "" ? conditionGrade : null,
      condition_notes: conditionNotes.trim() || null,
      source: source.trim() || null,
      refurb_date: refurbDate || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      specifications: null,
    };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const input = buildInput();

    startTransition(async () => {
      // The try/catch is load-bearing: if the action *invocation* throws
      // (stale action ID after a deploy, dropped connection), an uncaught
      // rejection here escalates to the route's error boundary and replaces
      // the whole form — losing everything the admin typed. Catch it and
      // surface an inline, recoverable message instead.
      try {
        const result = initialProduct
          ? await updateProduct(initialProduct.id, input)
          : await createProduct(input);

        if (result.ok) {
          // Edit mode: persist category assignments alongside the product save.
          // Create mode redirects to the edit page, so categories get assigned
          // on the next save (same pattern as images).
          if (isEdit && initialProduct) {
            const catResult = await setProductCategories(
              initialProduct.id,
              selectedCategoryIds
            );
            if (!catResult.ok && catResult.formError) {
              // Product itself saved fine; surface a non-fatal warning.
              setCategoriesWarning(
                `Product saved, but categories failed: ${catResult.formError}`
              );
              router.refresh();
              return;
            }
          }

          if (!isEdit && result.id) {
            router.push(`/admin/products/${result.id}`);
          } else {
            router.refresh();
          }
          return;
        }

        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.formError) setFormError(result.formError);
      } catch (err) {
        setFormError(describeActionFailure(err));
      }
    });
  }

  async function handleArchive() {
    if (!initialProduct) return;
    if (!confirm("Archive this product? It will be hidden from the customer site.")) return;
    startTransition(async () => {
      try {
        const result = await archiveProduct(initialProduct.id);
        if (!result.ok && result.formError) {
          setFormError(result.formError);
        } else {
          router.push("/admin/products");
        }
      } catch (err) {
        setFormError(describeActionFailure(err));
      }
    });
  }

  async function handleDelete() {
    if (!initialProduct) return;
    if (!confirm("Permanently delete this draft product? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteProduct(initialProduct.id);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  const canHardDelete =
    isEdit &&
    initialProduct?.status === "draft" &&
    !initialProduct?.published_at;

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {formError && (
        <div className="border-l-2 border-brand-red bg-paper px-4 py-3 text-sm text-ink">
          {formError}
        </div>
      )}

      {isEdit && name === "Untitled draft" && (
        <div className="border-l-2 border-ink bg-paper px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink">
            Draft created
          </p>
          <p className="mt-1 text-sm text-ink/70">
            Drop a photo into the Photos section below to have AI draft the name, brand, and description — or fill the form manually. This nudge disappears once you change the name.
          </p>
        </div>
      )}

      {isEdit && initialProduct && (
        <Section
          title="Photos"
          subtitle="Drag-drop, browse, or send to phone. Drag to reorder, hover for delete and hero controls. AI drafts product details from the hero image."
        >
          <ImageUploader
            productId={initialProduct.id}
            productName={initialProduct.name}
            initialImages={initialImages}
            categories={allCategories}
            onApplyDraft={handleApplyDraft}
            lastApplied={lastApplied}
          />
        </Section>
      )}

      <Section
        title="Drafted from photo"
        subtitle="Name, brand, description and grade can be filled by AI from your photos. Or just type them in."
      >
        <Field
          label="Name"
          error={fieldErrors.name}
          required
          flash={lastApplied?.fields.includes("name")}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Brand"
          error={fieldErrors.brand}
          flash={lastApplied?.fields.includes("brand")}
        >
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Description"
          error={fieldErrors.description}
          flash={lastApplied?.fields.includes("description")}
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field label="Condition type" required>
          <div className="flex gap-2">
            {(["new", "used"] as const).map((c) => (
              <label
                key={c}
                className={
                  condition === c
                    ? "cursor-pointer border border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper"
                    : "cursor-pointer border border-rule px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink/60 hover:border-ink hover:text-ink"
                }
              >
                <input
                  type="radio"
                  name="condition"
                  value={c}
                  checked={condition === c}
                  onChange={() => handleConditionChange(c)}
                  className="sr-only"
                />
                {c}
              </label>
            ))}
          </div>
        </Field>

        {condition === "used" && (
          <Field
            label="Grade"
            error={fieldErrors.condition_grade}
            required
            flash={lastApplied?.fields.includes("grade")}
          >
            <div className="flex gap-2">
              {(["A", "B", "C"] as const).map((g) => (
                <label
                  key={g}
                  className={
                    conditionGrade === g
                      ? "cursor-pointer border border-ink bg-ink px-4 py-2 font-mono text-xs font-bold text-paper"
                      : "cursor-pointer border border-rule px-4 py-2 font-mono text-xs font-bold text-ink/60 hover:border-ink hover:text-ink"
                  }
                >
                  <input
                    type="radio"
                    name="conditionGrade"
                    value={g}
                    checked={conditionGrade === g}
                    onChange={() => setConditionGrade(g)}
                    className="sr-only"
                  />
                  Grade {g}
                </label>
              ))}
            </div>
          </Field>
        )}
      </Section>

      <Section title="Identifiers">
        <Field label="SKU" error={fieldErrors.sku} required>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono text-sm focus:border-brand-red focus:outline-none"
            placeholder="DDS-NEW-DSK-002"
          />
        </Field>
        <Field
          label="Slug"
          error={fieldErrors.slug}
          required
          hint="URL-safe identifier. Auto-generated from name when creating."
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full border border-rule bg-paper px-4 py-3 font-mono text-sm focus:border-brand-red focus:outline-none"
            />
            {slug.startsWith("draft-") &&
              name.trim() !== "" &&
              name.trim().toLowerCase() !== "untitled draft" && (
                <button
                  type="button"
                  onClick={handleRegenerateSlug}
                  className="shrink-0 border border-rule px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
                >
                  Regen from name
                </button>
              )}
          </div>
        </Field>
      </Section>

      <Section title="Pricing">
        <Field label="Price (£)" error={fieldErrors.price_pence} required>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="499.00"
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Was-price (£)"
          error={fieldErrors.was_price_pence}
          hint="Strikethrough RRP. Must be higher than price."
        >
          <input
            type="text"
            inputMode="decimal"
            value={wasPrice}
            onChange={(e) => setWasPrice(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Cost price (£)"
          error={fieldErrors.cost_price_pence}
          hint="What we paid. Internal only."
        >
          <input
            type="text"
            inputMode="decimal"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
        <MarginCalculator price={price} costPrice={costPrice} />
      </Section>

      {isEdit && (
        <Section title="Categories">
          {categoriesWarning && (
            <div className="mb-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {categoriesWarning}
            </div>
          )}
          <CategoryPicker
            allCategories={allCategories}
            selectedIds={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />
        </Section>
      )}

      <Section title="Stock & ops">
        <Field label="Stock quantity" error={fieldErrors.stock_quantity}>
          <input
            type="number"
            min={0}
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Low-stock alert"
          error={fieldErrors.low_stock_alert}
          hint="Notify when stock falls to this level."
        >
          <input
            type="number"
            min={0}
            value={lowStock}
            onChange={(e) => setLowStock(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Warehouse location"
          error={fieldErrors.warehouse_location}
        >
          <input
            type="text"
            value={warehouseLocation}
            onChange={(e) => setWarehouseLocation(e.target.value)}
            placeholder="Bay A-12"
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <Section title="Physical">
        <Field label="Weight (kg)" error={fieldErrors.weight_kg}>
          <input
            type="text"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field label="Dimensions (cm)" error={fieldErrors.dimensions}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              inputMode="decimal"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
              placeholder="Width"
              className="border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
            />
            <input
              type="text"
              inputMode="decimal"
              value={depthCm}
              onChange={(e) => setDepthCm(e.target.value)}
              placeholder="Depth"
              className="border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
            />
            <input
              type="text"
              inputMode="decimal"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="Height"
              className="border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
            />
          </div>
        </Field>
      </Section>

      <Section title="Status & tags">
        <Field label="Status" required>
          <div className="flex gap-2">
            {(["draft", "live", "archived"] as const).map((s) => (
              <label
                key={s}
                className={
                  status === s
                    ? "cursor-pointer border border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper"
                    : "cursor-pointer border border-rule px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink/60 hover:border-ink hover:text-ink"
                }
              >
                <input
                  type="radio"
                  name="status"
                  value={s}
                  checked={status === s}
                  onChange={() => setStatus(s)}
                  className="sr-only"
                />
                {s}
              </label>
            ))}
          </div>
        </Field>
        <Field
          label="Tags"
          error={fieldErrors.tags}
          hint="Comma-separated. E.g. ergonomic, mesh, lumbar"
        >
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      {condition === "used" && (
        <Section
          title="Used item details"
          subtitle="Admin-disclosed information about this specific used item. Buyers see condition notes on the public listing."
        >
          <Field
            label="Condition notes"
            error={fieldErrors.condition_notes}
            hint="Disclosed faults, wear, repairs."
          >
            <textarea
              value={conditionNotes}
              onChange={(e) => setConditionNotes(e.target.value)}
              rows={3}
              className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
            />
          </Field>
          <Field
            label="Source"
            error={fieldErrors.source}
            hint="Where this came from. E.g. Corporate clear-out, EC2"
          >
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
            />
          </Field>
          <Field label="Refurb date" error={fieldErrors.refurb_date}>
            <input
              type="date"
              value={refurbDate}
              onChange={(e) => setRefurbDate(e.target.value)}
              className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
            />
          </Field>
        </Section>
      )}

      {isEdit && initialProduct && condition === "used" && (
        <Section
          title="Condition report"
          subtitle="Itemised observations for the buyer-facing condition report. Used items only."
        >
          <ConditionReportSection
            productId={initialProduct.id}
            initialReport={initialReport}
            initialReportItems={initialReportItems}
            attachedImages={initialImages}
          />
        </Section>
      )}

      {/* Sticky save bar — slides up from the bottom when the in-form save
          row scrolls out of view. Always rendered so it can animate: when the
          in-form row is visible it's translated off-screen + made
          non-interactive (pointer-events-none, tabIndex -1) rather than
          display:none, so the slide runs both ways. Safe-area padding keeps
          the button clear of the iOS home indicator. */}
      <div
        className={
          "fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper/95 backdrop-blur-sm shadow-[0_-2px_12px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out " +
          (isBottomVisible
            ? "translate-y-full pointer-events-none"
            : "translate-y-0")
        }
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-hidden={isBottomVisible}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
          <span className="text-xs font-bold uppercase tracking-widest text-ink/60">
            {isEdit ? "Editing product" : "New product"}
          </span>
          <div className="flex items-center gap-3">
            {isEdit &&
              initialProduct?.status === "live" &&
              initialProduct?.slug && (
                <Link
                  href={`/products/${initialProduct.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={isBottomVisible ? -1 : undefined}
                  className="shrink-0 text-xs font-bold uppercase tracking-widest text-ink/60 underline transition hover:text-brand-red"
                >
                  View on site →
                </Link>
              )}
            <button
              type="submit"
              disabled={isPending}
              tabIndex={isBottomVisible ? -1 : undefined}
              className="flex-1 bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:opacity-50 sm:flex-none sm:px-8"
            >
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </button>
          </div>
        </div>
      </div>

      <div ref={bottomRowRef} className="flex items-center justify-between border-t border-rule pt-8">
        <div className="flex gap-3">
          <Link
            href="/admin/products"
            className="border border-rule px-5 py-3 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </button>
          {isEdit &&
            initialProduct?.status === "live" &&
            initialProduct?.slug && (
              <Link
                href={`/products/${initialProduct.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="self-center text-xs font-bold uppercase tracking-widest text-ink/60 underline transition hover:text-brand-red"
              >
                View on site →
              </Link>
            )}
        </div>

        {isEdit && (
          <div className="flex gap-3">
            {initialProduct?.status !== "archived" && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={isPending}
                className="border border-rule px-5 py-3 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Archive
              </button>
            )}
            {canHardDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="border border-brand-red px-5 py-3 text-xs font-bold uppercase tracking-widest text-brand-red transition hover:bg-brand-red hover:text-paper disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {isEdit && initialProduct?.price_pence !== undefined && (
        <p className="text-xs text-ink/40">
          Current saved price: {formatPence(initialProduct.price_pence)}
          {" · "}
          Stock: {initialProduct.stock_quantity}
        </p>
      )}
    </form>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-8 border-b-2 border-ink pb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs uppercase tracking-widest text-ink/40">
            {subtitle}
          </p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  error,
  hint,
  required,
  flash,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  flash?: boolean;
}) {
  return (
    <div>
      <label
        className={
          flash
            ? "block text-xs font-bold uppercase tracking-widest text-brand-red mb-2 transition-colors"
            : "block text-xs font-bold uppercase tracking-widest text-ink mb-2 transition-colors"
        }
      >
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
        {flash && (
          <span className="ml-2 text-[10px] font-bold text-brand-red">JUST FILLED</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-ink/40">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 text-xs font-bold text-brand-red">{error}</p>
      )}
    </div>
  );
}

