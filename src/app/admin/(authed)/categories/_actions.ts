"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, type CategoryInput } from "@/lib/categories/schema";
import type { Database } from "@/types/database";

/**
 * Server Actions for category CRUD + product-category assignment.
 *
 * Lives under the (authed) group so middleware + layout have already
 * confirmed an authenticated session before any of these execute.
 *
 * Return shape (discriminated union, matches products/_actions.ts):
 *   { ok: true, id?: string }
 *   { ok: false, fieldErrors?: Record<string, string>, formError?: string }
 */

type ActionResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      fieldErrors?: Record<string, string>;
      formError?: string;
    };

function uniqueViolationToFieldErrors(
  error: { code?: string; message?: string } | null
): Record<string, string> | null {
  if (!error || error.code !== "23505") return null;
  const msg = error.message ?? "";
  if (msg.includes("categories_slug_key")) {
    return { slug: "This slug is already in use" };
  }
  return null;
}

function zodErrorsToFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      result[key] = messages[0];
    }
  }
  return result;
}

/**
 * Walk up the ancestor chain from candidateParentId. If we hit categoryId,
 * setting parent_id = candidateParentId would create a cycle (A -> B -> A).
 *
 * Postgres can't enforce this with a check constraint, so we guard at
 * the application layer. Cheap: O(depth) reads, bounded by category tree.
 */
async function wouldCreateCycle(
  supabase: SupabaseClient<Database>,
  categoryId: string,
  candidateParentId: string
): Promise<boolean> {
  // Trivially: setting parent to self is a cycle (also blocked by DB check).
  if (categoryId === candidateParentId) return true;

  let cursor: string | null = candidateParentId;
  const visited = new Set<string>();

  while (cursor) {
    if (cursor === categoryId) return true;
    if (visited.has(cursor)) {
      // Pre-existing cycle in data — fail safe rather than infinite loop.
      return true;
    }
    visited.add(cursor);

    const result: {
      data: { parent_id: string | null } | null;
      error: unknown;
    } = await supabase
      .from("categories")
      .select("parent_id")
      .eq("id", cursor)
      .maybeSingle();

    if (result.error || !result.data) return false; // Can't walk further; treat as safe.
    cursor = result.data.parent_id;
  }
  return false;
}

// ---------------------------------------------------------------------------
// createCategory
// ---------------------------------------------------------------------------
export async function createCategory(
  input: CategoryInput
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    const fieldErrors = uniqueViolationToFieldErrors(error);
    if (fieldErrors) return { ok: false, fieldErrors };
    return { ok: false, formError: error.message };
  }

  revalidatePath("/admin/categories");
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// updateCategory
// ---------------------------------------------------------------------------
export async function updateCategory(
  id: string,
  input: CategoryInput
): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();

  // Cycle check before issuing the UPDATE.
  if (parsed.data.parent_id) {
    const cycle = await wouldCreateCycle(supabase, id, parsed.data.parent_id);
    if (cycle) {
      return {
        ok: false,
        fieldErrors: {
          parent_id:
            "Can't set this parent — it would create a cycle (the chosen parent is this category or one of its descendants).",
        },
      };
    }
  }

  const { error } = await supabase
    .from("categories")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    const fieldErrors = uniqueViolationToFieldErrors(error);
    if (fieldErrors) return { ok: false, fieldErrors };
    return { ok: false, formError: error.message };
  }

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// archiveCategory / restoreCategory
// ---------------------------------------------------------------------------
export async function archiveCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { ok: false, formError: error.message };

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  return { ok: true, id };
}

export async function restoreCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: true })
    .eq("id", id);

  if (error) return { ok: false, formError: error.message };

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${id}`);
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// setProductCategories
// Sets the full list of category assignments for one product.
// Atomic delete-then-insert pattern. Single-admin assumption applies
// (same as image hero/reorder — see Brief 5).
// ---------------------------------------------------------------------------
export async function setProductCategories(
  productId: string,
  categoryIds: string[]
): Promise<ActionResult> {
  // De-dupe defensively in case the UI submits duplicates.
  const uniqueIds = Array.from(new Set(categoryIds));

  const supabase = await createClient();

  // Wipe existing assignments for this product.
  const { error: deleteError } = await supabase
    .from("product_categories")
    .delete()
    .eq("product_id", productId);

  if (deleteError) {
    return { ok: false, formError: deleteError.message };
  }

  // Re-insert the new set. Empty array is valid — means "no categories".
  if (uniqueIds.length > 0) {
    const rows = uniqueIds.map((category_id) => ({
      product_id: productId,
      category_id,
    }));
    const { error: insertError } = await supabase
      .from("product_categories")
      .insert(rows);

    if (insertError) {
      return { ok: false, formError: insertError.message };
    }
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  return { ok: true, id: productId };
}

// ---------------------------------------------------------------------------
// assignCategoryToProducts
// Bulk-tag one category onto N products. Useful for "make these 10 products
// part of Clearance" without editing each product individually.
//
// Upsert semantics: if a product is already in this category, skip silently.
// ---------------------------------------------------------------------------
export async function assignCategoryToProducts(
  categoryId: string,
  productIds: string[]
): Promise<ActionResult> {
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return { ok: true, id: categoryId };

  const supabase = await createClient();
  const rows = uniqueIds.map((product_id) => ({
    product_id,
    category_id: categoryId,
  }));

  // onConflict on the composite PK makes this idempotent.
  const { error } = await supabase
    .from("product_categories")
    .upsert(rows, { onConflict: "product_id,category_id", ignoreDuplicates: true });

  if (error) return { ok: false, formError: error.message };

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}`);
  revalidatePath("/admin/products");
  return { ok: true, id: categoryId };
}
