import BrandLoader from "@/app/_BrandLoader";

// Suspense fallback for the authed admin — shown while a page's server
// component (and its Supabase reads) streams in, instead of a blank screen.
export default function Loading() {
  return <BrandLoader />;
}
