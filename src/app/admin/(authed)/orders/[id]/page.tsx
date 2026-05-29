import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOrderById,
  getLineItemsForOrder,
} from "@/lib/orders/fetch";
import { formatPence } from "@/lib/products/format";
import OrderActions from "./_OrderActions";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

const DATETIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(iso: string | null): string {
  if (!iso) return "\u2014";
  return DATETIME_FORMAT.format(new Date(iso));
}

function customerName(c: {
  first_name: string | null;
  last_name: string | null;
} | null): string {
  if (!c) return "\u2014";
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "\u2014";
}

/**
 * Parse a Stripe-style JSONB address into a normalised shape with
 * empty-string defaults. Stripe writes snake_case keys, including a
 * nested "address" sub-object in some shipping_details shapes. We
 * accept both flat (Brief 17 webhook writes the flat shape) and
 * nested forms defensively.
 */
type Address = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

function parseAddress(raw: unknown): Address | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  // Some Stripe shapes nest under .address; flatten if so.
  const src =
    typeof obj.address === "object" && obj.address !== null
      ? { ...obj, ...(obj.address as Record<string, unknown>) }
      : obj;
  const pick = (key: string): string => {
    const v = src[key];
    return typeof v === "string" ? v.trim() : "";
  };
  const name = pick("name");
  const line1 = pick("line1");
  const line2 = pick("line2");
  const city = pick("city");
  const state = pick("state");
  const postal_code = pick("postal_code");
  const country = pick("country");
  // If nothing parsed, treat as missing.
  if (
    !name &&
    !line1 &&
    !line2 &&
    !city &&
    !state &&
    !postal_code &&
    !country
  ) {
    return null;
  }
  return { name, line1, line2, city, state, postal_code, country };
}

/**
 * Build a Stripe dashboard URL for a session or payment intent. The
 * Stripe ID prefix tells us whether to use the live or test path.
 *   cs_live_..., pi_live_...  -> dashboard.stripe.com/sessions/...
 *   cs_test_..., pi_test_...  -> dashboard.stripe.com/test/sessions/...
 */
function stripeDashboardUrl(
  id: string,
  kind: "sessions" | "payments"
): string {
  const isTest = id.includes("_test_");
  const base = isTest
    ? "https://dashboard.stripe.com/test"
    : "https://dashboard.stripe.com";
  return `${base}/${kind}/${id}`;
}

function statusBadgeClasses(status: string): string {
  const base =
    "inline-block border px-3 py-1 text-xs font-bold uppercase tracking-widest";
  if (status === "backorder") {
    return `${base} border-brand-red bg-brand-red text-paper`;
  }
  if (status === "paid") {
    return `${base} border-ink bg-ink text-paper`;
  }
  if (status === "fulfilled") {
    return `${base} border-ink/40 bg-ink/10 text-ink`;
  }
  if (status === "refunded" || status === "cancelled") {
    return `${base} border-rule bg-paper text-ink/50`;
  }
  return `${base} border-rule bg-paper text-ink/70`;
}

/**
 * Inline product condition badge text for the line item rows.
 *
 * Used items render "USED \u00b7 GRADE B" (or just "USED" if grade is
 * absent). New items render nothing \u2014 the row's brand+name
 * carries enough signal on its own.
 */
function lineItemConditionBadge(
  condition: "new" | "used",
  grade: "A" | "B" | "C" | null
): string {
  if (condition !== "used") return "";
  if (grade === null) return "USED";
  return `USED \u00b7 GRADE ${grade}`;
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) {
    notFound();
  }
  const { items, error: itemsError } = await getLineItemsForOrder(id);

  const shipping = parseAddress(order.shipping_address);
  const billing = parseAddress(order.billing_address);

  return (
    <div className="space-y-8">
      {/* Back link */}
      <div>
        <Link
          href="/admin/orders"
          className="text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-brand-red">
          {"\u2190 All orders"}
        </Link>
      </div>

      {/* Header: order ID + status + customer link */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Order <span className="font-mono text-xl">{order.id.slice(0, 8)}</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-ink/40">{order.id}</p>
          <div className="mt-3 flex items-center gap-4">
            <span className={statusBadgeClasses(order.status)}>
              {order.status}
            </span>
            {order.customer && (
              <Link
                href={`/admin/customers/${order.customer.id}`}
                className="text-sm text-ink transition hover:text-brand-red">
                <span className="font-bold">{order.customer.email}</span>
                <span className="ml-2 text-ink/60">
                  {customerName(order.customer)}
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Fulfilment toggle + notes live in the client component below
            the line items. Header keeps just the identity + status. */}
      </div>

      {/* Timeline + totals grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="border border-rule bg-paper p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Timeline
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">Placed</dt>
              <dd className="tabular-nums">{formatDateTime(order.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Paid</dt>
              <dd className="tabular-nums">{formatDateTime(order.paid_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Fulfilled</dt>
              <dd className="tabular-nums">{formatDateTime(order.fulfilled_at)}</dd>
            </div>
          </dl>
        </div>

        <div className="border border-rule bg-paper p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Totals
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">Subtotal</dt>
              <dd className="tabular-nums">{formatPence(order.subtotal_pence)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Shipping</dt>
              <dd className="tabular-nums">{formatPence(order.shipping_pence)}</dd>
            </div>
            {order.refunded_pence > 0 && (
              <div className="flex justify-between text-brand-red">
                <dt>Refunded</dt>
                <dd className="tabular-nums">
                  -{formatPence(order.refunded_pence)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-rule pt-2 font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPence(order.total_pence)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Line items */}
      <div className="border border-rule bg-paper">
        <h2 className="border-b border-rule px-6 py-4 text-xs font-bold uppercase tracking-widest text-ink/60">
          Line items
        </h2>
        {itemsError && (
          <div className="border-b border-rule bg-brand-red/10 px-6 py-3 text-sm text-ink">
            Could not load line items: {itemsError}
          </div>
        )}
        {!itemsError && items.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-ink/60">
            No line items recorded for this order.
          </div>
        )}
        {!itemsError && items.length > 0 && (
          <table className="min-w-full divide-y divide-rule">
            <thead className="bg-ink/5">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                  Product
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  Unit price
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  Qty
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {items.map((it) => {
                const conditionLabel = lineItemConditionBadge(
                  it.product_condition,
                  it.product_grade
                );
                return (
                  <tr key={it.id}>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-bold text-ink">
                        {it.product_name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/60">
                        {it.product_brand && (
                          <span>{it.product_brand}</span>
                        )}
                        {it.product_brand && (
                          <span className="text-ink/30">{"\u00b7"}</span>
                        )}
                        <span className="font-mono">SKU {it.product_sku}</span>
                        {conditionLabel && (
                          <span className="border border-ink/40 bg-ink/5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-ink">
                            {conditionLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums">
                      {formatPence(it.unit_price_pence)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold tabular-nums">
                      {formatPence(it.line_total_pence)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="border border-rule bg-paper p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Shipping address
          </h2>
          {shipping ? (
            <address className="mt-4 text-sm not-italic leading-relaxed text-ink">
              {shipping.name && <div className="font-bold">{shipping.name}</div>}
              {shipping.line1 && <div>{shipping.line1}</div>}
              {shipping.line2 && <div>{shipping.line2}</div>}
              {(shipping.city || shipping.state) && (
                <div>
                  {[shipping.city, shipping.state].filter(Boolean).join(", ")}
                </div>
              )}
              {shipping.postal_code && <div>{shipping.postal_code}</div>}
              {shipping.country && <div>{shipping.country}</div>}
            </address>
          ) : (
            <p className="mt-4 text-sm text-ink/40">No shipping address.</p>
          )}
        </div>

        <div className="border border-rule bg-paper p-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Billing address
          </h2>
          {billing ? (
            <address className="mt-4 text-sm not-italic leading-relaxed text-ink">
              {billing.name && <div className="font-bold">{billing.name}</div>}
              {billing.line1 && <div>{billing.line1}</div>}
              {billing.line2 && <div>{billing.line2}</div>}
              {(billing.city || billing.state) && (
                <div>
                  {[billing.city, billing.state].filter(Boolean).join(", ")}
                </div>
              )}
              {billing.postal_code && <div>{billing.postal_code}</div>}
              {billing.country && <div>{billing.country}</div>}
            </address>
          ) : (
            <p className="mt-4 text-sm text-ink/40">
              Same as shipping (or not collected).
            </p>
          )}
        </div>
      </div>

      {/* Stripe references */}
      <div className="border border-rule bg-paper p-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
          Stripe references
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-baseline gap-3">
            <dt className="text-ink/60">Session</dt>
            <dd>
              <a
                href={stripeDashboardUrl(order.stripe_session_id, "sessions")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-ink underline transition hover:text-brand-red">
                {order.stripe_session_id} {"\u2197"}
              </a>
            </dd>
          </div>
          {order.stripe_payment_intent && (
            <div className="flex flex-wrap items-baseline gap-3">
              <dt className="text-ink/60">Payment intent</dt>
              <dd>
                <a
                  href={stripeDashboardUrl(order.stripe_payment_intent, "payments")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-ink underline transition hover:text-brand-red">
                  {order.stripe_payment_intent} {"\u2197"}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Fulfilment toggle + notes editor (client component) */}
      <OrderActions
        orderId={order.id}
        status={order.status}
        initialNotes={order.notes ?? ""}
        totalPence={order.total_pence}
        refundedPence={order.refunded_pence}
        hasPaymentIntent={Boolean(order.stripe_payment_intent)}
      />
    </div>
  );
}
