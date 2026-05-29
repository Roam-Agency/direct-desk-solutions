import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Financial overview for the admin dashboard.
 *
 * Two independent groups, deliberately sourced differently:
 *
 *   sales  - derived from our own `orders` table. Answers "how is the
 *            shop performing": gross paid sales, refunds, net revenue,
 *            paid-order count and AOV over a rolling 30-day window
 *            (keyed on paid_at). Instant, no external dependency.
 *
 *   cash   - pulled live from Stripe. Answers "what is actually moving
 *            through the processor": available + pending balance and the
 *            most recent payout. Network-bound and may fail (missing key,
 *            test-mode quirks) so it is isolated in its own try/catch and
 *            returns null on any error - the dashboard still renders.
 *
 * All monetary values are integer pence, matching the rest of the app.
 */

const WINDOW_DAYS = 30;

export type SalesOverview = {
  grossPence: number;
  refundsPence: number;
  netPence: number;
  paidOrderCount: number;
  avgOrderPence: number;
  windowDays: number;
};

export type CashOverview = {
  availablePence: number;
  pendingPence: number;
  currency: string;
  lastPayoutPence: number | null;
  lastPayoutArrival: string | null;
};

export type FinancialOverview = {
  sales: SalesOverview;
  cash: CashOverview | null;
  testMode: boolean;
};

/**
 * Sum the GBP entries of a Stripe balance bucket (available/pending) into
 * pence. Stripe returns an array of per-currency amounts; we only surface
 * GBP. Amounts are already in the currency's minor unit (pence for GBP).
 */
function sumGbp(
  entries: Array<{ amount: number; currency: string }> | undefined
): number {
  if (!entries) return 0;
  let total = 0;
  for (const e of entries) {
    if (e.currency === "gbp") total += e.amount;
  }
  return total;
}

/**
 * Sales half - one Supabase query, derived in a single JS pass mirroring
 * the catalogue-stats block on the dashboard. Counts only orders that have
 * actually been paid (paid_at IS NOT NULL) within the window. Refunds are
 * read from refunded_pence on those same orders.
 */
async function getSalesOverview(): Promise<SalesOverview> {
  const supabase = await createClient();
  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data } = await supabase
    .from("orders")
    .select("total_pence, refunded_pence, paid_at")
    .not("paid_at", "is", null)
    .gte("paid_at", since);

  const rows = data ?? [];
  let grossPence = 0;
  let refundsPence = 0;
  let paidOrderCount = 0;
  for (const r of rows) {
    grossPence += r.total_pence ?? 0;
    refundsPence += r.refunded_pence ?? 0;
    paidOrderCount += 1;
  }
  const netPence = grossPence - refundsPence;
  const avgOrderPence =
    paidOrderCount > 0 ? Math.round(grossPence / paidOrderCount) : 0;

  return {
    grossPence,
    refundsPence,
    netPence,
    paidOrderCount,
    avgOrderPence,
    windowDays: WINDOW_DAYS,
  };
}

/**
 * Cash half - Stripe balance + latest payout. Isolated: any throw returns
 * null so the dashboard degrades gracefully rather than blanking.
 */
async function getCashOverview(): Promise<CashOverview | null> {
  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve();
    const payouts = await stripe.payouts.list({ limit: 1 });
    const latest = payouts.data[0];

    return {
      availablePence: sumGbp(balance.available),
      pendingPence: sumGbp(balance.pending),
      currency: "gbp",
      lastPayoutPence: latest ? latest.amount : null,
      lastPayoutArrival: latest
        ? new Date(latest.arrival_date * 1000).toISOString()
        : null,
    };
  } catch {
    return null;
  }
}

/**
 * Detect Stripe test mode from the secret key prefix. Used only to flag the
 * UI - never to gate behaviour. Defaults to true (safer: shows the caveat)
 * when the key is unreadable.
 */
function isTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return true;
  return key.startsWith("sk_test_");
}

/**
 * Public entry point. Runs the sales query and the Stripe call concurrently;
 * the Stripe half can never reject (it catches internally) so Promise.all is
 * safe here.
 */
export async function getFinancialOverview(): Promise<FinancialOverview> {
  const [sales, cash] = await Promise.all([
    getSalesOverview(),
    getCashOverview(),
  ]);
  return { sales, cash, testMode: isTestMode() };
}
