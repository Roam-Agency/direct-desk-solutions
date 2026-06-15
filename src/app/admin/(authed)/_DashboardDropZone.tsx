"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createDraftProduct,
  generateUploadSignature,
  attachImage,
} from "./products/_actions";
import { downscaleImage } from "@/lib/images/downscale";

/**
 * Dashboard hero drop zone — the primary "add product" entry point.
 *
 * Photo-first flow, optimised for speed and clear feedback:
 *   - Each dropped photo creates its own draft, uploads to Cloudinary, and
 *     attaches the image. Drafts are independent, so the pipeline runs up to
 *     MAX_CONCURRENT photos at once rather than one-at-a-time — a batch of
 *     three no longer takes three times as long.
 *   - Before upload, oversized photos are downscaled in the browser
 *     (see @/lib/images/downscale). Phone photos are often 5–12MB; shrinking
 *     them is the single biggest cut to the wait, and the storefront resizes
 *     on delivery anyway.
 *   - Each photo shows a live progress bar (XHR upload events), so a slow
 *     transfer reads as "working", never as "hung".
 *   - Any clean success (1 or N photos) → in-zone success confirmation, then
 *     auto-redirect (~1.5s) to /admin/products?status=draft so the admin sees
 *     the new drafts land. Single and multi photo share one destination.
 *   - Partial success (e.g. 3 of 5) → stay on dashboard with a summary plus
 *     per-photo error rows, so the admin sees what failed and can retry.
 *
 * AI suggestion is NOT triggered from this entry point; the edit page picks
 * up any image lacking a suggestion on mount.
 */

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB — matches _ImageUploader.tsx
const MAX_CONCURRENT_UPLOADS = 3; // matches _ImageUploader.tsx
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

type TaskStatus =
  | "pending"
  | "preparing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

type FileTask = {
  // Stable client-side id for tracking this file through state.
  clientId: string;
  name: string;
  file: File;
  status: TaskStatus;
  progress: number; // 0-100
  error?: string;
};

function makeClientId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * POST a file to Cloudinary via XMLHttpRequest so we get upload-progress
 * events (fetch() does not surface them). Resolves rather than rejects on
 * failure so the caller handles every outcome the same way.
 */
function uploadToCloudinary(
  cloudName: string,
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<
  | { ok: true; publicId: string; secureUrl: string }
  | { ok: false; error: string }
> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed.public_id && parsed.secure_url) {
            resolve({
              ok: true,
              publicId: parsed.public_id,
              secureUrl: parsed.secure_url,
            });
          } else {
            resolve({ ok: false, error: "Cloudinary response missing fields" });
          }
        } catch {
          resolve({ ok: false, error: "Could not parse Cloudinary response" });
        }
      } else {
        resolve({ ok: false, error: `Cloudinary upload failed (HTTP ${xhr.status})` });
      }
    });
    xhr.addEventListener("error", () =>
      resolve({ ok: false, error: "Network error during upload" })
    );
    xhr.send(formData);
  });
}

export function DashboardDropZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tasks, setTasks] = useState<FileTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  // Non-null once a batch finishes with every photo succeeding and zero
  // errors. Drives the success confirmation shown in the zone before the
  // auto-redirect to the drafts list fires. Partial/failed batches leave this
  // null and fall through to the summary panel below the zone.
  const [succeededCount, setSucceededCount] = useState<number | null>(null);

  function validateFile(file: File): string | null {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return `Unsupported type (${file.type || "unknown"})`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `Too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 15MB)`;
    }
    return null;
  }

  function updateTask(clientId: string, patch: Partial<FileTask>) {
    setTasks((current) =>
      current.map((t) => (t.clientId === clientId ? { ...t, ...patch } : t))
    );
  }

  async function processOneFile(task: FileTask): Promise<UploadOutcome> {
    // 0. Downscale oversized photos in the browser. Never fatal — falls back
    //    to the original file on any failure (see downscaleImage).
    updateTask(task.clientId, { status: "preparing", progress: 0 });
    let uploadFile = task.file;
    try {
      const { file } = await downscaleImage(task.file);
      uploadFile = file;
    } catch {
      uploadFile = task.file;
    }

    // 1. Create draft skeleton row.
    updateTask(task.clientId, { status: "uploading", progress: 3 });
    const draftResult = await createDraftProduct();
    if (!draftResult.ok || !draftResult.id) {
      const reason = draftResult.ok
        ? "draft created but no id returned"
        : draftResult.formError ?? "could not create draft";
      updateTask(task.clientId, { status: "error", error: reason });
      return { ok: false, error: `${task.name}: ${reason}` };
    }
    const productId = draftResult.id;

    // 2. Get signed Cloudinary payload bound to this product.
    const sig = await generateUploadSignature(productId);
    if (!sig.ok) {
      const reason = `signature failed (${sig.formError})`;
      updateTask(task.clientId, { status: "error", error: reason });
      return { ok: false, error: `${task.name}: ${reason}` };
    }

    // 3. POST file directly to Cloudinary. Bytes never touch our server.
    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("api_key", sig.apiKey);
    formData.append("timestamp", String(sig.timestamp));
    formData.append("signature", sig.signature);
    formData.append("upload_preset", sig.uploadPreset);
    formData.append("folder", sig.folder);

    const uploaded = await uploadToCloudinary(sig.cloudName, formData, (pct) => {
      // Reserve 0-3 for prep and 97-100 for attach; map bytes into 3-95.
      updateTask(task.clientId, { progress: 3 + Math.round(pct * 0.92) });
    });
    if (!uploaded.ok) {
      updateTask(task.clientId, { status: "error", error: uploaded.error });
      return { ok: false, error: `${task.name}: ${uploaded.error}` };
    }

    // 4. Persist into product_images.
    updateTask(task.clientId, { status: "saving", progress: 97 });
    const attachResult = await attachImage({
      productId,
      publicId: uploaded.publicId,
      url: uploaded.secureUrl,
    });
    if (!attachResult.ok) {
      const reason = `attach failed (${attachResult.formError})`;
      updateTask(task.clientId, { status: "error", error: reason });
      return { ok: false, error: `${task.name}: ${reason}` };
    }

    updateTask(task.clientId, { status: "done", progress: 100 });
    return { ok: true, productId };
  }

  /**
   * Run the per-file pipeline across `validTasks` with at most
   * MAX_CONCURRENT_UPLOADS in flight. A fixed pool of workers pulls from a
   * shared cursor — the JS event loop makes the cursor increment and the
   * result-array pushes safe without locks.
   */
  async function runBatch(
    validTasks: FileTask[],
    successIds: string[],
    errors: string[]
  ) {
    let cursor = 0;
    const workerCount = Math.min(MAX_CONCURRENT_UPLOADS, validTasks.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < validTasks.length) {
        const task = validTasks[cursor];
        cursor += 1;
        const outcome = await processOneFile(task);
        if (outcome.ok) successIds.push(outcome.productId);
        else errors.push(outcome.error);
      }
    });
    await Promise.all(workers);
  }

  function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newTasks: FileTask[] = fileArray.map((file) => {
      const err = validateFile(file);
      return {
        clientId: makeClientId(),
        name: file.name,
        file,
        status: err ? "error" : "pending",
        progress: 0,
        error: err ?? undefined,
      };
    });

    setSucceededCount(null);
    setTasks(newTasks);

    const validTasks = newTasks.filter((t) => t.status !== "error");
    const validationErrors = newTasks
      .filter((t) => t.status === "error")
      .map((t) => `${t.name}: ${t.error}`);

    if (validTasks.length === 0) {
      // Nothing to upload — the invalid rows render their own errors.
      return;
    }

    setIsRunning(true);
    void (async () => {
      const successIds: string[] = [];
      const errors: string[] = [...validationErrors];

      await runBatch(validTasks, successIds, errors);

      setIsRunning(false);

      // Routing decision:
      //  - 0 successes → stay, errors shown per-file + in summary
      //  - partial     → stay, summary + per-file errors so admin can retry
      //  - all clean   → show success confirmation, then auto-redirect to the
      //                  drafts list (single and multi share one destination)
      if (successIds.length === 0) return;
      if (errors.length > 0) return;
      setSucceededCount(successIds.length);
      setTimeout(() => {
        router.push("/admin/products?status=draft");
      }, 1500);
    })();
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

  // The zone is "busy" while uploads run and during the brief success
  // confirmation that precedes the auto-redirect. Clicks and keyboard
  // activation are suppressed throughout so a stray click can't reopen the
  // file picker mid-batch or mid-redirect.
  const isSucceeded = succeededCount !== null;
  const busy = isRunning || isSucceeded;

  const zoneClass = [
    "flex flex-col items-center justify-center",
    "border-2 border-dashed",
    "px-6 py-12 min-h-[200px]",
    "text-center",
    "transition cursor-pointer",
    isSucceeded
      ? "border-green-600 bg-green-600/5"
      : isDragging
        ? "border-brand-red bg-brand-red/5"
        : "border-ink/30 bg-paper hover:border-ink hover:bg-rule/20",
    isRunning ? "cursor-wait" : "",
    isSucceeded ? "cursor-default" : "",
  ].join(" ");

  // Aggregate progress for the in-zone label while running.
  const settledCount = tasks.filter(
    (t) => t.status === "done" || t.status === "error"
  ).length;
  const inProgressLabel = `Uploading ${Math.min(
    settledCount + 1,
    tasks.length
  )} of ${tasks.length}…`;

  // Final-state counts (used for the summary panel once the batch settles).
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;

  return (
    <div>
      <div
        className={zoneClass}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={busy ? undefined : handleBrowse}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            handleBrowse();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop product photos to create drafts"
        aria-busy={busy}
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

        {isSucceeded ? (
          <>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-green-600"
              aria-hidden
            >
              <path
                d="M20 6L9 17l-5-5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 text-base font-bold text-ink">
              {succeededCount} draft{succeededCount === 1 ? "" : "s"} created
              from your photo{succeededCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs text-ink/60">
              Taking you to your products…
            </p>
          </>
        ) : isRunning ? (
          <>
            <p className="text-xs font-bold uppercase tracking-widest text-ink">
              {inProgressLabel}
            </p>
            <p className="mt-2 text-xs text-ink/60">
              Optimising and uploading your photos — progress below.
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

      {/* Per-photo progress + error rows. Visible while uploading and after a
          partial/failed batch so the admin can see exactly which photo failed.
          Hidden on a clean success — the in-zone confirmation covers it and we
          redirect immediately. */}
      {tasks.length > 0 && !isSucceeded ? (
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => (
            <li
              key={t.clientId}
              className="flex items-center gap-4 border border-rule bg-paper px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{t.name}</p>
                {t.status === "preparing" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-ink/40">
                    Optimising…
                  </p>
                )}
                {t.status === "uploading" && (
                  <div className="mt-1.5 h-1 w-full bg-rule">
                    <div
                      className="h-1 bg-brand-red transition-all"
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>
                )}
                {t.status === "saving" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-ink/60">
                    Saving…
                  </p>
                )}
                {t.status === "done" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-green-700">
                    Draft created
                  </p>
                )}
                {t.status === "pending" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-ink/40">
                    Queued
                  </p>
                )}
                {t.status === "error" && (
                  <p className="mt-1 text-xs font-bold text-brand-red">
                    {t.error ?? "Failed"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Summary banner once a partial/failed batch settles. Suppressed while
          running and on a clean success (which redirects). */}
      {!isRunning && !isSucceeded && (doneCount > 0 || errorCount > 0) ? (
        <div className="mt-3 border-l-2 border-brand-red bg-paper px-4 py-3">
          {doneCount > 0 ? (
            <p className="text-xs">
              <span className="font-bold uppercase tracking-widest text-ink">
                {doneCount} draft{doneCount === 1 ? "" : "s"} created
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
          {errorCount > 0 ? (
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-brand-red">
              {errorCount} failed — see above
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
