"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createDraftProduct,
  generateUploadSignature,
  attachImage,
} from "./products/_actions";

/**
 * Dashboard hero drop zone — the primary "add product" entry point.
 *
 * Photo-first flow, scaled up for multi-photo:
 *   - 1 photo dropped → create draft, attach, redirect to that edit page
 *   - N photos dropped → create N drafts in parallel, upload sequentially
 *     per photo, redirect to /admin/products?status=draft (drafts list
 *     already sorts by updated_at DESC, fresh ones at top)
 *   - Partial success (e.g. 3 of 5) → stay on dashboard with summary,
 *     so the admin sees what failed and can retry
 *
 * Sequential uploads (rather than 3-at-a-time concurrency like
 * _ImageUploader.tsx) keeps the implementation simple. Typical admin
 * use is a handful of photos at a time — 10 photos × 3s each = 30s,
 * acceptable. If real usage shows bigger batches, the next iteration
 * can lift the concurrency pattern from _ImageUploader.
 *
 * AI suggestion is NOT triggered from this entry point in v1.
 * `suggestImageMetadata` is wired into _ImageUploader.tsx itself, not
 * into `attachImage`, so a direct attach skips it. Follow-up: have the
 * edit page auto-trigger AI for any image lacking a suggestion on mount.
 */

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB — matches _ImageUploader.tsx
const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
];

type UploadOutcome =
  | { ok: true; productId: string }
  | { ok: false; error: string };

type Progress = {
  total: number;
  done: number;
  errors: string[];
  successCount: number;
};

export function DashboardDropZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isPending, startTransition] = useTransition();

  function validateFile(file: File): string | null {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return `${file.name}: unsupported type (${file.type || "unknown"})`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `${file.name}: too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 15MB)`;
    }
    return null;
  }

  async function processOneFile(file: File): Promise<UploadOutcome> {
    // 1. Create draft skeleton row.
    const draftResult = await createDraftProduct();
    if (!draftResult.ok || !draftResult.id) {
      const reason = draftResult.ok
        ? "draft created but no id returned"
        : draftResult.formError ?? "could not create draft";
      return { ok: false, error: `${file.name}: ${reason}` };
    }
    const productId = draftResult.id;

    // 2. Get signed Cloudinary payload bound to this product.
    const sig = await generateUploadSignature(productId);
    if (!sig.ok) {
      return { ok: false, error: `${file.name}: signature failed (${sig.formError})` };
    }

    // 3. POST file directly to Cloudinary. Bytes never touch our server.
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sig.apiKey);
    formData.append("timestamp", String(sig.timestamp));
    formData.append("signature", sig.signature);
    formData.append("upload_preset", sig.uploadPreset);
    formData.append("folder", sig.folder);

    let cloudinaryData: { public_id?: string; secure_url?: string };
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      if (!response.ok) {
        return { ok: false, error: `${file.name}: Cloudinary upload failed (HTTP ${response.status})` };
      }
      cloudinaryData = await response.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      return { ok: false, error: `${file.name}: ${msg}` };
    }

    if (!cloudinaryData.public_id || !cloudinaryData.secure_url) {
      return { ok: false, error: `${file.name}: Cloudinary response missing fields` };
    }

    // 4. Persist into product_images.
    const attachResult = await attachImage({
      productId,
      publicId: cloudinaryData.public_id,
      url: cloudinaryData.secure_url,
    });
    if (!attachResult.ok) {
      return { ok: false, error: `${file.name}: attach failed (${attachResult.formError})` };
    }

    return { ok: true, productId };
  }

  function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const validationErrors: string[] = [];
    const validFiles: File[] = [];
    for (const file of fileArray) {
      const err = validateFile(file);
      if (err) validationErrors.push(err);
      else validFiles.push(file);
    }

    if (validFiles.length === 0) {
      // Nothing to upload — just report validation errors.
      setProgress({
        total: 0,
        done: 0,
        errors: validationErrors,
        successCount: 0,
      });
      return;
    }

    startTransition(async () => {
      setProgress({
        total: validFiles.length,
        done: 0,
        errors: validationErrors,
        successCount: 0,
      });

      const successIds: string[] = [];
      const errors: string[] = [...validationErrors];

      // Sequential — one upload at a time. Predictable, no race surface.
      for (const file of validFiles) {
        const result = await processOneFile(file);
        if (result.ok) {
          successIds.push(result.productId);
        } else {
          errors.push(result.error);
        }
        setProgress((p) =>
          p
            ? {
                ...p,
                done: p.done + 1,
                errors,
                successCount: successIds.length,
              }
            : null
        );
      }

      // Routing decision based on result:
      //  - 0 successes → stay, show errors
      //  - partial    → stay, show success count + errors
      //  - all clean, 1 success → go to that edit page
      //  - all clean, 2+ successes → go to drafts list
      if (successIds.length === 0) return;
      if (errors.length > 0) return; // partial — let admin review
      if (successIds.length === 1) {
        router.push(`/admin/products/${successIds[0]}`);
      } else {
        router.push("/admin/products?status=draft");
      }
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only un-highlight if we're actually leaving the drop zone (not just
    // entering a child element). The relatedTarget check handles that.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  }

  function handleBrowse() {
    inputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset so the same file can be re-selected
      e.target.value = "";
    }
  }

  const zoneClass = [
    "flex flex-col items-center justify-center",
    "border-2 border-dashed",
    "px-6 py-12 min-h-[200px]",
    "text-center",
    "transition cursor-pointer",
    isDragging
      ? "border-brand-red bg-brand-red/5"
      : "border-ink/30 bg-paper hover:border-ink hover:bg-rule/20",
    isPending ? "cursor-wait" : "",
  ].join(" ");

  const inProgressLabel = progress
    ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
    : "Uploading…";

  return (
    <div>
      <div
        className={zoneClass}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={isPending ? undefined : handleBrowse}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isPending) {
            e.preventDefault();
            handleBrowse();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop product photos to create drafts"
        aria-busy={isPending}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(",")}
          multiple
          onChange={handleFileInputChange}
          className="sr-only"
          aria-hidden
        />

        {isPending && progress ? (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-ink">
              {inProgressLabel}
            </p>
            <p className="mt-2 text-xs text-ink/60">
              Drafts being created — hang tight.
            </p>
          </>
        ) : (
          <>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-ink/50"
              aria-hidden
            >
              <path
                d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 text-base font-bold text-ink">
              Drop product photos here to start new drafts
            </p>
            <p className="mt-1 text-xs text-ink/60">
              or click to browse — multiple photos create multiple drafts
            </p>
          </>
        )}
      </div>

      {/* Partial-success or all-failed summary. Renders below the zone
          when uploads have finished but routing was suppressed. */}
      {!isPending && progress && (progress.errors.length > 0 || progress.successCount > 0) ? (
        <div className="mt-3 border-l-2 border-brand-red bg-paper px-4 py-3">
          {progress.successCount > 0 ? (
            <p className="text-xs">
              <span className="font-bold uppercase tracking-widest text-ink">
                {progress.successCount} draft{progress.successCount === 1 ? "" : "s"} created
              </span>
              <span className="ml-2 text-ink/60">
                ·{" "}
                <Link
                  href="/admin/products?status=draft"
                  className="underline transition hover:text-brand-red"
                >
                  View drafts →
                </Link>
              </span>
            </p>
          ) : null}
          {progress.errors.length > 0 ? (
            <>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-brand-red">
                {progress.errors.length} failed
              </p>
              <ul className="mt-2 space-y-1 text-xs text-ink/70">
                {progress.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
