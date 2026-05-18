"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  categorySchema,
  slugify,
  type CategoryInput,
  type CategoryKind,
} from "@/lib/categories/schema";
import { createCategory, updateCategory } from "./_actions";
import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

type Props = {
  mode: "create" | "edit";
  initialCategory?: CategoryRow;
  /** Other categories — used to populate the parent_id dropdown. */
  allCategories: Array<Pick<CategoryRow, "id" | "name" | "kind" | "parent_id">>;
};

const KIND_LABELS: Record<CategoryKind, string> = {
  functional: "Functional (Desks, Seating...)",
  brand: "Brand (Herman Miller, Steelcase...)",
  merchandising: "Merchandising (Clearance, New Arrivals...)",
};

export function CategoryForm({ mode, initialCategory, allCategories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = mode === "edit";

  const [name, setName] = useState(initialCategory?.name ?? "");
  const [slug, setSlug] = useState(initialCategory?.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    !!initialCategory?.slug
  );
  const [description, setDescription] = useState(
    initialCategory?.description ?? ""
  );
  const [kind, setKind] = useState<CategoryKind>(
    (initialCategory?.kind as CategoryKind) ?? "functional"
  );
  const [parentId, setParentId] = useState<string>(
    initialCategory?.parent_id ?? ""
  );
  const [sortOrder, setSortOrder] = useState(
    initialCategory?.sort_order?.toString() ?? "0"
  );
  const [isActive, setIsActive] = useState(
    initialCategory?.is_active ?? true
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Parent dropdown: same kind only, exclude self in edit mode.
  // Brands and merchandising rarely have hierarchy but we permit it.
  const parentCandidates = allCategories.filter(
    (c) => c.kind === kind && (!isEdit || c.id !== initialCategory?.id)
  );

  function handleNameBlur() {
    if (!slugManuallyEdited && name.trim()) {
      setSlug(slugify(name));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugManuallyEdited(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const input: CategoryInput = {
      name,
      slug,
      description: description.trim() || null,
      kind,
      parent_id: parentId || null,
      sort_order: parseInt(sortOrder, 10) || 0,
      is_active: isActive,
    };

    // Pre-validate client-side for instant feedback.
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v && v.length > 0) errs[k] = v[0];
      }
      setFieldErrors(errs);
      return;
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateCategory(initialCategory!.id, input)
        : await createCategory(input);

      if (result.ok) {
        router.push("/admin/categories");
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        if (result.formError) setFormError(result.formError);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {formError && (
        <div className="border-l-4 border-brand-red bg-brand-red/5 px-4 py-3 text-sm text-brand-red">
          {formError}
        </div>
      )}

      <Section title="Identity">
        <Field label="Name" error={fieldErrors.name} required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Desks"
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>

        <Field
          label="Slug"
          error={fieldErrors.slug}
          hint="URL-safe identifier. Auto-generated from name if left blank."
          required
        >
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="desks"
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>

        <Field
          label="Description"
          error={fieldErrors.description}
          hint="Optional. Shown on category pages, used for SEO."
        >
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          />
        </Field>
      </Section>

      <Section title="Taxonomy">
        <Field label="Kind" error={fieldErrors.kind} required>
          <div className="space-y-2">
            {(Object.keys(KIND_LABELS) as CategoryKind[]).map((k) => (
              <label
                key={k}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => {
                    setKind(k);
                    // Reset parent when kind changes (parents are scoped to kind).
                    setParentId("");
                  }}
                  className="accent-brand-red"
                />
                <span className="text-sm">{KIND_LABELS[k]}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field
          label="Parent category"
          error={fieldErrors.parent_id}
          hint="Optional. Only categories of the same kind are eligible."
        >
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 focus:border-brand-red focus:outline-none"
          >
            <option value="">— None (top level) —</option>
            {parentCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Sort order"
          error={fieldErrors.sort_order}
          hint="Lower numbers appear first within their kind/parent."
        >
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full border border-rule bg-paper px-4 py-3 font-mono focus:border-brand-red focus:outline-none"
          />
        </Field>

        <Field label="Active">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-brand-red"
            />
            <span className="text-sm">
              Visible on customer-facing pages and product picker
            </span>
          </label>
        </Field>
      </Section>

      <div className="flex items-center gap-4 border-t border-rule pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create category"}
        </button>
        <Link
          href="/admin/categories"
          className="text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-ink"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6 border-t border-rule pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink">
        {label}
        {required && <span className="ml-1 text-brand-red">*</span>}
      </label>
      {hint && <p className="mb-2 text-xs text-ink/60">{hint}</p>}
      {children}
      {error && <p className="mt-1 text-xs text-brand-red">{error}</p>}
    </div>
  );
}
