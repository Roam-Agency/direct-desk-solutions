/**
 * Client-side image downscaling for the admin upload flow.
 *
 * Phone photos are routinely 5–12MB at 4000px+ on the long edge. Uploading the
 * raw file to Cloudinary is the dominant cost in the "drop photos to create
 * drafts" flow — a single large photo can take 15–25s on a mobile uplink — and
 * the storefront never displays anything near that resolution (Cloudinary
 * resizes every delivery URL on the fly; see `@/lib/cloudinary/transform`).
 * Capping the long edge before upload cuts the transfer by roughly an order of
 * magnitude with no visible quality loss on the site.
 *
 * Browser-only: uses `createImageBitmap` + a `<canvas>`. Import only from
 * client components.
 *
 * Safety rules (compression is an optimisation, never a correctness
 * requirement):
 *   - Only JPEG / PNG / WebP / HEIC are attempted. GIF is skipped (recompressing
 *     would flatten animation); anything else passes through untouched.
 *   - HEIC decodes only on browsers that support it (Safari). Elsewhere
 *     `createImageBitmap` throws, we catch it, and the original HEIC uploads
 *     unchanged.
 *   - Any failure (decode error, no 2D context, toBlob returns null) falls back
 *     to the original file.
 *   - If the re-encoded blob isn't actually smaller, the original is kept.
 */

// Long-edge cap. 2000px comfortably covers the largest rendered product image
// (full-bleed hero on desktop) with headroom for retina.
const MAX_EDGE = 2000;
// JPEG quality for the re-encode. 0.85 is visually lossless for photos at this
// scale while shedding most of the byte weight.
const JPEG_QUALITY = 0.85;
// Files at or below this size aren't worth the decode/re-encode round trip.
const MIN_BYTES_TO_COMPRESS = 1_500_000; // 1.5MB

// Formats we can safely redraw to a canvas and re-encode as JPEG.
const COMPRESSIBLE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export type DownscaleResult = {
  /** The file to upload — either a smaller re-encode or the untouched original. */
  file: File;
  /** True only when we actually produced a smaller file. */
  compressed: boolean;
};

export async function downscaleImage(file: File): Promise<DownscaleResult> {
  if (!COMPRESSIBLE_TYPES.includes(file.type)) {
    return { file, compressed: false };
  }
  if (file.size < MIN_BYTES_TO_COMPRESS) {
    return { file, compressed: false };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longEdge = Math.max(width, height);

    // Already within the cap — only the format/size made it a candidate, and
    // a re-encode would just burn time for no transfer win.
    if (longEdge <= MAX_EDGE) {
      bitmap.close();
      return { file, compressed: false };
    }

    const scale = MAX_EDGE / longEdge;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return { file, compressed: false };
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) {
      return { file, compressed: false };
    }

    // Swap the extension to .jpg so the uploaded name matches the new format.
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const compressedFile = new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    return { file: compressedFile, compressed: true };
  } catch {
    // Decode failure (e.g. HEIC off Safari) — upload the original untouched.
    return { file, compressed: false };
  }
}
