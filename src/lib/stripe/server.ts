import Stripe from "stripe";

/**
 * Stripe SDK client, configured from env vars.
 *
 * Why a wrapper module:
 *   - One place that reads + validates STRIPE_SECRET_KEY (fail fast)
 *   - Server-only by construction — the SECRET key would throw here on
 *     the client where it is absent
 *   - Server Actions + the webhook route both import the same instance
 *
 * apiVersion is pinned. Without an explicit version Stripe uses the
 * account's default, which can be changed in the dashboard. Pinning
 * makes API schema changes intentional rather than surprising.
 *
 * Env vars used (set in .env.local + Netlify):
 *   STRIPE_SECRET_KEY              server-only, never reaches browser
 *   STRIPE_WEBHOOK_SECRET          used by /api/stripe/webhook to verify
 *                                  signed payloads. Set after webhook
 *                                  endpoint is created in Stripe dashboard.
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *                                  public, embedded in client code only if
 *                                  we add Elements / payment-method
 *                                  collection on our own pages. With Stripe
 *                                  hosted Checkout we redirect to Stripe so
 *                                  this is unused in Session 10 — but
 *                                  declared here so it's tracked.
 */

const secretKey = process.env.STRIPE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment");
}
if (!publishableKey) {
  throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set in environment");
}

export const stripe = new Stripe(secretKey, {
  // No explicit apiVersion pin. The SDK defaults to the API version
  // it was compiled against (matching the installed `stripe` package).
  // Upgrade discipline: bumping `stripe` in package.json is the
  // intentional upgrade, and our TypeScript types come from the same
  // package, so breaking API changes surface as type errors at build
  // time rather than runtime surprises.

  // Type the integration so Stripe logs attribute usage to us.
  appInfo: {
    name: "Direct Desk Solutions",
    version: "0.1.0",
  },
});

/**
 * Publishable key re-exported for client components that need it
 * (e.g. if we later add Stripe Elements). Safe to expose.
 */
export const STRIPE_PUBLISHABLE_KEY = publishableKey;

/**
 * Webhook secret. Read lazily inside the webhook route, NOT at module
 * load, so the SDK module remains usable in environments that don't
 * have a webhook configured yet (e.g. local dev before stripe listen
 * starts). The route handler throws if missing at request time.
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set in environment");
  }
  return secret;
}
