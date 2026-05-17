"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  generateUploadSignature,
  attachImage,
  deleteImage,
  setHeroImage,
  updateImageAltText,
  reorderImages,
} from "./_actions";

/**
 * Image uploader for the product form.
 *
 * Flow per file:
 *   1. User drops or selects file(s)
 *   2. Validate locally (MIME type, size) — fast feedback
 *   3. Call generateUploadSignature(productId) — server returns signed payload
 *   4. POST file to Cloudinary direct (file bytes never touch our server)
 *   5. On Cloudinary 200 OK, call attachImage(...) to persist into product_images
 *   6. Show thumbnail in the grid
 *
 * Concurrency: max 3 uploads in flight. Anything beyond that queues in
 * "pending" state and starts when a slot frees up.
 *
 * This session ships drag-drop + uploads + read-only thumbnail grid.
 * Delete, reorder, hero-toggle, and alt-text editing land in the next session.
 */

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_CONCURRENT_UPLOADS = 3;
const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

type AttachedImage = {
  id: string;
  cloudinary_public_id: string;
  cloudinary_url: string;
  alt_text: string;
  is_hero: boolean;
  sort_order: number;
};

type UploadItem = {
  // A stable client-side ID for tracking this upload through state. Not the
  // DB id (that arrives only after attachImage succeeds).
  clientId: string;
  file: File;
  status: "pending" | "uploading" | "attaching" | "done" | "error";
  progress: number; // 0-100
  errorMessage?: string;
};

function makeClientId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type || "unknown"}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `Too large (${mb}MB) — max 15MB`;
  }
  return null;
}

// One sortable thumbnail. Has to be its own component because each item
// calls useSortable, and hooks can't run inside a .map() body.
function SortableThumbnail({
  img,
  isDeleting,
  isSettingHero,
  onDelete,
  onSetHero,
  onAltTextBlur,
}: {
  img: AttachedImage;
  isDeleting: boolean;
  isSettingHero: boolean;
  onDelete: (id: string) => void;
  onSetHero: (id: string) => void;
  onAltTextBlur: (
    id: string,
    e: React.FocusEvent<HTMLInputElement>
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id });

  // dnd-kit provides transform + transition values that we apply via
  // inline style. The CSS helper serialises the transform object to a
  // valid CSS string. While dragging we lift the z-index so the dragged
  // thumbnail floats above the others.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2">
      <div
        {...attributes}
        {...listeners}
        className={`group relative aspect-square cursor-grab border border-rule bg-paper transition active:cursor-grabbing ${
          isDeleting ? "opacity-40" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.cloudinary_url}
          alt={img.alt_text || ""}
          className="h-full w-full object-cover"
          draggable={false}
        />
        {img.is_hero && (
          <span className="absolute left-2 top-2 bg-brand-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-paper">
            Hero
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(img.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isDeleting}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-ink/80 text-paper opacity-0 transition group-hover:opacity-100 hover:bg-brand-red disabled:cursor-wait disabled:opacity-50"
          aria-label={`Delete image ${img.alt_text || ""}`.trim()}
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>
        {!img.is_hero && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetHero(img.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isSettingHero}
            className="absolute inset-x-0 bottom-0 bg-ink/80 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-paper opacity-0 transition group-hover:opacity-100 hover:bg-brand-red disabled:cursor-wait disabled:opacity-50"
          >
            {isSettingHero ? "Setting…" : "Make hero"}
          </button>
        )}
      </div>
      <input
        type="text"
        defaultValue={img.alt_text}
        onBlur={(e) => onAltTextBlur(img.id, e)}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Alt text…"
        className="w-full border border-rule bg-paper px-2 py-1 text-xs text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
        aria-label={`Alt text for image ${img.cloudinary_public_id}`}
      />
    </div>
  );
}

export function ImageUploader({
  productId,
  initialImages,
}: {
  productId: string;
  initialImages: AttachedImage[];
}) {
  const [images, setImages] = useState<AttachedImage[]>(initialImages);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  // Track in-flight deletes so the button disables + the thumbnail dims
  // while Cloudinary destroys the asset. Set, not array, for O(1) membership.
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Same shape for in-flight hero promotions.
  const [settingHeroIds, setSettingHeroIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drive the upload queue: whenever uploads state changes, kick off any
  // pending uploads up to the concurrency cap. Uses a ref to avoid stale
  // closure issues — we always read the latest state.
  const inFlightCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "attaching"
  ).length;

  const updateUpload = useCallback(
    (clientId: string, patch: Partial<UploadItem>) => {
      setUploads((current) =>
        current.map((u) => (u.clientId === clientId ? { ...u, ...patch } : u))
      );
    },
    []
  );

  const processUpload = useCallback(
    async (item: UploadItem) => {
      // Step 1: get signature
      updateUpload(item.clientId, { status: "uploading", progress: 5 });
      const sigResult = await generateUploadSignature(productId);
      if (!sigResult.ok) {
        updateUpload(item.clientId, {
          status: "error",
          errorMessage: sigResult.formError,
        });
        return;
      }

      // Step 2: POST to Cloudinary with XMLHttpRequest for progress events
      // (fetch() does not surface upload progress as of writing).
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("api_key", sigResult.apiKey);
      formData.append("timestamp", String(sigResult.timestamp));
      formData.append("signature", sigResult.signature);
      formData.append("upload_preset", sigResult.uploadPreset);
      formData.append("folder", sigResult.folder);

      const cloudinaryResponse = await new Promise<{
        ok: boolean;
        data?: { public_id: string; secure_url: string };
        error?: string;
      }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${sigResult.cloudName}/image/upload`
        );
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90); // 0-90, leave 10 for attach
            updateUpload(item.clientId, { progress: 5 + pct });
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = JSON.parse(xhr.responseText);
              resolve({
                ok: true,
                data: {
                  public_id: parsed.public_id,
                  secure_url: parsed.secure_url,
                },
              });
            } catch {
              resolve({ ok: false, error: "Could not parse Cloudinary response" });
            }
          } else {
            resolve({
              ok: false,
              error: `Cloudinary returned HTTP ${xhr.status}`,
            });
          }
        });
        xhr.addEventListener("error", () => {
          resolve({ ok: false, error: "Network error during upload" });
        });
        xhr.send(formData);
      });

      if (!cloudinaryResponse.ok || !cloudinaryResponse.data) {
        updateUpload(item.clientId, {
          status: "error",
          errorMessage: cloudinaryResponse.error ?? "Upload failed",
        });
        return;
      }

      // Step 3: persist into product_images via Server Action
      updateUpload(item.clientId, { status: "attaching", progress: 95 });
      const attachResult = await attachImage({
        productId,
        publicId: cloudinaryResponse.data.public_id,
        url: cloudinaryResponse.data.secure_url,
      });
      if (!attachResult.ok) {
        updateUpload(item.clientId, {
          status: "error",
          errorMessage: attachResult.formError,
        });
        return;
      }

      // Step 4: success. Append to local image grid optimistically and
      // mark upload done. (revalidatePath in the Server Action covers
      // the canonical refresh on next navigation.)
      const isFirst = images.length === 0;
      const newImage: AttachedImage = {
        id: attachResult.id,
        cloudinary_public_id: cloudinaryResponse.data.public_id,
        cloudinary_url: cloudinaryResponse.data.secure_url,
        alt_text: "",
        is_hero: isFirst,
        sort_order: images.length,
      };
      startTransition(() => {
        setImages((current) => [...current, newImage]);
      });
      updateUpload(item.clientId, { status: "done", progress: 100 });
    },
    [images.length, productId, updateUpload]
  );

  // When new uploads land in state, start any pending ones that fit under
  // the concurrency cap. Effect-free implementation: called inline from
  // handlers that add new items.
  const enqueueAndProcess = useCallback(
    (files: File[]) => {
      const newItems: UploadItem[] = files.map((file) => {
        const error = validateFile(file);
        return {
          clientId: makeClientId(),
          file,
          status: error ? "error" : "pending",
          progress: 0,
          errorMessage: error ?? undefined,
        };
      });

      setUploads((current) => {
        const next = [...current, ...newItems];
        // Decide which pending items should start uploading now.
        const validNew = newItems.filter((i) => i.status === "pending");
        const slotsFree = MAX_CONCURRENT_UPLOADS - inFlightCount;
        const toStart = validNew.slice(0, Math.max(0, slotsFree));

        // Kick off uploads outside of setUploads to avoid double-render.
        // The processUpload calls will updateUpload through the ref pattern.
        queueMicrotask(() => {
          for (const item of toStart) {
            void processUpload(item);
          }
        });

        return next;
      });
    },
    [inFlightCount, processUpload]
  );

  // When an upload completes, see if any pending uploads can start.
  // Implemented by reading uploads state on each render and starting any
  // pending if slots are free.
  const pendingUploadsAwaitingSlot = uploads.filter(
    (u) => u.status === "pending"
  );
  if (
    pendingUploadsAwaitingSlot.length > 0 &&
    inFlightCount < MAX_CONCURRENT_UPLOADS
  ) {
    const slotsFree = MAX_CONCURRENT_UPLOADS - inFlightCount;
    const toStart = pendingUploadsAwaitingSlot.slice(0, slotsFree);
    queueMicrotask(() => {
      for (const item of toStart) {
        void processUpload(item);
      }
    });
  }

  const handleFiles = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const filesArray = Array.from(filesList);
    enqueueAndProcess(filesArray);
  };

  const dismissUpload = (clientId: string) => {
    setUploads((current) => current.filter((u) => u.clientId !== clientId));
  };

  // Delete an attached image.
  //
  // Optimistic UI: we don't pre-remove the row, because if Cloudinary or the
  // DB rejects the delete the admin should see why and the thumbnail should
  // still be there. Instead we mark the id as "deleting" (dims + disables the
  // button) and then commit the local state change once the Server Action
  // returns success.
  //
  // Hero re-pick mirrors what deleteImage does on the server: if we deleted
  // the current hero AND there's at least one image left, the next one by
  // sort_order ASC becomes hero locally too. Keeps the UI consistent with
  // the DB without a hard refresh.
  const handleDelete = async (imageId: string) => {
    const target = images.find((i) => i.id === imageId);
    if (!target) return;

    const confirmed = window.confirm(
      target.is_hero
        ? "Delete this hero image? The next image will be promoted to hero."
        : "Delete this image?"
    );
    if (!confirmed) return;

    setDeletingIds((current) => {
      const next = new Set(current);
      next.add(imageId);
      return next;
    });

    const result = await deleteImage(imageId);

    if (!result.ok) {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(imageId);
        return next;
      });
      window.alert(`Could not delete: ${result.formError}`);
      return;
    }

    // Success — remove locally and re-pick hero if needed.
    startTransition(() => {
      setImages((current) => {
        const remaining = current.filter((i) => i.id !== imageId);
        if (target.is_hero && remaining.length > 0) {
          const newHeroId = [...remaining].sort(
            (a, b) => a.sort_order - b.sort_order
          )[0].id;
          return remaining.map((i) =>
            i.id === newHeroId ? { ...i, is_hero: true } : i
          );
        }
        return remaining;
      });
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(imageId);
        return next;
      });
    });
  };

  // Promote an image to hero. The previous hero (if any) becomes not-hero.
  //
  // Optimistic UI mirrors what setHeroImage does on the server: locally swap
  // is_hero so the new target shows the badge and the previous hero loses it.
  // On error, revert and alert.
  const handleSetHero = async (imageId: string) => {
    const target = images.find((i) => i.id === imageId);
    if (!target || target.is_hero) return;

    // Snapshot for revert. We only need the id of the previous hero.
    const previousHero = images.find((i) => i.is_hero);

    setSettingHeroIds((current) => {
      const next = new Set(current);
      next.add(imageId);
      return next;
    });

    // Optimistic swap.
    startTransition(() => {
      setImages((current) =>
        current.map((i) => {
          if (i.id === imageId) return { ...i, is_hero: true };
          if (i.is_hero) return { ...i, is_hero: false };
          return i;
        })
      );
    });

    const result = await setHeroImage(imageId);

    if (!result.ok) {
      // Revert the optimistic swap.
      startTransition(() => {
        setImages((current) =>
          current.map((i) => {
            if (i.id === imageId) return { ...i, is_hero: false };
            if (previousHero && i.id === previousHero.id) {
              return { ...i, is_hero: true };
            }
            return i;
          })
        );
      });
      window.alert(`Could not set hero: ${result.formError}`);
    }

    setSettingHeroIds((current) => {
      const next = new Set(current);
      next.delete(imageId);
      return next;
    });
  };

  // Save alt text on blur. Uncontrolled input: we read the event target's
  // current value and compare to what's in state. No-op if unchanged so we
  // don't fire a network call for every focus-lose.
  //
  // On error: revert the input's value to what's in state and alert. We
  // mutate the input element directly because the input is uncontrolled —
  // React isn't managing its value.
  const handleAltTextBlur = async (
    imageId: string,
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    const inputEl = e.currentTarget;
    const newValue = inputEl.value.trim();
    const current = images.find((i) => i.id === imageId);
    if (!current || newValue === current.alt_text) return;

    const result = await updateImageAltText(imageId, newValue);
    if (!result.ok) {
      // Revert the input to the pre-edit value and tell the admin why.
      inputEl.value = current.alt_text;
      window.alert(`Could not save alt text: ${result.formError}`);
      return;
    }

    // Update local state silently. No re-render of the input needed
    // because it's uncontrolled and already holds the new value.
    setImages((images) =>
      images.map((i) =>
        i.id === imageId ? { ...i, alt_text: newValue } : i
      )
    );
  };

  // Drag-and-drop sensors. The 8px activation distance is critical: without
  // it, every click on a thumbnail's child controls (delete X, MAKE HERO bar)
  // would be interpreted as the start of a drag and the click handler would
  // never fire. 8px is enough to make accidental drags very rare while still
  // feeling responsive when a real drag starts.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Snapshot for revert.
    const previous = images;
    const reordered = arrayMove(images, oldIndex, newIndex);

    // Optimistic UI: show the new order immediately.
    startTransition(() => {
      setImages(reordered);
    });

    // Persist. Dense sort_orders 0..N-1 in the new visual order.
    const updates = reordered.map((img, idx) => ({
      id: img.id,
      sort_order: idx,
    }));
    const result = await reorderImages(productId, updates);

    if (!result.ok) {
      // Revert to the pre-drag order.
      startTransition(() => {
        setImages(previous);
      });
      window.alert(`Could not save order: ${result.formError}`);
    }
  };

  return (
    <div>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed px-6 py-12 text-center transition ${
          isDragging
            ? "border-brand-red bg-brand-red/5"
            : "border-rule bg-paper"
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
          Drop images here
        </p>
        <p className="mt-2 text-sm text-ink/60">
          Or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-bold text-brand-red underline underline-offset-2"
          >
            browse files
          </button>
          . JPG, PNG, WebP, GIF, or HEIC up to 15MB each.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(",")}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-6 space-y-2">
          {uploads.map((u) => (
            <li
              key={u.clientId}
              className="flex items-center gap-4 border border-rule bg-paper px-4 py-3"
            >
              <div className="flex-1">
                <p className="text-sm font-bold">{u.file.name}</p>
                {u.status === "uploading" && (
                  <div className="mt-1.5 h-1 w-full bg-rule">
                    <div
                      className="h-1 bg-brand-red transition-all"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                )}
                {u.status === "attaching" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-ink/60">
                    Saving…
                  </p>
                )}
                {u.status === "done" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-ink/40">
                    Uploaded
                  </p>
                )}
                {u.status === "error" && (
                  <p className="mt-1 text-xs font-bold text-brand-red">
                    {u.errorMessage ?? "Failed"}
                  </p>
                )}
                {u.status === "pending" && (
                  <p className="mt-1 text-xs uppercase tracking-widest text-ink/40">
                    Queued
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissUpload(u.clientId)}
                className="text-xs uppercase tracking-widest text-ink/40 hover:text-brand-red"
                aria-label="Dismiss"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <div className="mt-8" suppressHydrationWarning>
          <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Attached ({images.length}) — drag to reorder
          </p>
          {/* suppressHydrationWarning on the wrapper because dnd-kit's
              auto-generated aria-describedby IDs (DndDescribedBy-N) start
              from different counter values on server vs client. This is a
              known dnd-kit + React 19 + Next App Router interaction. The
              mismatch is cosmetic — dnd-kit re-syncs accessibility wiring
              after hydration. We suppress here rather than chase the
              upstream fix so the dev console stays clean for real warnings. */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map((i) => i.id)}
              strategy={rectSortingStrategy}
            >
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {images.map((img) => (
                  <SortableThumbnail
                    key={img.id}
                    img={img}
                    isDeleting={deletingIds.has(img.id)}
                    isSettingHero={settingHeroIds.has(img.id)}
                    onDelete={handleDelete}
                    onSetHero={handleSetHero}
                    onAltTextBlur={handleAltTextBlur}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

