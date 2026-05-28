"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { GalleryToggle, type View } from "./_GalleryToggle";

const STORAGE_KEY = "dds.products.view";
const VIEW_CHANGED_EVENT = "dds:products-view-changed";

// Inline script: runs on initial HTML parse, BEFORE React hydrates and
// BEFORE the [data-view-target] divs are painted. Reads localStorage and
// sets the html dataset so the CSS below picks the right view on first
// paint. After client-side navigation the inline script does not re-run
// (React inserts the node but does not execute inline scripts on hydration),
// so the useEffect inside ViewSwitcher handles that case.
const NO_FLASH_SCRIPT =
  "(function(){try{var v=localStorage.getItem('" +
  STORAGE_KEY +
  "');if(v==='gallery'||v==='table'){document.documentElement.dataset.ddsProductsView=v;}}catch(e){}})();";

// Default: table visible, gallery hidden. Flips when html dataset says
// "gallery". Both server-rendered children sit in the DOM at once; CSS
// toggles display so there is no React-render cost to swap.
const NO_FLASH_STYLE =
  '[data-view-target="gallery"]{display:none}' +
  'html[data-dds-products-view="gallery"] [data-view-target="table"]{display:none}' +
  'html[data-dds-products-view="gallery"] [data-view-target="gallery"]{display:block}';

// External "store" shape for useSyncExternalStore.
// getClientSnapshot reads from localStorage; getServerSnapshot is the
// hydration-safe default (matches what the inline script would produce
// before localStorage is read, so initial paint and hydrated render agree).
function getClientSnapshot(): View {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "table" || v === "gallery") return v;
  } catch {
    // localStorage may be unavailable (private mode etc.) - fall back
  }
  return "table";
}

function getServerSnapshot(): View {
  return "table";
}

/**
 * Subscribe to view-changed notifications. Two sources:
 *   - "storage" event fires when localStorage is mutated in another tab.
 *     Gives cross-tab consistency for free.
 *   - VIEW_CHANGED_EVENT is our own custom event, dispatched from
 *     handleSelect, because the storage event does NOT fire in the tab
 *     that performed the setItem.
 */
function subscribe(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(VIEW_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(VIEW_CHANGED_EVENT, handler);
  };
}

/**
 * Wraps both server-rendered views (table + gallery) and a toggle.
 *
 * Visibility of the two children is governed by an html-element
 * dataset + CSS, not React conditional rendering. Means:
 *   - On initial SSR load, NO_FLASH_SCRIPT sets the dataset before
 *     paint, so the right view paints first.
 *   - On client-side nav (no script re-run) the useEffect below
 *     mirrors `view` into the dataset on mount.
 *
 * The view state itself comes from useSyncExternalStore so we can
 * subscribe to localStorage changes without setState-in-effect.
 */
export function ViewSwitcher({
  table,
  gallery,
}: {
  table: ReactNode;
  gallery: ReactNode;
}) {
  const view = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  // Mirror view into the html dataset on every change. Not setState
  // - just a DOM write, which is what effects are for. Handles the
  // client-side-nav case where the inline script never ran.
  useEffect(() => {
    document.documentElement.dataset.ddsProductsView = view;
  }, [view]);

  function handleSelect(next: View) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore - localStorage may be unavailable
    }
    // Fire our custom event so subscribe() picks up the same-tab change
    // (the "storage" event only fires in OTHER tabs).
    window.dispatchEvent(new Event(VIEW_CHANGED_EVENT));
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      <style dangerouslySetInnerHTML={{ __html: NO_FLASH_STYLE }} />

      <div className="mb-4 flex justify-end">
        <GalleryToggle view={view} onSelect={handleSelect} />
      </div>

      <div data-view-target="table">{table}</div>
      <div data-view-target="gallery">{gallery}</div>
    </>
  );
}
