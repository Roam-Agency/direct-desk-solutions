"use client";

import { useState } from "react";
import type { Database } from "@/types/database";
import {
  upsertConditionReport,
  addReportItem,
  updateReportItem,
  deleteReportItem,
  importObservationsAsItems,
  publishConditionReport,
} from "./_condition-actions";

type ConditionReportRow =
  Database["public"]["Tables"]["condition_reports"]["Row"];
type ConditionReportItemRow =
  Database["public"]["Tables"]["condition_report_items"]["Row"];
type ProductImageRow =
  Database["public"]["Tables"]["product_images"]["Row"];
type Severity =
  Database["public"]["Enums"]["condition_severity"];
type Grade =
  Database["public"]["Enums"]["product_grade"];

const SEVERITIES: Severity[] = [
  "faultless",
  "light",
  "moderate",
  "significant",
];

const SEVERITY_COLOUR: Record<Severity, string> = {
  faultless: "text-emerald-700 bg-emerald-50 border-emerald-200",
  light: "text-amber-700 bg-amber-50 border-amber-200",
  moderate: "text-orange-700 bg-orange-50 border-orange-200",
  significant: "text-red-700 bg-red-50 border-red-200",
};


/**
 * Shape of a single condition observation as Claude returns it. The
 * field is jsonb in the database, so we narrow defensively.
 */
type AiObservation = {
  area: string;
  description: string;
  severity?: Severity;
};

/**
 * Extract a flat list of {imageId, area, description, severity} from
 * the array of attached images. Each image\u2019s ai_suggestions.condition_observations
 * contributes zero-or-more rows. severity defaults to "light" if Claude
 * didn\u2019t include one (the AI prompt asks for it but we don\u2019t require it).
 */
function extractObservations(
  images: ProductImageRow[]
): Array<{
  imageId: string;
  area: string;
  description: string;
  severity: Severity;
}> {
  const out: Array<{
    imageId: string;
    area: string;
    description: string;
    severity: Severity;
  }> = [];
  for (const img of images) {
    const ai = img.ai_suggestions;
    if (!ai || typeof ai !== "object") continue;
    const obs = (ai as { condition_observations?: unknown }).condition_observations;
    if (!Array.isArray(obs)) continue;
    for (const o of obs) {
      if (
        typeof o === "object" &&
        o !== null &&
        typeof (o as AiObservation).area === "string" &&
        typeof (o as AiObservation).description === "string"
      ) {
        const cand = o as AiObservation;
        const sev: Severity =
          cand.severity && SEVERITIES.includes(cand.severity)
            ? cand.severity
            : "light";
        out.push({
          imageId: img.id,
          area: cand.area,
          description: cand.description,
          severity: sev,
        });
      }
    }
  }
  return out;
}

/**
 * Condition report authoring section.
 *
 * Three pieces:
 *   1. Header form: summary + grade. Auto-saves on blur via
 *      upsertConditionReport. Creates the report if none exists yet.
 *   2. Items list: existing observations, each editable in place.
 *      Delete buttons inline.
 *   3. Add-item row at the bottom.
 *
 * Local state mirrors the server. After each successful action, the
 * parent edit page is revalidated by the action itself, so the
 * next navigation/refresh has authoritative data. The optimistic
 * local updates keep the UI feeling snappy in the meantime.
 */
export function ConditionReportSection({
  productId,
  initialReport,
  initialReportItems,
  attachedImages,
}: {
  productId: string;
  initialReport: ConditionReportRow | null;
  initialReportItems: ConditionReportItemRow[];
  attachedImages: ProductImageRow[];
}) {
  const [report, setReport] = useState<ConditionReportRow | null>(initialReport);
  const [items, setItems] = useState<ConditionReportItemRow[]>(initialReportItems);
  const [summary, setSummary] = useState(initialReport?.summary ?? "");
  const [grade, setGrade] = useState<Grade | "">(
    initialReport?.grade ?? ""
  );
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const imageById = new Map(attachedImages.map((i) => [i.id, i]));

  // ---------- AI observations import ----------
  const aiObservations = extractObservations(attachedImages);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [perRowSeverity, setPerRowSeverity] = useState<Map<number, Severity>>(
    () => new Map(aiObservations.map((o, i) => [i, o.severity]))
  );
  const [importing, setImporting] = useState(false);

  function toggleSelected(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function setRowSeverity(index: number, severity: Severity) {
    setPerRowSeverity((current) => {
      const next = new Map(current);
      next.set(index, severity);
      return next;
    });
  }

  async function handleImportSelected() {
    if (selected.size === 0) return;

    // Same as handleAddItem: create the report if absent.
    let reportId = report?.id;
    if (!reportId) {
      const createResult = await upsertConditionReport(productId, {
        summary: null,
        grade: null,
      });
      if (!createResult.ok) {
        window.alert(
          `Could not create report: ${createResult.formError ?? "validation failed"}`
        );
        return;
      }
      reportId = createResult.data.reportId;
      setReport({
        id: reportId,
        product_id: productId,
        summary: null,
        grade: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: null,
      });
    }

    const payload = Array.from(selected).map((i) => {
      const o = aiObservations[i];
      return {
        severity: perRowSeverity.get(i) ?? o.severity,
        area: o.area,
        description: o.description,
        image_id: o.imageId,
        sort_order: 0,
      };
    });

    setImporting(true);
    try {
      const result = await importObservationsAsItems(reportId, payload);
      if (!result.ok) {
        window.alert(
          `Could not import observations: ${result.formError ?? "validation failed"}`
        );
        return;
      }
      // Reflect optimistically. revalidatePath in the action gives us
      // authoritative ids on the next nav/refresh.
      const baseSortOrder = items.length;
      setItems((current) => [
        ...current,
        ...payload.map((p, idx) => ({
          id: `tmp-${Date.now()}-${idx}`,
          report_id: reportId!,
          severity: p.severity,
          area: p.area,
          description: p.description,
          image_id: p.image_id,
          sort_order: baseSortOrder + idx,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
      ]);
      // Clear selection.
      setSelected(new Set());
    } finally {
      setImporting(false);
    }
  }


  async function saveHeader() {
    setSavingHeader(true);
    try {
      const result = await upsertConditionReport(productId, {
        summary: summary.trim() || null,
        grade: grade === "" ? null : grade,
      });
      if (!result.ok) {
        window.alert(
          `Could not save report header: ${result.formError ?? "validation failed"}`
        );
        return;
      }
      // If we just created the report, capture the id for downstream
      // item operations. The action returns reportId in result.data.
      if (!report) {
        setReport({
          id: result.data.reportId,
          product_id: productId,
          summary: summary.trim() || null,
          grade: grade === "" ? null : grade,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          published_at: null,
        });
      } else {
        setReport({
          ...report,
          summary: summary.trim() || null,
          grade: grade === "" ? null : grade,
        });
      }
    } finally {
      setSavingHeader(false);
    }
  }

  async function handlePublishToggle() {
    if (!report) {
      window.alert(
        "Save the report header first (add a summary or grade) before publishing."
      );
      return;
    }
    setPublishing(true);
    try {
      const result = await publishConditionReport(report.id);
      if (!result.ok) {
        window.alert(
          `Could not change publish state: ${result.formError ?? "unknown error"}`
        );
        return;
      }
      setReport({ ...report, published_at: result.data.publishedAt });
    } finally {
      setPublishing(false);
    }
  }

  async function handleAddItem() {
    // Adding an item requires a report. Create one with no summary/grade
    // if needed.
    let reportId = report?.id;
    if (!reportId) {
      const createResult = await upsertConditionReport(productId, {
        summary: null,
        grade: null,
      });
      if (!createResult.ok) {
        window.alert(
          `Could not create report: ${createResult.formError ?? "validation failed"}`
        );
        return;
      }
      reportId = createResult.data.reportId;
      setReport({
        id: reportId,
        product_id: productId,
        summary: null,
        grade: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: null,
      });
    }

    setAddingItem(true);
    try {
      const result = await addReportItem(reportId, {
        severity: "light",
        area: "New observation",
        description: "Describe what was observed.",
        image_id: null,
        sort_order: 0,
      });
      if (!result.ok) {
        window.alert(
          `Could not add item: ${result.formError ?? "validation failed"}`
        );
        return;
      }
      // Append optimistically. The next page navigation revalidates from
      // the server which will give us authoritative sort_order.
      setItems((current) => [
        ...current,
        {
          id: result.data.itemId,
          report_id: reportId!,
          severity: "light",
          area: "New observation",
          description: "Describe what was observed.",
          image_id: null,
          sort_order: current.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setAddingItem(false);
    }
  }

  async function handleUpdateItem(
    itemId: string,
    patch: Partial<Pick<ConditionReportItemRow, "severity" | "area" | "description" | "image_id">>
  ) {
    const current = items.find((i) => i.id === itemId);
    if (!current) return;
    const next = { ...current, ...patch };

    // Optimistic update.
    setItems((items) =>
      items.map((i) => (i.id === itemId ? next : i))
    );

    setSavingItem(itemId);
    try {
      const result = await updateReportItem(itemId, {
        severity: next.severity,
        area: next.area,
        description: next.description,
        image_id: next.image_id,
        sort_order: next.sort_order,
      });
      if (!result.ok) {
        // Revert.
        setItems((items) =>
          items.map((i) => (i.id === itemId ? current : i))
        );
        window.alert(
          `Could not save item: ${result.formError ?? "validation failed"}`
        );
      }
    } finally {
      setSavingItem(null);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm("Delete this observation?")) return;
    const prev = items;
    setItems((items) => items.filter((i) => i.id !== itemId));
    const result = await deleteReportItem(itemId);
    if (!result.ok) {
      setItems(prev);
      window.alert(`Could not delete: ${result.formError}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Publish status + toggle */}
      <div className="flex items-center justify-between border-b border-rule pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink/60">
            Condition report
          </span>
          <span
            className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
              report?.published_at
                ? "border-brand-red bg-brand-red text-paper"
                : "border-rule bg-paper text-ink/60"
            }`}
          >
            {report?.published_at ? "Published" : "Draft"}
          </span>
        </div>
        <button
          type="button"
          onClick={handlePublishToggle}
          disabled={publishing || !report}
          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-paper transition disabled:cursor-not-allowed disabled:opacity-40 ${
            report?.published_at
              ? "bg-brand-red hover:bg-ink"
              : "bg-ink hover:bg-brand-red"
          }`}
        >
          {publishing
            ? "Saving…"
            : report?.published_at
            ? "Unpublish"
            : "Publish report"}
        </button>
      </div>

      {/* Header: summary + grade */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/60">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={saveHeader}
            rows={3}
            placeholder="A one-paragraph overview of the item\u2019s overall condition. Buyers see this first."
            className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-ink/60">
            Grade
          </label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade | "")}
            onBlur={saveHeader}
            className="mt-1 border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          >
            <option value="">Not graded</option>
            <option value="A">A \u2013 Excellent</option>
            <option value="B">B \u2013 Good</option>
            <option value="C">C \u2013 Fair</option>
          </select>
          {savingHeader && (
            <p className="mt-1 text-[10px] uppercase tracking-widest text-ink/40">
              Saving\u2026
            </p>
          )}
        </div>
      </div>

      {/* Items list */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink/60">
          Observations
        </h3>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-ink/40">
            No observations yet. Add one below or import from AI suggestions.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="border border-rule bg-paper p-3 space-y-2"
              >
                <div className="grid gap-2 md:grid-cols-[auto_1fr]">
                  <select
                    value={item.severity}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        severity: e.target.value as Severity,
                      })
                    }
                    className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${SEVERITY_COLOUR[item.severity]}`}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    defaultValue={item.area}
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (v && v !== item.area) {
                        handleUpdateItem(item.id, { area: v });
                      }
                    }}
                    placeholder="Area (e.g. right armrest)"
                    className="border border-rule bg-paper px-2 py-1 text-sm text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
                  />
                </div>
                <textarea
                  defaultValue={item.description}
                  onBlur={(e) => {
                    const v = e.currentTarget.value.trim();
                    if (v && v !== item.description) {
                      handleUpdateItem(item.id, { description: v });
                    }
                  }}
                  rows={2}
                  placeholder="Describe what was observed."
                  className="w-full border border-rule bg-paper px-2 py-1 text-sm text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={item.image_id ?? ""}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        image_id: e.target.value === "" ? null : e.target.value,
                      })
                    }
                    className="border border-rule bg-paper px-2 py-1 text-xs text-ink focus:border-ink focus:outline-none"
                  >
                    <option value="">No linked image</option>
                    {attachedImages.map((img, idx) => (
                      <option key={img.id} value={img.id}>
                        Image #{idx + 1} {img.alt_text ? `\u2014 ${img.alt_text}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    {savingItem === item.id && (
                      <span className="text-[10px] uppercase tracking-widest text-ink/40">
                        Saving\u2026
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-[10px] font-bold uppercase tracking-widest text-ink/40 hover:text-brand-red"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {item.image_id && imageById.has(item.image_id) && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imageById.get(item.image_id)!.cloudinary_url}
                    alt={imageById.get(item.image_id)!.alt_text ?? ""}
                    className="mt-1 h-20 w-20 object-cover border border-rule"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {aiObservations.length > 0 && (
        <div className="border border-rule bg-paper p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-ink/60">
              AI suggested observations
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-ink/40">
              {selected.size} of {aiObservations.length} selected
            </span>
          </div>
          <ul className="space-y-2">
            {aiObservations.map((o, idx) => {
              const img = imageById.get(o.imageId);
              const imgIndex = attachedImages.findIndex(
                (i) => i.id === o.imageId
              );
              const isChecked = selected.has(idx);
              const rowSeverity = perRowSeverity.get(idx) ?? o.severity;
              return (
                <li
                  key={idx}
                  className="flex items-start gap-3 border-t border-rule pt-2 first:border-t-0 first:pt-0"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelected(idx)}
                    className="mt-1"
                    aria-label={`Select observation: ${o.area}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-ink">{o.area}</span>
                      <span className="text-ink/40">
                        \u2014 from Image #{imgIndex + 1}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink/80">
                      {o.description}
                    </p>
                  </div>
                  <select
                    value={rowSeverity}
                    onChange={(e) =>
                      setRowSeverity(idx, e.target.value as Severity)
                    }
                    disabled={!isChecked}
                    className={`border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${SEVERITY_COLOUR[rowSeverity]} disabled:opacity-40`}
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {img && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={img.cloudinary_url}
                      alt={img.alt_text ?? ""}
                      className="h-12 w-12 object-cover border border-rule"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-end gap-3 border-t border-rule pt-3">
            <button
              type="button"
              onClick={handleImportSelected}
              disabled={selected.size === 0 || importing}
              className="bg-ink px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importing
                ? "Importing\u2026"
                : `Import selected as items \u2192`}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddItem}
        disabled={addingItem}
        className="w-full border border-dashed border-rule bg-transparent py-2 text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:border-ink hover:text-ink disabled:cursor-wait disabled:opacity-50"
      >
        {addingItem ? "Adding\u2026" : "+ Add observation"}
      </button>
    </div>
  );
}
