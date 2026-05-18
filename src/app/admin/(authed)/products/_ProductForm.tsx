"use client";

import { useState, useTransition } from "react";
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
import { ImageUploader } from "./_ImageUploader";
import { MarginCalculator } from "./_MarginCalculator";
import { CategoryPicker } from "./_CategoryPicker";
import { setProductCategories } from "../categories/_actions";
import type { Database } from "@/types/database";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductImageRow =
  Database["public"]["Tables"]["product_images"]["Row"];

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
    });
  }

  async function handleArchive() {
    if (!initialProduct) return;
    if (!confirm("Archive this product? It will be hidden from the customer site.")) return;
    startTransition(async () => {
      const result = await archiveProduct(initialProduct.id);
      if (!result.ok && result.formError) {
        setFormError(result.formError);
      } else {
        router.push("/admin/products");
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

      <Section title="Identity">
        <Field label="SKU" error={fieldErrors.sku} required>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono text-sm focus:border-brand-red focus:outline-none"
            placeholder="DDS-NEW-DSK-002"
          />
        </Field>
        <Field label="Name" error={fieldErrors.name} required>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field
          label="Slug"
          error={fieldErrors.slug}
          required
          hint="URL-safe identifier. Auto-generated from name when creating."
        >
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono text-sm focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field label="Brand" error={fieldErrors.brand}>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <Section title="Condition">
        <Field label="Type" required>
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
          <>
            <Field label="Grade" error={fieldErrors.condition_grade} required>
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
          </>
        )}
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
          <div className="grid grid-cols-3 gap-3">
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

      {isEdit && initialProduct && (
        <Section
          title="Images"
          subtitle="Drag-drop, browse, or send to phone. Drag to reorder, hover for delete and hero controls."
        >
          <ImageUploader
            productId={initialProduct.id}
            productName={initialProduct.name}
            initialImages={initialImages}
          />
        </Section>
      )}

      <div className="flex items-center justify-between border-t border-rule pt-8">
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
      <div className="mb-6 border-b border-rule pb-2">
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
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-widest text-ink mb-2">
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
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

