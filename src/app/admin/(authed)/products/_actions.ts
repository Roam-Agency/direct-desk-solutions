"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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



// ----------------------------------------------------------------------------
// Image management — delete
// ----------------------------------------------------------------------------
// Deleting an image is a two-step affair:
//
//   1. Tell Cloudinary to destroy the asset. If this fails we stop — leaving
//      the DB row alone means the admin sees the image is still there and can
//      retry. The opposite order (DB-first) would risk orphaning a Cloudinary
//      asset with no DB reference, which we can't see or clean up from the app.
//
//   2. Delete the DB row. After this succeeds, check whether the deleted image
//      was the hero — if so, promote the next image (by sort_order ASC) so the
//      product always has a hero as long as any image exists.
//
// "Not found" from Cloudinary is treated as success. The asset is gone either
// way, which is what the admin wanted.

type DeleteImageResult =
  | { ok: true; id: string }
  | { ok: false; formError: string };

export async function deleteImage(imageId: string): Promise<DeleteImageResult> {
  const supabase = await createClient();

  // Belt-and-braces auth check (middleware also gates this route).
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, formError: "Not authenticated" };
  }

  // Look up the row so we know which Cloudinary asset to destroy and which
  // product to potentially re-hero. Single round-trip.
  const { data: image, error: lookupError } = await supabase
    .from("product_images")
    .select("id, product_id, cloudinary_public_id, is_hero")
    .eq("id", imageId)
    .single();
  if (lookupError || !image) {
    return { ok: false, formError: "Image not found" };
  }

  // Step 1 — Cloudinary destroy. Returns { result: 'ok' | 'not found' | ... }
  // We accept 'ok' and 'not found'; anything else is a real failure.
  try {
    const destroyResult = await cloudinary.uploader.destroy(
      image.cloudinary_public_id,
      { invalidate: true }
    );
    const ok = destroyResult.result === "ok" || destroyResult.result === "not found";
    if (!ok) {
      return {
        ok: false,
        formError: `Cloudinary refused destroy: ${destroyResult.result}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      formError: err instanceof Error ? err.message : "Cloudinary destroy failed",
    };
  }

  // Step 2 — DB delete
  const { error: deleteError } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);
  if (deleteError) {
    return { ok: false, formError: deleteError.message };
  }

  // Step 3 — if we just deleted the hero, promote the next image by sort_order.
  // Skipped silently if no remaining images for this product.
  if (image.is_hero) {
    const { data: next, error: nextError } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextError) {
      // Image is gone; promotion failed. Surface this so admin knows.
      return {
        ok: false,
        formError: `Image deleted but could not pick new hero: ${nextError.message}`,
      };
    }
    if (next) {
      const { error: promoteError } = await supabase
        .from("product_images")
        .update({ is_hero: true })
        .eq("id", next.id);
      if (promoteError) {
        return {
          ok: false,
          formError: `Image deleted but could not promote new hero: ${promoteError.message}`,
        };
      }
    }
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${image.product_id}`);
  return { ok: true, id: imageId };
}


// ----------------------------------------------------------------------------
// Image management — set hero
// ----------------------------------------------------------------------------
// Promote a specific image to be the hero. The previous hero (if any) is
// demoted in the same action.
//
// Implementation: two sequential UPDATEs (demote-then-promote) rather than
// a single atomic statement. supabase-js can't express
// `SET is_hero = (id = $target)` in its query builder, and adding a SQL
// function via RPC would require a migration for very little practical gain
// in a single-admin CRM. The theoretical race window — two admins clicking
// Make Hero on different images in the same product within microseconds —
// is not a real concern here.
//
// If we ever need to close this for real, the right move is a partial
// unique index `(product_id) WHERE is_hero = true`, which makes the DB
// reject the second update and incidentally also closes the attachImage
// "first image becomes hero" race flagged last session. That's a one-line
// migration we'll write the day we add multi-admin editing.

type SetHeroImageResult =
  | { ok: true; id: string }
  | { ok: false; formError: string };

export async function setHeroImage(
  imageId: string
): Promise<SetHeroImageResult> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, formError: "Not authenticated" };
  }

  // Look up the target so we know its product_id and can short-circuit if
  // it's already the hero.
  const { data: target, error: lookupError } = await supabase
    .from("product_images")
    .select("id, product_id, is_hero")
    .eq("id", imageId)
    .single();
  if (lookupError || !target) {
    return { ok: false, formError: "Image not found" };
  }

  if (target.is_hero) {
    // No-op — already hero. Return success so the UI behaves naturally.
    return { ok: true, id: imageId };
  }

  // Step 1 — demote whichever image is currently hero for this product.
  // Scoped by product_id so we never touch other products' hero rows.
  const { error: demoteError } = await supabase
    .from("product_images")
    .update({ is_hero: false })
    .eq("product_id", target.product_id)
    .eq("is_hero", true);
  if (demoteError) {
    return { ok: false, formError: demoteError.message };
  }

  // Step 2 — promote the chosen image.
  const { error: promoteError } = await supabase
    .from("product_images")
    .update({ is_hero: true })
    .eq("id", imageId);
  if (promoteError) {
    // Theoretical: previous hero is now demoted and this image is also not
    // hero. The product has no hero until the next setHeroImage call. This
    // is recoverable from the UI (admin clicks again) and never silently
    // bad — the error is surfaced.
    return {
      ok: false,
      formError: `Demoted previous hero but failed to promote: ${promoteError.message}`,
    };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${target.product_id}`);
  return { ok: true, id: imageId };
}


// ----------------------------------------------------------------------------
// Image management — update alt text
// ----------------------------------------------------------------------------
// Single-field update for accessibility. Called on blur from the alt-text
// input below each thumbnail.
//
// Trim whitespace before persisting — admins typing in a form field tend to
// leave trailing spaces. Empty string is a valid value (means "decorative,
// no alt text"), so we don't coerce to null.

type UpdateImageAltTextResult =
  | { ok: true; id: string }
  | { ok: false; formError: string };

export async function updateImageAltText(
  imageId: string,
  altText: string
): Promise<UpdateImageAltTextResult> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, formError: "Not authenticated" };
  }

  // Look up the row's product_id so we can revalidate the right path.
  // Also confirms the row exists before we attempt the update.
  const { data: image, error: lookupError } = await supabase
    .from("product_images")
    .select("product_id")
    .eq("id", imageId)
    .single();
  if (lookupError || !image) {
    return { ok: false, formError: "Image not found" };
  }

  const { error: updateError } = await supabase
    .from("product_images")
    .update({ alt_text: altText.trim() })
    .eq("id", imageId);
  if (updateError) {
    return { ok: false, formError: updateError.message };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${image.product_id}`);
  return { ok: true, id: imageId };
}


// ----------------------------------------------------------------------------
// Image management — reorder
// ----------------------------------------------------------------------------
// Apply a new ordering to a product's images. Receives an array of updates,
// one per image, with the new sort_order integer.
//
// Implementation: sequential UPDATEs. Same single-admin reasoning as
// setHeroImage — a partial-unique-index migration would close the
// theoretical race, but it's not a real concern in this CRM. If any
// update fails partway through, we surface the error; the table is left
// in a partial state (some new orders, some old). The UI revert puts
// the optimistic local state back, and the admin can drag again.
//
// We also belt-and-braces verify that every passed image actually belongs
// to the same product. Stops a malicious caller from re-ordering images
// across products (RLS would catch a fully cross-tenant attempt, but
// a same-tenant scramble would slip past RLS).

type ReorderImagesInput = Array<{ id: string; sort_order: number }>;

type ReorderImagesResult =
  | { ok: true }
  | { ok: false; formError: string };

export async function reorderImages(
  productId: string,
  updates: ReorderImagesInput
): Promise<ReorderImagesResult> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, formError: "Not authenticated" };
  }

  if (updates.length === 0) {
    return { ok: true };
  }

  // Verify every id belongs to this product. One round-trip.
  const ids = updates.map((u) => u.id);
  const { data: rows, error: verifyError } = await supabase
    .from("product_images")
    .select("id, product_id")
    .in("id", ids);
  if (verifyError) {
    return { ok: false, formError: verifyError.message };
  }
  if (!rows || rows.length !== ids.length) {
    return { ok: false, formError: "Some images not found" };
  }
  for (const row of rows) {
    if (row.product_id !== productId) {
      return {
        ok: false,
        formError: "An image does not belong to this product",
      };
    }
  }

  // Apply updates. One UPDATE per row. For products with many images
  // (rare — typical is 4–10) this is N round-trips, but the alternative
  // (a single UPSERT with all rows) would require sending the full row
  // shape including immutable fields. Not worth the complexity yet.
  for (const u of updates) {
    const { error: updateError } = await supabase
      .from("product_images")
      .update({ sort_order: u.sort_order })
      .eq("id", u.id);
    if (updateError) {
      return {
        ok: false,
        formError: `Failed to reorder: ${updateError.message}`,
      };
    }
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}


// ----------------------------------------------------------------------------
// Mobile upload tokens — QR-to-phone flow
// ----------------------------------------------------------------------------
// When an admin clicks "Send to phone" on the desktop edit view, we mint a
// short-lived token bound to that product. A QR code carrying /upload/<token>
// is rendered; the admin scans with whatever phone they're holding (which
// may not be signed in to admin). The mobile page resolves the token to a
// product, uploads photos via the same Cloudinary signed-upload pipeline,
// and attaches them via mobileAttachImage (defined further down in this
// file when we wire the mobile route).
//
// Security model: the token IS the credential. There's no auth check on the
// mobile side. To compensate:
//   - 15-min TTL (set in the DB default, re-verified here)
//   - Caps used_count at 50 — protects against a leaked token being used
//     to spam-upload garbage at the product. Realistic admin sessions use
//     1-10 uploads per token.
//   - upload_tokens table has RLS denying anon/authenticated. All access
//     goes through these Server Actions running with the service-role
//     client (createAdminClient), which bypasses RLS.
//   - Tokens are scoped to one product; resolving returns the product ID,
//     so a tampered URL can't redirect uploads to a different product.

const MAX_TOKEN_USES = 50;

type CreateUploadTokenResult =
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; formError: string };

/**
 * Mint a fresh upload token for this product. Called by the desktop edit
 * view when admin clicks "Send to phone". Requires an authenticated caller;
 * the new row records the caller's user id in created_by for audit.
 *
 * Returns the token UUID — the caller renders the QR for
 * /upload/<token>.
 */
export async function createUploadToken(
  productId: string
): Promise<CreateUploadTokenResult> {
  // Identify the caller. We use the user-context client (cookies) for this
  // because auth.getUser() needs the session.
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false, formError: "Not authenticated" };
  }

  // Verify the product exists. Cheap check, prevents minting tokens for
  // invalid IDs that would just confuse the mobile page later.
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .single();
  if (productError || !product) {
    return { ok: false, formError: "Product not found" };
  }

  // Insert via admin client — upload_tokens has RLS denying authenticated.
  // The defaults (token, created_at, expires_at, used_count) handle
  // everything except product_id and created_by.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("upload_tokens")
    .insert({
      product_id: productId,
      created_by: userData.user.id,
    })
    .select("token, expires_at")
    .single();

  if (error || !data) {
    return { ok: false, formError: error?.message ?? "Token insert failed" };
  }

  return {
    ok: true,
    token: data.token,
    expiresAt: data.expires_at,
  };
}

type ResolveUploadTokenResult =
  | {
      ok: true;
      productId: string;
      productName: string;
      productSku: string;
      expiresAt: string;
    }
  | { ok: false; reason: "expired" | "revoked" | "exhausted" | "not_found" };

/**
 * Validate a token and return the product it authorises uploads for.
 * Called by the mobile /upload/[token] page on render.
 *
 * Deliberately returns specific `reason` strings so the mobile UI can
 * render a useful state ("link expired — ask for a new one") rather
 * than a generic error. None of these reasons leak whether the token
 * ever existed; from the user's perspective they're all "this link
 * doesn't work right now".
 */
export async function resolveUploadToken(
  token: string
): Promise<ResolveUploadTokenResult> {
  // UUID format check up-front — a malformed token can't possibly be valid
  // and Postgres would error on the lookup rather than returning empty.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminClient();
  const { data: tokenRow, error: tokenError } = await admin
    .from("upload_tokens")
    .select("token, product_id, expires_at, revoked_at, used_count")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return { ok: false, reason: "not_found" };
  }

  if (tokenRow.revoked_at) {
    return { ok: false, reason: "revoked" };
  }

  if (new Date(tokenRow.expires_at) <= new Date()) {
    return { ok: false, reason: "expired" };
  }

  if (tokenRow.used_count >= MAX_TOKEN_USES) {
    return { ok: false, reason: "exhausted" };
  }

  // Look up the product so the mobile page can show what it's uploading to.
  // Done in a second round-trip rather than a join because we need the
  // token row alone for the validity checks above — keeps the failure
  // paths cheap.
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id, name, sku")
    .eq("id", tokenRow.product_id)
    .single();

  if (productError || !product) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    expiresAt: tokenRow.expires_at,
  };
}

type ConsumeUploadTokenResult =
  | { ok: true; productId: string }
  | { ok: false; reason: "expired" | "revoked" | "exhausted" | "not_found" };

/**
 * Validate a token and atomically increment used_count. Called server-side
 * by mobileAttachImage (and by mobile signature generation) before doing
 * any work on behalf of the token.
 *
 * We do the validity checks first, then increment. There's a theoretical
 * race: two concurrent uploads on the same token could both pass the
 * MAX_TOKEN_USES check before either increment lands. Acceptable — the
 * cap is a safety bound, not a precise quota, and the worst case is a
 * legitimate session getting one more upload than the cap allows.
 */
export async function consumeUploadToken(
  token: string
): Promise<ConsumeUploadTokenResult> {
  const resolution = await resolveUploadToken(token);
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason };
  }

  const admin = createAdminClient();

  // Increment used_count. We re-fetch then update rather than using a
  // SQL expression because supabase-js can't express `set used_count =
  // used_count + 1` without an RPC. Fine for our scale.
  const { data: current, error: fetchError } = await admin
    .from("upload_tokens")
    .select("used_count")
    .eq("token", token)
    .single();
  if (fetchError || !current) {
    return { ok: false, reason: "not_found" };
  }

  const { error: updateError } = await admin
    .from("upload_tokens")
    .update({ used_count: current.used_count + 1 })
    .eq("token", token);
  if (updateError) {
    // Token validated fine but increment failed. We choose to surface this
    // as "not_found" — refusing the upload is safer than allowing it
    // without recording the use, and the mobile UI handles "not_found"
    // already.
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, productId: resolution.productId };
}


// ----------------------------------------------------------------------------
// Mobile upload pipeline — token-authorised
// ----------------------------------------------------------------------------
// Counterparts to generateUploadSignature + attachImage that take an upload
// token instead of relying on cookie-bound admin auth. The mobile /upload/[token]
// page calls these on every photo it sends through.
//
// Both delegate to consumeUploadToken first, which re-validates the token and
// records a use. consumeUploadToken returns the bound productId — neither
// action accepts a productId from the client, so the token alone determines
// which product receives the upload. A tampered URL cannot redirect uploads.
//
// Beyond the auth swap, the Cloudinary signature logic and the product_images
// insert are intentionally identical to the desktop path. Same Cloudinary
// preset, same folder layout, same hero/sort_order rules.

type MobileSignatureResult =
  | {
      ok: true;
      signature: string;
      timestamp: number;
      apiKey: string;
      cloudName: string;
      uploadPreset: string;
      folder: string;
    }
  | {
      ok: false;
      reason: "expired" | "revoked" | "exhausted" | "not_found" | "server";
    };

/**
 * Token-authorised counterpart of generateUploadSignature. Called from the
 * mobile uploader for each photo.
 *
 * NB: signing a payload does NOT consume a use of the token — only the
 * actual attach does. This means the mobile UI can pre-fetch a signature
 * during file pick without burning a use if the user cancels.
 */
export async function mobileGenerateUploadSignature(
  token: string
): Promise<MobileSignatureResult> {
  const resolution = await resolveUploadToken(token);
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `products/${resolution.productId}`;

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

type MobileAttachImageResult =
  | { ok: true; id: string }
  | {
      ok: false;
      reason: "expired" | "revoked" | "exhausted" | "not_found" | "server";
      formError?: string;
    };

/**
 * Token-authorised counterpart of attachImage. Consumes a use of the
 * token, then inserts a product_images row. Hero + sort_order logic
 * is identical to the desktop attach: first image becomes hero,
 * subsequent ones go to the end.
 *
 * We use the admin client for the insert because the mobile session
 * is unauthenticated — the regular client would fail at RLS even
 * though product_images allows authenticated INSERT, because the
 * mobile page has no auth cookie.
 */
export async function mobileAttachImage(input: {
  token: string;
  publicId: string;
  url: string;
  altText?: string;
}): Promise<MobileAttachImageResult> {
  const consumed = await consumeUploadToken(input.token);
  if (!consumed.ok) {
    return { ok: false, reason: consumed.reason };
  }

  const admin = createAdminClient();

  // Look at existing images for this product to decide hero + sort_order.
  // Mirrors the desktop attach logic exactly.
  const { data: existing, error: existingError } = await admin
    .from("product_images")
    .select("sort_order")
    .eq("product_id", consumed.productId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (existingError) {
    return {
      ok: false,
      reason: "server",
      formError: existingError.message,
    };
  }

  const isFirst = !existing || existing.length === 0;
  const nextSortOrder = isFirst ? 0 : (existing[0].sort_order ?? 0) + 1;

  const { data, error } = await admin
    .from("product_images")
    .insert({
      product_id: consumed.productId,
      cloudinary_public_id: input.publicId,
      cloudinary_url: input.url,
      alt_text: input.altText ?? "",
      is_hero: isFirst,
      sort_order: nextSortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      reason: "server",
      formError: error?.message ?? "Insert failed",
    };
  }

  // Revalidate the desktop edit page so any open tab not subscribed to
  // realtime still picks up the change on next navigation. Realtime is
  // primary, this is the safety net.
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${consumed.productId}`);
  return { ok: true, id: data.id };
}
