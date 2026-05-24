import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listCustomers,
  CUSTOMER_SORTS,
  DEFAULT_CUSTOMER_SORT,
  type CustomerSort,
  type CustomerRow,
} from "@/lib/customers/fetch";
import { toCsv, csvResponse, type CsvColumn } from "@/lib/customers/csv";

/**
 * Mirror of the list page's sort normaliser. Duplicated here rather
 * than imported because the list page is a separate module and we
 * don't want a circular dep just to share four lines.
 */
function normaliseSort(raw: string | null): CustomerSort {
  if (!raw) return DEFAULT_CUSTOMER_SORT;
  const known = CUSTOMER_SORTS.map((s) => s.value);
  if (known.includes(raw as CustomerSort)) return raw as CustomerSort;
  return DEFAULT_CUSTOMER_SORT;
}

/**
 * Defensive JSONB address parser. Pulls the three address fields we
 * export (postal_code, city, country) from the orders.shipping_address
 * JSONB column. Stripe writes snake_case so the keys are snake_case.
 * Anything missing or non-string returns empty string for that field.
 */
function pickAddressFields(raw: unknown): {
  postcode: string;
  city: string;
  country: string;
} {
  const empty = { postcode: "", city: "", country: "" };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const pick = (key: string): string => {
    const v = obj[key];
    return typeof v === "string" ? v.trim() : "";
  };
  return {
    postcode: pick("postal_code"),
    city: pick("city"),
    country: pick("country"),
  };
}

/**
 * Shape of one CSV row. Columns are locked per Brief 18: customer
 * identity fields, lifecycle dates, totals, marketing consent state,
 * and address fields derived from the latest order's JSONB.
 */
type ExportRow = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  postcode: string;
  city: string;
  country: string;
  first_order_at: string;
  last_order_at: string;
  total_orders: number;
  total_spent_pence: number;
  marketing_consent: string;
  marketing_consent_at: string;
};

const COLUMNS: CsvColumn<ExportRow>[] = [
  { key: "email", label: "Email" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "phone", label: "Phone" },
  { key: "postcode", label: "Postcode" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "first_order_at", label: "First order" },
  { key: "last_order_at", label: "Last order" },
  { key: "total_orders", label: "Total orders" },
  { key: "total_spent_pence", label: "Total spent (pence)" },
  { key: "marketing_consent", label: "Marketing consent" },
  { key: "marketing_consent_at", label: "Consent opted-in" },
];

/**
 * Format an ISO timestamp as ISO date (YYYY-MM-DD) for export. Empty
 * string for null. Dates in CSV are friendlier as ISO than localised
 * because spreadsheet apps re-parse them; keep things unambiguous.
 */
function isoDate(raw: string | null): string {
  if (!raw) return "";
  return raw.slice(0, 10);
}

export async function GET(request: NextRequest) {
  // Belt-and-braces auth check. Proxy already gates /admin/* but a
  // PII-exporting endpoint deserves an explicit boundary check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = (searchParams.get("search") ?? "").trim();
  const sort = normaliseSort(searchParams.get("sort"));

  const { customers, error } = await listCustomers({ search, sort });

  if (error) {
    return NextResponse.json(
      { error: `Could not load customers: ${error}` },
      { status: 500 }
    );
  }

  // Fetch the latest order per customer for address columns. One query,
  // .in() bounded by the (max 500) customer set. We don't need every
  // order \u2014 just the most recent shipping_address per customer \u2014
  // so order DESC by created_at and pick first per customer_id in JS.
  type AddressFields = { postcode: string; city: string; country: string };
  const addressByCustomerId = new Map<string, AddressFields>();

  if (customers.length > 0) {
    const customerIds = customers.map((c: CustomerRow) => c.id);
    const { data: orderRows } = await supabase
      .from("orders")
      .select("customer_id, shipping_address, created_at")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false });

    for (const row of orderRows ?? []) {
      // First (most recent) row per customer wins. Subsequent rows for
      // the same customer are older and skipped.
      if (!addressByCustomerId.has(row.customer_id)) {
        addressByCustomerId.set(
          row.customer_id,
          pickAddressFields(row.shipping_address)
        );
      }
    }
  }

  const rows: ExportRow[] = customers.map((c: CustomerRow) => {
    const addr = addressByCustomerId.get(c.id) ?? {
      postcode: "",
      city: "",
      country: "",
    };
    return {
      email: c.email,
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      phone: c.phone ?? "",
      postcode: addr.postcode,
      city: addr.city,
      country: addr.country,
      first_order_at: isoDate(c.first_order_at),
      last_order_at: isoDate(c.last_order_at),
      total_orders: c.total_orders,
      total_spent_pence: c.total_spent_pence,
      // "yes"/"no" reads better in a spreadsheet than true/false for
      // non-technical users handling the file (e.g. a marketing list).
      marketing_consent: c.marketing_consent ? "yes" : "no",
      marketing_consent_at: isoDate(c.marketing_consent_at),
    };
  });

  const body = toCsv(rows, COLUMNS);
  return csvResponse(body, "customers");
}
