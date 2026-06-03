import BrandLoader from "../_BrandLoader";

// Suspense fallback for the public route group — shown while a page's
// server component streams in. Replaces the blank/black first paint with
// the branded loader.
export default function Loading() {
  return <BrandLoader />;
}
