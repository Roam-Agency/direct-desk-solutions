import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomerById,
  getOrdersForCustomer,
  type OrderRow,
} from "@/lib/customers/fetch";
import { formatPence } from "@/lib/products/format";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });
const DATETIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014";
  return DATE_FORMAT.format(new Date(iso));
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "\u2014";
  return DATETIME_FORMAT.format(new Date(iso));
}

/**
 * Narrow runtime parser for a Stripe-shaped address stored as JSONB.
 *
 * The DB column is typed as `Json | null` because Supabase doesn't
 * project JSONB structure into TS. The webhook writes
 * session.customer_details.address which is Stripe's Address type:
 *
 *   { line1, line2, city, postal_code, state, country }
 *
 * Any field can be null, the whole object can be null, and the row
 * can predate the webhook so the column itself can be missing the
 * expected keys. Return only the keys that come through as
 * non-empty strings; everything else is treated as absent.
 */
type ParsedAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  country?: string;
};

function parseAddress(raw: unknown): ParsedAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const pickString = (key: string): string | undefined => {
    const v = obj[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
  };
  const parsed: ParsedAddress = {
    line1: pickString("line1"),
    line2: pickString("line2"),
    city: pickString("city"),
    postalCode: pickString("postal_code"),
    state: pickString("state"),
    country: pickString("country"),
  };
  // If every field is undefined, return null \u2014 nothing to display.
  const hasAny = Object.values(parsed).some((v) => v !== undefined);
  return hasAny ? parsed : null;
}

/**
 * Status pill: small coloured dot + label. The brand palette is red
 * and ink only, so we lean on tone (full ink, mid ink, brand red)
 * to differentiate the six order statuses rather than reach for new
 * colours.
 *
 *   paid / fulfilled     \u2192 ink (settled, good)
 *   pending / backorder  \u2192 ink at 40% (in-flight, attention)
 *   cancelled / refunded \u2192 brand-red (terminated, attention)
 */
function StatusBadge({ status }: { status: OrderStatus }) {
  const dotClass =
    status === "paid" || status === "fulfilled"
      ? "bg-ink"
      : status === "cancelled" || status === "refunded"
        ? "bg-brand-red"
        : "bg-ink/40";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span className="text-xs font-bold uppercase tracking-widest">
        {status}
      </span>
    </span>
  );
}

function customerDisplayName(c: {
  first_name: string | null;
  last_name: string | null;
}): string {
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "\u2014";
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const { orders } = await getOrdersForCustomer(customer.id);

  // Latest order is index 0 (newest first per fetch helper). Use its
  // shipping address as the "current" address \u2014 customers can change
  // address between orders, so we don't fabricate a canonical one.
  const latestOrder: OrderRow | undefined = orders[0];
  const latestAddress = latestOrder
    ? parseAddress(latestOrder.shipping_address)
    : null;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/admin/customers"
        className="inline-block text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-brand-red"
      >
        \u2190 Back to customers
      </Link>

      {/* Header */}
      <div className="border-b border-rule pb-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight break-words">
              {customer.email}
            </h1>
            <p className="mt-2 text-sm text-ink/80">
              {customerDisplayName(customer)}
            </p>
          </div>
          {customer.marketing_consent && (
            <div className="border border-brand-red bg-brand-red/10 px-3 py-2 text-right">
              <div className="text-xs font-bold uppercase tracking-widest text-brand-red">
                Marketing opt-in
              </div>
              <div className="mt-1 text-xs text-ink/60 tabular-nums">
                {formatDate(customer.marketing_consent_at)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aggregates strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border border-rule bg-paper px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Total orders
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums">
            {customer.total_orders}
          </div>
        </div>
        <div className="border border-rule bg-paper px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Lifetime spend
          </div>
          <div className="mt-1 text-2xl font-black tabular-nums">
            {formatPence(customer.total_spent_pence)}
          </div>
        </div>
        <div className="border border-rule bg-paper px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-widest text-ink/60">
            First order
          </div>
          <div className="mt-1 text-base font-bold tabular-nums">
            {formatDate(customer.first_order_at)}
          </div>
        </div>
        <div className="border border-rule bg-paper px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Most recent
          </div>
          <div className="mt-1 text-base font-bold tabular-nums">
            {formatDate(customer.last_order_at)}
          </div>
        </div>
      </div>

      {/* Contact + Latest address \u2014 two-column on desktop */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="border border-rule bg-paper p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Contact
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink/60">Email</dt>
              <dd className="min-w-0 break-all text-right font-bold">
                {customer.email}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/60">Phone</dt>
              <dd className="font-bold tabular-nums">
                {customer.phone ?? "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink/60">Customer since</dt>
              <dd className="font-bold tabular-nums">
                {formatDate(customer.created_at)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border border-rule bg-paper p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
            Latest shipping address
          </h2>
          {latestAddress ? (
            <address className="mt-3 not-italic text-sm leading-relaxed">
              {latestAddress.line1 && <div>{latestAddress.line1}</div>}
              {latestAddress.line2 && <div>{latestAddress.line2}</div>}
              {latestAddress.city && <div>{latestAddress.city}</div>}
              {latestAddress.postalCode && (
                <div className="tabular-nums">{latestAddress.postalCode}</div>
              )}
              {latestAddress.state && <div>{latestAddress.state}</div>}
              {latestAddress.country && <div>{latestAddress.country}</div>}
              <div className="mt-2 text-xs text-ink/60">
                From order <span className="tabular-nums">#{latestOrder?.id.slice(0, 8)}</span> on {formatDate(latestOrder?.created_at ?? null)}
              </div>
            </address>
          ) : (
            <p className="mt-3 text-sm text-ink/60">
              No shipping address on file.
            </p>
          )}
        </div>
      </div>

      {/* Order history */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
          Order history
        </h2>
        {orders.length === 0 ? (
          <div className="mt-3 border border-rule bg-paper px-6 py-8 text-center text-sm text-ink/60">
            No orders yet.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto border border-rule">
            <table className="min-w-full divide-y divide-rule">
              <thead className="bg-ink/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                    Placed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-ink/60">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-ink/60">
                    Refunded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule bg-paper">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-sm font-bold tabular-nums">
                      #{o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink/80 tabular-nums">
                      {formatDateTime(o.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                      {formatPence(o.total_pence)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-ink/60 tabular-nums">
                      {o.refunded_pence > 0 ? formatPence(o.refunded_pence) : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
