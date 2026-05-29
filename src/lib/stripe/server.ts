import Stripe from "stripe";

/**
 * Stripe SDK client, configured from env vars.
 *
 * --- Why a wrapper module ---
 *   - One place that reads + validates STRIPE_SECRET_KEY
 *   - Server-only by construction - the SECRET key would not exist on
 *     the client
 *   - Server Actions + the webhook route both import the same instance
 *
 * --- Why lazy-init (getStripe) and not a module-level const ---
 * Module-load throws crash `next build` page-data collection even when
 * env vars are present in .env.local, because Next evaluates modules
 * before its env loader has finished wiring vars into the worker. The
 * lazy pattern reads env on first call, by which point env is ready.
 * Same pattern as getWebhookSecret() below. Memoised on first call so
 * we still get a single Stripe instance per process.
 *
 * --- apiVersion ---
 * NOT explicitly pinned. The SDK default matches the version it was
 * compiled against, so the installed `stripe` package version in
 * package.json is the lock surface. Bumping the SDK is the
 * intentional upgrade; breaking changes surface as TS errors at
 * build time.
 *
 * --- Env vars used (set in .env.local + Netlify) ---
 *   STRIPE_SECRET_KEY              server-only, never reaches browser
 *   DDS_STRIPE_WEBHOOK_SECRET      used by /api/stripe/webhook to verify
 *                                  signed payloads. Set after webhook
 *                                  endpoint is created in Stripe dashboard.
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *                                  public, embedded in client code only
 *                                  if we later add Stripe Elements. With
 *                                  hosted Checkout we redirect to Stripe
 *                                  so this is currently unused - but the
 *                                  accessor is here so it is tracked.
 */

let memoisedStripe: Stripe | null = null;

/**
 * Returns a memoised Stripe client. Reads STRIPE_SECRET_KEY on first
 * call. Throws if the env var is unset at call time.
 */
export function getStripe(): Stripe {
  if (memoisedStripe) return memoisedStripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment");
  }

  memoisedStripe = new Stripe(secretKey, {
    // No explicit apiVersion - SDK default matches package version.
    appInfo: {
      name: "Direct Desk Solutions",
      version: "0.1.0",
    },
  });
  return memoisedStripe;
}

/**
 * Publishable key accessor. Same lazy pattern - read on call, throw
 * if missing. Safe to expose to client components.
 */
export function getStripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in environment"
    );
  }
  return key;
}

/**
 * Webhook secret accessor. Used by /api/stripe/webhook to verify
 * signed payloads. Throws if missing at call time.
 */
export function getWebhookSecret(): string {
  const secret = process.env.DDS_STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("DDS_STRIPE_WEBHOOK_SECRET is not set in environment");
  }
  return secret;
}
