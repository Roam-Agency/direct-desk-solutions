import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary SDK, configured from env vars.
 *
 * Why a wrapper module:
 *   - One place that reads the env vars (fail fast if any are missing)
 *   - Server-only by construction — API secret is required, so this module
 *     errors at import time on the client where the secret is absent
 *   - Server Actions just import { cloudinary } and call .uploader.* etc
 *
 * Env vars used (set in .env.local):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME  (public — appears in delivery URLs)
 *   CLOUDINARY_API_KEY                  (server-only — used for signing)
 *   CLOUDINARY_API_SECRET               (server-only — never reaches browser)
 *
 * The upload preset name (dds_products_signed) is a constant rather than
 * an env var since it lives in this Cloudinary account and is part of the
 * app config, not the environment.
 */

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName) {
  throw new Error(
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set in environment"
  );
}
if (!apiKey) {
  throw new Error("CLOUDINARY_API_KEY is not set in environment");
}
if (!apiSecret) {
  throw new Error("CLOUDINARY_API_SECRET is not set in environment");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export { cloudinary };

/**
 * Upload preset name configured in the Cloudinary dashboard.
 * Signed mode means uploads MUST include a server-generated signature.
 */
export const PRODUCT_IMAGE_UPLOAD_PRESET = "dds_products_signed";

/**
 * Cloud name re-exported for use in delivery URLs constructed client-side.
 * (Cloud name is public — appears in every image URL anyway.)
 */
export const CLOUDINARY_CLOUD_NAME = cloudName;

