import { Resend } from "resend";

/**
 * Resend client, configured from env vars.
 *
 * --- Why a wrapper module ---
 *   - One place that reads + validates RESEND_API_KEY
 *   - Server-only by construction - the API key never reaches client
 *   - Mirrors the getStripe() lazy pattern in src/lib/stripe/server.ts
 *
 * --- Why lazy-init (getResend) and not a module-level const ---
 * Module-load env reads crash `next build` page-data collection even
 * when env vars are present, because Next evaluates modules before its
 * env loader finishes wiring vars into the worker. The lazy pattern
 * reads env on first call, by which point env is ready. Memoised so we
 * get a single Resend instance per process.
 *
 * --- Env var used (set in .env.local + Netlify) ---
 *   RESEND_API_KEY    server-only, never reaches browser
 */

let memoisedResend: Resend | null = null;

/**
 * Returns a memoised Resend client. Reads RESEND_API_KEY on first call.
 * Throws if the env var is unset at call time.
 */
export function getResend(): Resend {
  if (memoisedResend) return memoisedResend;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set in environment");
  }

  memoisedResend = new Resend(apiKey);
  return memoisedResend;
}
