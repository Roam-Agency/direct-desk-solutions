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


// ----------------------------------------------------------------------------
// Image upload pipeline
// ----------------------------------------------------------------------------
// Two Server Actions for the Cloudinary direct-upload pattern:
//
//   1. generateUploadSignature — server signs an upload payload so the browser
//      can POST the file directly to Cloudinary. The signature is short-lived
//      (Cloudinary enforces ~1 hour) and binds the upload to specific params,
//      so a leaked signature can't be reused to upload something different.
//
//   2. attachImage — called by the browser after Cloudinary returns success,
//      persists the public_id + url into product_images. First image becomes
//      hero by default; subsequent images go to the end of sort_order.
//
// We never proxy the file bytes through our own server. Cloudinary's CDN
// receives the upload directly from the browser, which keeps our Netlify
// function bandwidth costs near zero and means a phone can upload a 12MB
// photo without us pretending to handle it.

import {
  cloudinary,
  PRODUCT_IMAGE_UPLOAD_PRESET,
  CLOUDINARY_CLOUD_NAME,
} from "@/lib/cloudinary";

type SignatureResult =
  | {
      ok: true;
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      uploadPreset: string;
      folder: string;
    }
  | { ok: false; formError: string };

/**
 * Generate a signed Cloudinary upload payload for the browser.
 *
 * The browser will POST a multipart/form-data request to:
 *   https://api.cloudinary.com/v1_1/{cloudName}/image/upload
 *
 * It must include: file, api_key, timestamp, signature, upload_preset, folder.
 * The signature is computed over (folder=...&timestamp=...&upload_preset=...)
 * with the API secret as the signing key, matching Cloudinary's signing rules.
 *
 * @param productId  Used to namespace the upload folder per product.
 */
export async function generateUploadSignature(
  productId: string
): Promise<SignatureResult> {
  // Belt-and-braces: middleware already guarantees a session for this route,
  // but the action could in theory be called directly. Re-verify.
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, formError: "Not authenticated" };
  }

  // Verify the product actually exists. Stops a malicious caller from
  // requesting signatures for arbitrary IDs that may collide later.
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .single();
  if (productError || !product) {
    return { ok: false, formError: "Product not found" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `products/${productId}`;

  // Cloudinary requires params signed in alphabetical order, joined by &,
  // hashed with the API secret as suffix. The SDK does this for us.
  const signature = cloudinary.utils.api_sign_request(
    {
      folder,
      timestamp,
      upload_preset: PRODUCT_IMAGE_UPLOAD_PRESET,
    },
    process.env.CLOUDINARY_API_SECRET as string
  );

  return {
    ok: true,
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadPreset: PRODUCT_IMAGE_UPLOAD_PRESET,
    folder,
  };
}

type AttachImageResult =
  | { ok: true; id: string }
  | { ok: false; formError: string };

/**
 * Persist a successful Cloudinary upload into product_images.
 * Called by the browser after Cloudinary returns 200.
 *
 * Hero logic: if the product has no existing images, this one becomes hero.
 * Otherwise it's appended at the next sort_order slot, not-hero.
 */
export async function attachImage(input: {
  productId: string;
  publicId: string;
  url: string;
  altText?: string;
}): Promise<AttachImageResult> {
  const supabase = await createClient();

  // Look at existing images for this product to decide hero + sort_order.
  // Single round-trip; we only need count and max(sort_order).
  const { data: existing, error: existingError } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", input.productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (existingError) {
    return { ok: false, formError: existingError.message };
  }

  const isFirst = !existing || existing.length === 0;
  const nextSortOrder = isFirst ? 0 : (existing[0].sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: input.productId,
      cloudinary_public_id: input.publicId,
      cloudinary_url: input.url,
      alt_text: input.altText ?? "",
      is_hero: isFirst,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, formError: error?.message ?? "Insert failed" };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${input.productId}`);
  return { ok: true, id: data.id };
}

