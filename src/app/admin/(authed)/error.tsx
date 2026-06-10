"use client";

/**
 * Error boundary for the authed admin.
 *
 * Before this existed, ANY uncaught error in an admin page render or a
 * Server Action invocation fell through to Next's built-in error page
 * ("This page couldn't load") — a dead end with no branding, no context,
 * and no recovery hint. The admin who hit it had no idea whether their
 * save landed or what to do next.
 *
 * The most common real-world trigger is deployment skew: server action
 * IDs are build-specific, so a tab loaded before a deploy posts stale
 * action IDs after it ("Failed to find Server Action … older or newer
 * deployment"). That's transient and fully fixed by reloading the tab —
 * so this boundary says exactly that.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleDeployment =
    /server action|deployment/i.test(error.message ?? "");

  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-6 px-4">
      <div className="border-l-2 border-brand-red bg-paper py-1 pl-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-red">
          Something went wrong
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink">
          {isStaleDeployment
            ? "This tab is running an older version of the admin"
            : "The admin hit an unexpected error"}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-ink/70">
          {isStaleDeployment
            ? "A new version was deployed while this page was open, so the server no longer recognises this tab's requests. Reload the page and repeat your last change — nothing was saved."
            : "Your last change may not have been saved. Reload the page to get back to a working state, then check whether the change went through."}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-ink/40">
            Error ref: {error.digest}
          </p>
        )}
      </div>

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
