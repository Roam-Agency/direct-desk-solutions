/**
 * Turn a thrown Server Action invocation failure into an admin-readable
 * message.
 *
 * Server Actions normally FAIL SOFT in this codebase — they return
 * `{ ok: false, formError }` and never throw. When the `await` itself
 * throws, the request never reached our action code. The two real-world
 * causes:
 *
 *   1. Deployment skew — action IDs are build-specific, so a tab loaded
 *      before a deploy posts IDs the new server doesn't recognise
 *      ("Failed to find Server Action … older or newer deployment").
 *      Fixed by reloading the tab.
 *   2. Network drop mid-request.
 *
 * Without a catch, these propagate to the route's error boundary and
 * blow away the whole form — including everything the admin typed.
 */
export function describeActionFailure(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const isStaleDeployment = /server action|deployment|unexpected response/i.test(
    raw
  );
  if (isStaleDeployment) {
    return (
      "Could not save: a new version of the admin was deployed while this " +
      "page was open. Copy any text you don't want to retype, reload the " +
      "page, and save again."
    );
  }
  return `Could not save — the request didn't reach the server (${raw}). Check your connection and try again.`;
}
