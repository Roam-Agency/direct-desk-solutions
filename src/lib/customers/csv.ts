/**
 * CSV utilities for admin exports.
 *
 * Tiny, no-dependency RFC 4180 implementation. Used by the customers
 * CSV export route (/admin/customers/export.csv). Likely the seed
 * for other admin exports in future (orders, products).
 *
 * Excel mangling defences:
 *   - UTF-8 BOM prefix so Excel auto-detects the encoding instead of
 *     guessing Windows-1252 (which corrupts \u00a3 and other non-ASCII).
 *   - Numeric columns are emitted as plain numbers, not currency
 *     strings — Excel does its own formatting on a number column,
 *     and a "\u00a35.00" string in a column ruins sorting.
 *   - Cells that begin with =, +, -, @ get a leading apostrophe so
 *     Excel does not interpret them as formulas (CSV-injection guard).
 */

const BOM = "\uFEFF";

/**
 * RFC 4180 cell encoding: wrap in double quotes if the cell contains
 * a comma, quote, CR or LF. Double up any internal quotes.
 */
function encodeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);

  // Formula-injection guard. Any cell starting with =, +, -, @ when
  // opened in Excel/Sheets is treated as a formula.
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }

  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Serialise an array of row objects to a CSV string.
 *
 * `headers` controls both the column order AND which keys are included.
 * Keys not in `headers` are dropped from the output. Header order is
 * the source of truth — callers don't pass row keys, they pass the
 * column spec they want.
 *
 * Example:
 *   toCsv(
 *     [{ email: "a@b.com", total: 49900 }],
 *     [
 *       { key: "email", label: "Email" },
 *       { key: "total", label: "Total (pence)" },
 *     ]
 *   )
 *   // \ufeffEmail,Total (pence)\r\na@b.com,49900\r\n
 */
export interface CsvColumn<Row> {
  key: keyof Row;
  label: string;
}

export function toCsv<Row extends Record<string, unknown>>(
  rows: Row[],
  columns: CsvColumn<Row>[]
): string {
  const headerLine = columns.map((c) => encodeCell(c.label)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => encodeCell(row[c.key])).join(",")
  );
  // CRLF per RFC 4180 \u00a72.1
  return BOM + [headerLine, ...dataLines].join("\r\n") + "\r\n";
}

/**
 * Build a Response that triggers a browser download.
 *
 * Filename is the supplied stem plus today's ISO date, e.g.
 * "customers-2026-05-24.csv". Stem must be filename-safe.
 */
export function csvResponse(body: string, filenameStem: string): Response {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${filenameStem}-${today}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Caching off — exports are point-in-time snapshots.
      "Cache-Control": "no-store",
    },
  });
}
