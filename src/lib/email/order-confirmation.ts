import { getResend } from "@/lib/email/client";

/**
 * Order confirmation email — built + sent via Resend.
 *
 * Called by the Stripe webhook route AFTER processCheckoutCompleted
 * has successfully written the order. Best-effort: this function
 * returns a result object and NEVER throws, so an email failure can
 * be logged and swallowed by the caller without triggering a Stripe
 * webhook retry (which would risk duplicate emails — the order write
 * is idempotent, a naive resend is not).
 *
 * Two variants:
 *   - "paid"      → order confirmed, normal dispatch messaging
 *   - "backorder" → payment received, stock being confirmed, NO
 *                   dispatch promise (a shortfall was detected at
 *                   webhook time; admin resolves manually)
 *
 * Email HTML is NOT web HTML: table-based layout, all styles inline,
 * no external CSS, no flexbox/grid. The logo sits on a white panel so
 * it renders in both light and dark mail clients.
 */

// ─────────────────────────────────────────────────────────────
// CONFIG CONSTANTS — swap real values here.
// LOGO_URL: replace with the permanent Cloudinary URL once uploaded.
// Repo-committed / GitHub-raw URLs are fragile for email; Cloudinary
// is the right home. Placeholder below is the GitHub raw fallback.
// ─────────────────────────────────────────────────────────────
const FROM_ADDRESS = "Direct Desk Solutions <orders@directdesksolutions.com>";
const REPLY_TO = "info@directdesksolutions.com";
const LOGO_URL =
  "https://res.cloudinary.com/direct-desk-solutions/image/upload/dds-logo-email.png";
const SHOP_URL = "https://www.directdesksolutions.com";

const BRAND_RED = "#E5202A";
const INK = "#0A0A0A";
const PAPER = "#FAFAF7";
const RULE = "#E8E4DC";

export type OrderConfirmationItem = {
  name: string;
  brand: string | null;
  condition: string | null;
  grade: string | null;
  quantity: number;
  unitPricePence: number;
  lineTotalPence: number;
};

export type OrderConfirmationAddress = {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
} | null;

export type OrderConfirmationPayload = {
  to: string;
  customerName: string | null;
  orderId: string;
  isBackorder: boolean;
  items: OrderConfirmationItem[];
  subtotalPence: number;
  shippingPence: number;
  totalPence: number;
  shippingAddress: OrderConfirmationAddress;
};

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

function formatGBP(pence: number): string {
  return "\u00A3" + (pence / 100).toFixed(2);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function conditionLabel(item: OrderConfirmationItem): string {
  if (item.condition === "used") {
    return item.grade ? "Used \u00B7 Grade " + item.grade : "Used";
  }
  return "New";
}

function shortOrderRef(orderId: string): string {
  // Friendly short reference for the customer — first 8 chars of UUID,
  // uppercased. The full UUID is the real key admin-side.
  return orderId.split("-")[0].toUpperCase();
}

function buildItemRows(items: OrderConfirmationItem[]): string {
  return items
    .map((item) => {
      const brandLine = item.brand
        ? '<div style="color:#666;font-size:13px;margin-top:2px;">' +
          escapeHtml(item.brand) +
          " \u00B7 " +
          conditionLabel(item) +
          "</div>"
        : '<div style="color:#666;font-size:13px;margin-top:2px;">' +
          conditionLabel(item) +
          "</div>";
      return (
        '<tr>' +
        '<td style="padding:14px 0;border-bottom:1px solid ' +
        RULE +
        ';vertical-align:top;">' +
        '<div style="font-weight:600;color:' +
        INK +
        ';font-size:15px;">' +
        escapeHtml(item.name) +
        "</div>" +
        brandLine +
        '<div style="color:#888;font-size:13px;margin-top:4px;">Qty ' +
        item.quantity +
        " \u00D7 " +
        formatGBP(item.unitPricePence) +
        "</div>" +
        "</td>" +
        '<td style="padding:14px 0;border-bottom:1px solid ' +
        RULE +
        ';text-align:right;vertical-align:top;font-weight:600;color:' +
        INK +
        ';font-size:15px;white-space:nowrap;">' +
        formatGBP(item.lineTotalPence) +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function buildAddressBlock(addr: OrderConfirmationAddress): string {
  if (!addr) return "";
  const parts = [
    addr.name,
    addr.line1,
    addr.line2,
    addr.city,
    addr.postalCode,
    addr.country,
  ].filter((p): p is string => Boolean(p && p.trim()));
  if (parts.length === 0) return "";
  return (
    '<div style="margin-top:28px;">' +
    '<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:8px;">Delivery address</div>' +
    '<div style="color:' +
    INK +
    ';font-size:14px;line-height:1.6;">' +
    parts.map((p) => escapeHtml(p)).join("<br>") +
    "</div>" +
    "</div>"
  );
}

function buildHtml(payload: OrderConfirmationPayload): string {
  const greeting = payload.customerName
    ? "Hi " + escapeHtml(payload.customerName.split(/\s+/)[0]) + ","
    : "Hi there,";

  const ref = shortOrderRef(payload.orderId);

  const headline = payload.isBackorder
    ? "We\u2019ve received your order"
    : "Your order is confirmed";

  const intro = payload.isBackorder
    ? "Thanks for your order and payment. One or more items need a quick availability check against our latest stock \u2014 we\u2019ll be in touch very shortly to confirm timings. No action is needed from you right now."
    : "Thanks for your order. We\u2019ve received your payment and are getting it ready. You\u2019ll hear from us again when it\u2019s on its way.";

  const totalsBlock =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">' +
    '<tr><td style="padding:6px 0;color:#666;font-size:14px;">Subtotal</td>' +
    '<td style="padding:6px 0;text-align:right;color:' +
    INK +
    ';font-size:14px;">' +
    formatGBP(payload.subtotalPence) +
    "</td></tr>" +
    '<tr><td style="padding:6px 0;color:#666;font-size:14px;">Shipping</td>' +
    '<td style="padding:6px 0;text-align:right;color:' +
    INK +
    ';font-size:14px;">' +
    (payload.shippingPence === 0 ? "Free" : formatGBP(payload.shippingPence)) +
    "</td></tr>" +
    '<tr><td style="padding:12px 0 0;color:' +
    INK +
    ';font-size:16px;font-weight:700;border-top:2px solid ' +
    INK +
    ';">Total</td>' +
    '<td style="padding:12px 0 0;text-align:right;color:' +
    INK +
    ';font-size:16px;font-weight:700;border-top:2px solid ' +
    INK +
    ';">' +
    formatGBP(payload.totalPence) +
    "</td></tr>" +
    "</table>";

  const fontStack =
    "Archivo,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Order confirmation</title></head>" +
    '<body style="margin:0;padding:0;background:' +
    PAPER +
    ";font-family:" +
    fontStack +
    ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' +
    PAPER +
    ';padding:24px 0;"><tr><td align="center">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ' +
    RULE +
    ';">' +
    // Logo header — white panel
    '<tr><td style="padding:28px 32px;background:#ffffff;border-bottom:1px solid ' +
    RULE +
    ';" align="center">' +
    '<img src="' +
    LOGO_URL +
    '" alt="Direct Desk Solutions" width="200" style="display:block;width:200px;max-width:200px;height:auto;border:0;">' +
    "</td></tr>" +
    // Red accent bar
    '<tr><td style="height:4px;background:' +
    BRAND_RED +
    ";font-size:0;line-height:0;\">&nbsp;</td></tr>" +
    // Body
    '<tr><td style="padding:32px;">' +
    '<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:' +
    BRAND_RED +
    ';font-weight:700;">Order ' +
    ref +
    "</div>" +
    '<h1 style="margin:8px 0 0;font-size:24px;color:' +
    INK +
    ';font-weight:800;">' +
    headline +
    "</h1>" +
    '<p style="margin:20px 0 0;color:' +
    INK +
    ';font-size:15px;line-height:1.6;">' +
    greeting +
    "</p>" +
    '<p style="margin:12px 0 0;color:#444;font-size:15px;line-height:1.6;">' +
    intro +
    "</p>" +
    // Items
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">' +
    buildItemRows(payload.items) +
    "</table>" +
    totalsBlock +
    buildAddressBlock(payload.shippingAddress) +
    // CTA
    '<div style="margin-top:32px;text-align:center;">' +
    '<a href="' +
    SHOP_URL +
    '" style="display:inline-block;background:' +
    INK +
    ";color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;letter-spacing:0.5px;\">Visit Direct Desk Solutions</a>" +
    "</div>" +
    "</td></tr>" +
    // Footer
    '<tr><td style="padding:24px 32px;background:' +
    PAPER +
    ";border-top:1px solid " +
    RULE +
    ';">' +
    '<p style="margin:0;color:#888;font-size:12px;line-height:1.6;">Questions about your order? Just reply to this email and it\u2019ll reach our team.</p>' +
    '<p style="margin:8px 0 0;color:#aaa;font-size:12px;">Direct Desk Solutions \u00B7 New &amp; refurbished office furniture</p>' +
    "</td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

function buildText(payload: OrderConfirmationPayload): string {
  const ref = shortOrderRef(payload.orderId);
  const lines: string[] = [];
  lines.push(payload.isBackorder ? "We've received your order" : "Your order is confirmed");
  lines.push("Order " + ref);
  lines.push("");
  lines.push(
    payload.isBackorder
      ? "Thanks for your order and payment. One or more items need a quick availability check against our latest stock - we'll be in touch shortly to confirm timings."
      : "Thanks for your order. We've received your payment and are getting it ready."
  );
  lines.push("");
  for (const item of payload.items) {
    lines.push(
      "- " +
        item.name +
        " (Qty " +
        item.quantity +
        ") " +
        formatGBP(item.lineTotalPence)
    );
  }
  lines.push("");
  lines.push("Subtotal: " + formatGBP(payload.subtotalPence));
  lines.push("Shipping: " + (payload.shippingPence === 0 ? "Free" : formatGBP(payload.shippingPence)));
  lines.push("Total: " + formatGBP(payload.totalPence));
  lines.push("");
  lines.push("Visit us: " + SHOP_URL);
  lines.push("Questions? Reply to this email.");
  return lines.join("\n");
}

/**
 * Send the order confirmation email. Returns a result object and never
 * throws — the caller logs failures and swallows them.
 */
export async function sendOrderConfirmation(
  payload: OrderConfirmationPayload
): Promise<SendResult> {
  try {
    const subject = payload.isBackorder
      ? "We\u2019ve received your order \u2014 " + shortOrderRef(payload.orderId)
      : "Order confirmed \u2014 " + shortOrderRef(payload.orderId);

    const { data, error } = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: payload.to,
      replyTo: REPLY_TO,
      subject,
      html: buildHtml(payload),
      text: buildText(payload),
    });

    if (error) {
      return { ok: false, error: error.message ?? String(error) };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
