"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { productSchema, type ProductInput } from "@/lib/products/schema";

/**
 * Server Actions for product CRUD.
 *
 * Lives under the (authed) group so middleware + layout have already
 * confirmed an authenticated session before any of these execute.
 *
 * Return shape (discriminated union):
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
  if (msg.includes("products_sku_key")) {
    return { sku: "This SKU is already in use" };
  }
  if (msg.includes("products_slug_key")) {
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

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    const fieldErrors = uniqueViolationToFieldErrors(error);
    if (fieldErrors) return { ok: false, fieldErrors };
    return { ok: false, formError: error.message };
  }

  revalidatePath("/admin/products");
  return { ok: true, id: data.id };
}

export async function updateProduct(
  id: string,
  input: ProductInput
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", id);

  if (error) {
    const fieldErrors = uniqueViolationToFieldErrors(error);
    if (fieldErrors) return { ok: false, fieldErrors };
    return { ok: false, formError: error.message };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  return { ok: true, id };
}

export async function archiveProduct(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) return { ok: false, formError: error.message };

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

