/**
 * Pure URL helpers for Cloudinary delivery — no SDK, no secrets.
 *
 * This module is import-safe from BOTH server and client code. It deliberately
 * does NOT import `@/lib/cloudinary` (the SDK wrapper), which reads the API
 * secret at import time and throws on the client.
 *
 * Why this exists:
 *   Cloudinary serves *derived* (transformed) delivery URLs, but the raw,
 *   un-transformed original — `…/upload/v123/products/<id>/<file>` — is not a
 *   deliverable asset on this account: the delivery edge returns 403 Forbidden
 *   for it. Every place in the app that renders an image already works around
 *   this by rewriting `/upload/` to `/upload/<transformation>/` (see the
 *   products table, gallery, and dashboard thumbnails). Anywhere that used the
 *   bare original instead — the AI vision call and the uploader's own
 *   thumbnail grid — got a 403, both for our own <img> tags and for Claude's
 *   server-side fetch of the URL.
 *
 * Always route a stored `cloudinary_url` through here before delivering it.
 */

/**
 * Inject a transformation segment into a canonical Cloudinary delivery URL.
 *
 * Rewrites the first `/upload/` to `/upload/<transformation>/`. If the URL
 * isn't a canonical delivery URL (no `/upload/` marker) or already carries a
 * transformation immediately after `/upload/`, it's returned unchanged so we
 * never double-transform or mangle a non-Cloudinary URL.
 */
export function withCloudinaryTransform(
  url: string,
  transformation: string
): string {
  const marker = "/upload/";
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  // What immediately follows `/upload/`. A version segment (`v123…`) or a
  // file/public-id means the original is being delivered and we should inject
  // our transformation. If a transformation is already present (it would start
  // with a known param like `c_`, `w_`, `q_`, `f_`, `h_`, etc.), leave it.
  const rest = url.slice(idx + marker.length);
  const firstSegment = rest.split("/")[0] ?? "";
  const looksTransformed = /(^|,)[a-z]{1,3}_/.test(firstSegment);
  if (looksTransformed) return url;

  return url.slice(0, idx + marker.length) + transformation + "/" + rest;
}

/**
 * Square thumbnail for admin grids (uploader, gallery cards). Matches the
 * sizing used by the products list / gallery: a retina-friendly fill crop.
 */
export function cloudinaryThumb(url: string): string {
  return withCloudinaryTransform(url, "c_fill,w_400,h_400,q_auto,f_auto");
}

/**
 * Vision-sized derivative for the Claude image-analysis call. `c_limit` caps
 * the long edge without upscaling or cropping (preserving the whole frame so
 * the model can read logos/labels and assess condition), and q_auto/f_auto
 * keep the payload small. 1600px sits at Claude's vision sweet spot — sending
 * the multi-MB original is both wasteful and was the source of the 403.
 */
export function cloudinaryForVision(url: string): string {
  return withCloudinaryTransform(url, "c_limit,w_1600,h_1600,q_auto,f_auto");
}
