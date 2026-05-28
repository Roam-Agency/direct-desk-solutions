import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listOrders,
  ORDER_SORTS,
  DEFAULT_ORDER_SORT,
  ORDER_STATUS_FILTERS,
  type OrderSort,
  type OrderStatusFilter,
  type OrderWithCustomer,
} from "@/lib/orders/fetch";
import { toCsv, csvResponse, type CsvColumn } from "@/lib/customers/csv";

/**
 * Normalisers \u2014 same pattern as the list page and the customers
 * export. Duplicated rather than imported to avoid circular deps.
 */
function normaliseSort(raw: string | null): OrderSort {
  if (!raw) return DEFAULT_ORDER_SORT;
  const known = ORDER_SORTS.map((s) => s.value);
  if (known.includes(raw as OrderSort)) return raw as OrderSort;
  return DEFAULT_ORDER_SORT;
}

function normaliseStatus(raw: string | null): OrderStatusFilter {
  if (!raw) return "all";
  if (ORDER_STATUS_FILTERS.includes(raw as OrderStatusFilter)) {
    return raw as OrderStatusFilter;
  }
  return "all";
}

/**
 * Defensive JSONB address parser. Pulls the three address fields we
 * export (postal_code, city, country) from the orders.shipping_address
 * JSONB column. Stripe writes snake_case keys. We also accept the
 * nested "address" sub-object shape (some Stripe payloads use it) by
 * flattening on the way in.
 */
function pickAddressFields(raw: unknown): {
  postcode: string;
  city: string;
  country: string;
} {
  const empty = { postcode: "", city: "", country: "" };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const src =
    typeof obj.address === "object" && obj.address !== null
      ? { ...obj, ...(obj.address as Record<string, unknown>) }
      : obj;
  const pick = (key: string): string => {
    const v = src[key];
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    postcode: pick("postal_code"),
    city: pick("city"),
    country: pick("country"),
  };
}

/**
 * Format an ISO timestamp as ISO date+time (UTC) for export.
 *
 * Order placed_at and fulfilled_at are timestamps not dates, so we
 * keep the time portion. Empty string for null.
 */
function isoTimestamp(raw: string | null): string {
  if (!raw) return "";
  // Trim microseconds and use a clean "YYYY-MM-DD HH:MM:SS" form
  // for spreadsheet friendliness. Stripping the trailing Z is fine
  // because we never mix timezones \u2014 server is UTC throughout.
  return raw.slice(0, 19).replace("T", " ");
}

function customerNameOf(o: OrderWithCustomer): string {
  if (!o.customer) return "";
  const parts = [o.customer.first_name, o.customer.last_name].filter(
    Boolean
  );
  return parts.join(" ");
}

/**
 * Locked CSV column set per Brief 19 \u00a73. Order is significant:
 * COLUMNS drives both the header row and the row-to-cell projection.
 */
type ExportRow = {
  order_id: string;
  placed_at: string;
  status: string;
  customer_email: string;
  customer_name: string;
  shipping_postcode: string;
  shipping_city: string;
  shipping_country: string;
  subtotal_pence: number;
  shipping_pence: number;
  total_pence: number;
  refunded_pence: number;
  stripe_session_id: string;
  stripe_payment_intent: string;
  fulfilled_at: string;
  notes: string;
};

const COLUMNS: CsvColumn<ExportRow>[] = [
  { key: "order_id", label: "Order ID" },
  { key: "placed_at", label: "Placed at" },
  { key: "status", label: "Status" },
  { key: "customer_email", label: "Customer email" },
  { key: "customer_name", label: "Customer name" },
  { key: "shipping_postcode", label: "Shipping postcode" },
  { key: "shipping_city", label: "Shipping city" },
  { key: "shipping_country", label: "Shipping country" },
  { key: "subtotal_pence", label: "Subtotal (pence)" },
  { key: "shipping_pence", label: "Shipping (pence)" },
  { key: "total_pence", label: "Total (pence)" },
  { key: "refunded_pence", label: "Refunded (pence)" },
  { key: "stripe_session_id", label: "Stripe session" },
  { key: "stripe_payment_intent", label: "Stripe payment intent" },
  { key: "fulfilled_at", label: "Fulfilled at" },
  { key: "notes", label: "Notes" },
];

export async function GET(request: NextRequest) {
  // Belt-and-braces auth check. The proxy already gates /admin/* but
  // a PII-exporting endpoint deserves an explicit boundary check
  // (same pattern as customers export per Brief 19 \u00a73).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = normaliseStatus(searchParams.get("status"));
  const search = (searchParams.get("search") ?? "").trim();
  const sort = normaliseSort(searchParams.get("sort"));

  const { orders, error } = await listOrders({ status, search, sort });

  if (error) {
    return NextResponse.json(
      { error: `Could not load orders: ${error}` },
      { status: 500 }
    );
  }

  const rows: ExportRow[] = orders.map((o) => {
    const addr = pickAddressFields(o.shipping_address);
    return {
      order_id: o.id,
      placed_at: isoTimestamp(o.created_at),
      status: o.status,
      customer_email: o.customer?.email ?? "",
      customer_name: customerNameOf(o),
      shipping_postcode: addr.postcode,
      shipping_city: addr.city,
      shipping_country: addr.country,
      subtotal_pence: o.subtotal_pence,
      shipping_pence: o.shipping_pence,
      total_pence: o.total_pence,
      refunded_pence: o.refunded_pence,
      stripe_session_id: o.stripe_session_id,
      stripe_payment_intent: o.stripe_payment_intent ?? "",
      fulfilled_at: isoTimestamp(o.fulfilled_at),
      notes: o.notes ?? "",
    };
  });

  const body = toCsv(rows, COLUMNS);
  return csvResponse(body, "orders");
}
