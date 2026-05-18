"use client";

import { useState } from "react";
import type { Database } from "@/types/database";
import {
  upsertConditionReport,
  addReportItem,
  updateReportItem,
  deleteReportItem,
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

  const imageById = new Map(attachedImages.map((i) => [i.id, i]));

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
