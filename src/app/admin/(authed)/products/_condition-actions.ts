"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  conditionReportSchema,
  conditionReportItemSchema,
  type ConditionReportInput,
  type ConditionReportItemInput,
} from "@/lib/condition-reports/schema";

/**
 * Server Actions for condition reports + their items.
 *
 * Lives under products/ rather than its own group because reports are
 * tightly coupled to one product and authored from the product edit page.
 *
 * Conventions:
 *   - All actions return the standard discriminated union shape.
 *   - upsertConditionReport creates if missing, updates if present.
 *     One report per product (enforced by the unique constraint on
 *     condition_reports.product_id).
 *   - Items are managed as discrete rows. Sort order is set by the
 *     server based on current max(sort_order) for the report, so the
 *     client doesn't need to track it.
 */

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; fieldErrors?: Record<string, string>; formError?: string };

function zodErrorsToFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) result[key] = messages[0];
  }
  return result;
}

/**
 * Create or update the condition report for a product. Idempotent.
 * If no report exists, inserts. If one exists, updates summary + grade.
 */
export async function upsertConditionReport(
  productId: string,
  input: ConditionReportInput
): Promise<ActionResult<{ reportId: string }>> {
  if (!productId) return { ok: false, formError: "Missing product id" };

  const parsed = conditionReportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();

  // Does a report already exist for this product?
  const { data: existing, error: lookupError } = await supabase
    .from("condition_reports")
    .select("id")
    .eq("product_id", productId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, formError: lookupError.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("condition_reports")
      .update({ summary: parsed.data.summary, grade: parsed.data.grade })
      .eq("id", existing.id);
    if (error) return { ok: false, formError: error.message };
    revalidatePath(`/admin/products/${productId}`);
    return { ok: true, data: { reportId: existing.id } };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("condition_reports")
    .insert({
      product_id: productId,
      summary: parsed.data.summary,
      grade: parsed.data.grade,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      formError: insertError?.message ?? "Failed to create report",
    };
  }

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: { reportId: inserted.id } };
}

/**
 * Add one item to a report. sort_order is set server-side to the next
 * available slot so the client never has to think about ordering.
 */
export async function addReportItem(
  reportId: string,
  input: ConditionReportItemInput
): Promise<ActionResult<{ itemId: string }>> {
  if (!reportId) return { ok: false, formError: "Missing report id" };

  const parsed = conditionReportItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();

  // Find the current max sort_order so we can append.
  const { data: maxRow } = await supabase
    .from("condition_report_items")
    .select("sort_order")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("condition_report_items")
    .insert({
      report_id: reportId,
      severity: parsed.data.severity,
      area: parsed.data.area,
      description: parsed.data.description,
      image_id: parsed.data.image_id,
      sort_order: nextSortOrder,
    })
    .select("id, report_id")
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      formError: error?.message ?? "Failed to add item",
    };
  }

  // Look up the product_id so we can revalidate the right page.
  const { data: report } = await supabase
    .from("condition_reports")
    .select("product_id")
    .eq("id", reportId)
    .single();

  if (report?.product_id) {
    revalidatePath(`/admin/products/${report.product_id}`);
  }

  return { ok: true, data: { itemId: inserted.id } };
}

/**
 * Update one item in place. Partial update — the client sends only the
 * fields it wants to change, but we still validate the full shape.
 */
export async function updateReportItem(
  itemId: string,
  input: ConditionReportItemInput
): Promise<ActionResult> {
  if (!itemId) return { ok: false, formError: "Missing item id" };

  const parsed = conditionReportItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: zodErrorsToFieldErrors(parsed.error.flatten().fieldErrors),
    };
  }

  const supabase = await createClient();

  const { data: item, error: lookupError } = await supabase
    .from("condition_report_items")
    .select("id, report_id")
    .eq("id", itemId)
    .single();

  if (lookupError || !item) {
    return { ok: false, formError: "Item not found" };
  }

  const { error } = await supabase
    .from("condition_report_items")
    .update({
      severity: parsed.data.severity,
      area: parsed.data.area,
      description: parsed.data.description,
      image_id: parsed.data.image_id,
    })
    .eq("id", itemId);

  if (error) return { ok: false, formError: error.message };

  // Revalidate via the parent report's product.
  const { data: report } = await supabase
    .from("condition_reports")
    .select("product_id")
    .eq("id", item.report_id)
    .single();

  if (report?.product_id) {
    revalidatePath(`/admin/products/${report.product_id}`);
  }

  return { ok: true };
}

/**
 * Delete one item from a report.
 */
export async function deleteReportItem(
  itemId: string
): Promise<ActionResult> {
  if (!itemId) return { ok: false, formError: "Missing item id" };

  const supabase = await createClient();

  // Look up the parent product first so we can revalidate after the delete.
  const { data: item } = await supabase
    .from("condition_report_items")
    .select("report_id, condition_reports!inner(product_id)")
    .eq("id", itemId)
    .single();

  const { error } = await supabase
    .from("condition_report_items")
    .delete()
    .eq("id", itemId);

  if (error) return { ok: false, formError: error.message };

  // The embedded join returns an array shape in some supabase-js versions.
  // We narrow defensively.
  const productId = Array.isArray(item?.condition_reports)
    ? item?.condition_reports[0]?.product_id
    : (item?.condition_reports as { product_id?: string } | null)?.product_id;

  if (productId) {
    revalidatePath(`/admin/products/${productId}`);
  }

  return { ok: true };
}

/**
 * Import AI-suggested condition observations as draft items.
 *
 * Takes an array of {area, description, image_id, severity} shaped after
 * the AiSuggestion.condition_observations payload (which is strings only),
 * and inserts them as items in the report.
 *
 * The caller chooses the severity per import (we can't infer it from the
 * raw observation text). image_id is also up to the caller — usually
 * passed in based on which image generated the observation.
 */
export async function importObservationsAsItems(
  reportId: string,
  observations: ConditionReportItemInput[]
): Promise<ActionResult<{ inserted: number }>> {
  if (!reportId) return { ok: false, formError: "Missing report id" };
  if (observations.length === 0) {
    return { ok: true, data: { inserted: 0 } };
  }

  // Validate each observation. Bail on the first invalid one and tell the
  // caller which index failed — the UI can map that back to a checkbox.
  for (let i = 0; i < observations.length; i++) {
    const parsed = conditionReportItemSchema.safeParse(observations[i]);
    if (!parsed.success) {
      return {
        ok: false,
        formError: `Observation ${i + 1} is invalid: ${
          parsed.error.issues[0]?.message ?? "validation failed"
        }`,
      };
    }
  }

  const supabase = await createClient();

  // Find the current max sort_order to know where to append.
  const { data: maxRow } = await supabase
    .from("condition_report_items")
    .select("sort_order")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const rows = observations.map((o) => ({
    report_id: reportId,
    severity: o.severity,
    area: o.area,
    description: o.description,
    image_id: o.image_id ?? null,
    sort_order: nextSortOrder++,
  }));

  const { error } = await supabase
    .from("condition_report_items")
    .insert(rows);

  if (error) return { ok: false, formError: error.message };

  // Revalidate via product.
  const { data: report } = await supabase
    .from("condition_reports")
    .select("product_id")
    .eq("id", reportId)
    .single();

  if (report?.product_id) {
    revalidatePath(`/admin/products/${report.product_id}`);
  }

  return { ok: true, data: { inserted: rows.length } };
}

/**
 * Toggle the publish state of a condition report.
 *
 * If the report's published_at is null, sets it to now().
 * If it's already set, clears it back to null (unpublish).
 *
 * The buyer-side query filters on `published_at IS NOT NULL`, so this
 * is the single switch that controls whether a report is buyer-visible.
 *
 * Returns the new published_at so the client can update local state
 * without a refetch.
 */
export async function publishConditionReport(
  reportId: string
): Promise<ActionResult<{ publishedAt: string | null }>> {
  if (!reportId) return { ok: false, formError: "Missing report id" };

  const supabase = await createClient();

  // Read current state so we know whether to publish or unpublish.
  const { data: existing, error: lookupError } = await supabase
    .from("condition_reports")
    .select("id, product_id, published_at")
    .eq("id", reportId)
    .single();

  if (lookupError || !existing) {
    return { ok: false, formError: "Report not found" };
  }

  const nextPublishedAt = existing.published_at
    ? null
    : new Date().toISOString();

  const { error } = await supabase
    .from("condition_reports")
    .update({ published_at: nextPublishedAt })
    .eq("id", reportId);

  if (error) return { ok: false, formError: error.message };

  if (existing.product_id) {
    revalidatePath(`/admin/products/${existing.product_id}`);
  }

  return { ok: true, data: { publishedAt: nextPublishedAt } };
}
