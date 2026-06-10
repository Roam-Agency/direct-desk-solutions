"use client";

/**
 * Root error boundary — last line of defence for any route without a
 * closer boundary (the authed admin has its own in
 * src/app/admin/(authed)/error.tsx with admin-specific copy).
 *
 * Replaces Next's unbranded "This page couldn't load" default with a
 * branded, recoverable screen. Kept dependency-free (no Logo import —
 * that pulls next/image static imports into an error path that should
 * never itself be able to fail).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-red">
        Direct Desk Solutions
      </p>
      <h1 className="text-3xl font-black tracking-tight text-ink">
        Sorry — something went wrong
      </h1>
      <p className="max-w-md text-sm text-ink/70">
        An unexpected error stopped this page from loading. Reloading
        usually fixes it.
      </p>
      {error.digest && (
        <p className="font-mono text-[10px] text-ink/40">
          Error ref: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-ink px-6 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red"
        >
          Reload page
        </button>
        <button
          type="button"
          onClick={() => reset()}
          className="border border-rule px-6 py-3 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
