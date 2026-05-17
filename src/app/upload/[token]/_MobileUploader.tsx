"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  mobileGenerateUploadSignature,
  mobileAttachImage,
} from "@/app/admin/(authed)/products/_actions";

/**
 * Strip-down mobile uploader. The phone is small, the user is
 * focused on one task, and they may have no admin session at all —
 * the only thing they need is two big buttons and immediate feedback
 * that their photo landed.
 *
 * Visual language stays in the brand: paper background, ink type,
 * brand-red used only for the primary action and progress accents.
 * No header, no nav, no breadcrumbs.
 *
 * The upload pipeline is the same as the desktop ImageUploader:
 *
 *   1. ask the server for a signed Cloudinary payload
 *   2. POST file directly to Cloudinary with XHR for progress
 *   3. ask the server to attach the result to product_images
 *
 * Differences from the desktop component:
 *   - Token-authorised actions (mobileGenerateUploadSignature /
 *     mobileAttachImage) instead of cookie-authed equivalents.
 *   - No reorder / hero / delete / alt-text — write-only. Editing
 *     happens back on the desktop.
 *   - No drag-and-drop. Two big buttons: Take Photo (capture=
 *     environment opens the rear camera direct) and Choose from
 *     Library (regular file picker).
 *   - Inline thumbnails of just-uploaded photos so the user has
 *     visual confirmation each one made it through.
 *   - Same processedClientIdsRef gatekeeper as desktop, for the same
 *     reason (idempotent processUpload, fixes the duplicate-on-drop
 *     bug from the desktop pipeline).
 */

type UploadStatus = "pending" | "uploading" | "attaching" | "done" | "error";

interface UploadItem {
  clientId: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  errorMessage?: string;
  resultUrl?: string;
}

type CloudinaryUploadResult =
  | { ok: true; publicId: string; secureUrl: string }
  | { ok: false; error: string };

const MAX_CONCURRENT = 2;

export function MobileUploader({
  token,
  productName,
  productSku,
  expiresAt,
}: {
  token: string;
  productName: string;
  productSku: string;
  expiresAt: string;
}) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const processedClientIdsRef = useRef<Set<string>>(new Set());

  // Tick the "expires in N minutes" copy once a minute. Cheap.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const minutesRemaining = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - now) / 60_000)
  );

  const updateUpload = useCallback(
    (clientId: string, patch: Partial<UploadItem>) => {
      setUploads((current) =>
        current.map((u) =>
          u.clientId === clientId ? { ...u, ...patch } : u
        )
      );
    },
    []
  );

  const processUpload = useCallback(
    async (item: UploadItem) => {
      // Idempotency gatekeeper. Same pattern + reasoning as
      // _ImageUploader.tsx: state churn from progress events would
      // otherwise re-trigger the pending-restart block.
      if (processedClientIdsRef.current.has(item.clientId)) return;
      processedClientIdsRef.current.add(item.clientId);

      // Step 1 — get a token-authorised signature.
      updateUpload(item.clientId, { status: "uploading", progress: 5 });
      const sigResult = await mobileGenerateUploadSignature(token);
      if (!sigResult.ok) {
        updateUpload(item.clientId, {
          status: "error",
          errorMessage: linkProblemMessage(sigResult.reason),
        });
        return;
      }

      // Step 2 — POST direct to Cloudinary, with XHR for progress.
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("api_key", sigResult.apiKey);
      formData.append("timestamp", String(sigResult.timestamp));
      formData.append("signature", sigResult.signature);
      formData.append("upload_preset", sigResult.uploadPreset);
      formData.append("folder", sigResult.folder);

      const cloudinaryResponse = await new Promise<CloudinaryUploadResult>(
        (resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${sigResult.cloudName}/image/upload`
          );

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const pct = Math.round((event.loaded / event.total) * 90) + 5;
              updateUpload(item.clientId, { progress: Math.min(pct, 95) });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const body = JSON.parse(xhr.responseText);
                resolve({
                  ok: true,
                  publicId: body.public_id,
                  secureUrl: body.secure_url,
                });
              } catch {
                resolve({ ok: false, error: "Bad Cloudinary response" });
              }
            } else {
              resolve({
                ok: false,
                error: `Cloudinary returned ${xhr.status}`,
              });
            }
          });

          xhr.addEventListener("error", () =>
            resolve({ ok: false, error: "Network error" })
          );
          xhr.addEventListener("abort", () =>
            resolve({ ok: false, error: "Upload aborted" })
          );

          xhr.send(formData);
        }
      );

      if (!cloudinaryResponse.ok) {
        updateUpload(item.clientId, {
          status: "error",
          errorMessage: cloudinaryResponse.error,
        });
        return;
      }

      // Step 3 — attach to product_images via token-authed action.
      updateUpload(item.clientId, { status: "attaching", progress: 97 });
      const attachResult = await mobileAttachImage({
        token,
        publicId: cloudinaryResponse.publicId,
        url: cloudinaryResponse.secureUrl,
      });

      if (!attachResult.ok) {
        updateUpload(item.clientId, {
          status: "error",
          errorMessage:
            attachResult.formError ?? linkProblemMessage(attachResult.reason),
        });
        return;
      }

      updateUpload(item.clientId, {
        status: "done",
        progress: 100,
        resultUrl: cloudinaryResponse.secureUrl,
      });
    },
    [token, updateUpload]
  );

  // Render-body restart block: kick off any pending uploads up to the
  // concurrency cap. The processedClientIdsRef gatekeeper inside
  // processUpload makes this safe even when state churn re-runs it.
  const inFlightCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "attaching"
  ).length;
  const pendingItems = uploads.filter((u) => u.status === "pending");
  const slotsAvailable = MAX_CONCURRENT - inFlightCount;
  if (slotsAvailable > 0 && pendingItems.length > 0) {
    for (const item of pendingItems.slice(0, slotsAvailable)) {
      queueMicrotask(() => processUpload(item));
    }
  }

  const enqueueFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      clientId: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      progress: 0,
    }));
    setUploads((current) => [...current, ...newItems]);
  }, []);

  const doneCount = uploads.filter((u) => u.status === "done").length;
  const errorCount = uploads.filter((u) => u.status === "error").length;
  const linkExpired = minutesRemaining === 0;

  const expiryClass = linkExpired ? "text-brand-red" : "text-ink/50";
  const expiryCopy = linkExpired
    ? "Link expired — ask for a new one"
    : `Link expires in ~${minutesRemaining} min`;
  const sessionSummary =
    errorCount > 0
      ? `${doneCount} uploaded, ${errorCount} failed`
      : `${doneCount} uploaded`;

  return (
    <main className="min-h-screen bg-paper text-ink px-5 py-6 flex flex-col">
      <header className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-ink/60">
          Direct Desk Solutions · Upload
        </p>
        <h1 className="mt-1 text-xl font-black leading-tight">
          {productName}
        </h1>
        <p className="mt-1 text-xs text-ink/60 font-mono">{productSku}</p>
        <p className={`mt-3 text-[11px] uppercase tracking-widest ${expiryClass}`}>
          {expiryCopy}
        </p>
      </header>

      <div className="flex flex-col gap-3 mb-6">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={linkExpired}
          className="w-full bg-ink text-paper py-5 text-sm uppercase tracking-widest font-bold disabled:opacity-40 disabled:cursor-not-allowed active:bg-brand-red transition-colors"
        >
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => libraryInputRef.current?.click()}
          disabled={linkExpired}
          className="w-full bg-paper border border-ink text-ink py-5 text-sm uppercase tracking-widest font-bold disabled:opacity-40 disabled:cursor-not-allowed active:bg-ink active:text-paper transition-colors"
        >
          Choose from Library
        </button>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={libraryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <section className="mb-6">
          <p className="text-[10px] uppercase tracking-widest text-ink/60 mb-2">
            This session · {sessionSummary}
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {uploads.map((u) => (
              <li
                key={u.clientId}
                className="relative aspect-square border border-rule overflow-hidden bg-paper"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.previewUrl}
                  alt=""
                  className={
                    u.status === "done"
                      ? "w-full h-full object-cover"
                      : "w-full h-full object-cover opacity-60"
                  }
                />
                {u.status !== "done" && u.status !== "error" && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-ink/10">
                    <div
                      className="h-full bg-brand-red transition-all"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
                {u.status === "done" && (
                  <div className="absolute top-1 right-1 bg-ink text-paper text-[9px] uppercase tracking-widest px-1.5 py-0.5">
                    Done
                  </div>
                )}
                {u.status === "error" && (
                  <div className="absolute inset-0 bg-brand-red/90 text-paper text-[10px] flex items-center justify-center text-center p-2 leading-tight">
                    {u.errorMessage ?? "Failed"}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-auto text-center text-[10px] uppercase tracking-widest text-ink/40 pt-6">
        You can close this tab when finished
      </p>
    </main>
  );
}

function linkProblemMessage(
  reason: "expired" | "revoked" | "exhausted" | "not_found" | "server"
): string {
  switch (reason) {
    case "expired":
      return "Link expired";
    case "revoked":
      return "Link cancelled";
    case "exhausted":
      return "Link limit reached";
    case "not_found":
      return "Link not found";
    case "server":
      return "Server error";
  }
}
