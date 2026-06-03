import Logo from "./(public)/_Logo";

/**
 * Full-screen branded loading state.
 *
 * Shown as the Suspense fallback (via loading.tsx) while a route's server
 * component streams in, and as a sensible holding screen on slow first
 * loads. Renders on the brand `paper` background with the logo and a
 * spinner so a cold load reads as "the app is starting", not a blank
 * (black, in dark mode) browser default.
 *
 * Server component — no client JS needed; the spinner is a CSS animation.
 */
export default function BrandLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-paper">
      <Logo variant="dark" className="h-9 w-auto" preload />
      <span
        role="status"
        aria-label="Loading"
        className="block h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-brand-red"
      />
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink/40">
        Loading…
      </p>
    </div>
  );
}
