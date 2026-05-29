"use client";

import { useState, useTransition } from "react";
import {
  markFulfilled,
  markPending,
  refundOrder,
  updateOrderNotes,
} from "./_actions";
import { formatPence } from "@/lib/products/format";

interface OrderActionsProps {
  orderId: string;
  status: string;
  initialNotes: string;
  totalPence: number;
  refundedPence: number;
  hasPaymentIntent: boolean;
}

/**
 * Client-side wrapper for the three order detail server actions.
 *
 * Two concerns colocated because they share the same orderId + the
 * same "show feedback after action" pattern:
 *   - Fulfilment toggle (paid <-> fulfilled)
 *   - Internal notes editor (textarea + Save button, no autosave)
 *
 * Notes editor uses explicit Save rather than blur/debounce. Brief
 * 19 wording allowed either but autosave-on-blur compounds with
 * React 19 effect rules (no setState in effect body) and the extra
 * UX risk (lost edits if a blur fires unexpectedly) doesn't pay off
 * for the volume of notes editing this site will see.
 */
export default function OrderActions({
  orderId,
  status,
  initialNotes,
  totalPence,
  refundedPence,
  hasPaymentIntent,
}: OrderActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [notesFeedback, setNotesFeedback] = useState<{
    kind: "saved" | "error";
    message: string;
  } | null>(null);
  const [fulfilFeedback, setFulfilFeedback] = useState<string | null>(null);
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [refundFeedback, setRefundFeedback] = useState<{
    kind: "submitted" | "error";
    message: string;
  } | null>(null);

  const isFulfillable = status === "paid";
  const isRevertable = status === "fulfilled";

  // A full refund covers everything not already refunded. A prior partial
  // refund (issued from the Stripe dashboard) leaves status paid/fulfilled
  // with a non-zero refundedPence, so we surface the remainder.
  const remainingPence = totalPence - refundedPence;
  const canRefund =
    hasPaymentIntent &&
    (status === "paid" || status === "fulfilled") &&
    remainingPence > 0;

  function onConfirmRefund() {
    setRefundFeedback(null);
    startTransition(async () => {
      const result = await refundOrder(orderId);
      setConfirmingRefund(false);
      if (result.ok) {
        setRefundFeedback({
          kind: "submitted",
          message:
            "Refund submitted — syncing from Stripe. Refresh in a moment to see it applied.",
        });
      } else {
        setRefundFeedback({
          kind: "error",
          message: result.formError ?? "Could not issue the refund.",
        });
      }
    });
  }

  function onToggleFulfilled() {
    setFulfilFeedback(null);
    startTransition(async () => {
      const action = isFulfillable ? markFulfilled : markPending;
      const result = await action(orderId);
      if (!result.ok) {
        setFulfilFeedback(result.formError ?? "Something went wrong.");
      }
    });
  }

  function onSaveNotes() {
    setNotesFeedback(null);
    startTransition(async () => {
      const result = await updateOrderNotes(orderId, notes);
      if (result.ok) {
        setNotesFeedback({ kind: "saved", message: "Notes saved." });
      } else {
        setNotesFeedback({
          kind: "error",
          message: result.formError ?? "Could not save notes.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Fulfilment toggle */}
      <div className="border border-rule bg-paper p-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
          Fulfilment
        </h2>
        {isFulfillable && (
          <>
            <p className="mt-4 text-sm text-ink/70">
              Mark this order as shipped/collected. You can revert this
              if marked in error.
            </p>
            <button
              type="button"
              onClick={onToggleFulfilled}
              disabled={isPending}
              className="mt-4 border border-ink bg-ink px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red hover:border-brand-red disabled:opacity-50">
              {isPending ? "Saving\u2026" : "Mark as fulfilled"}
            </button>
          </>
        )}
        {isRevertable && (
          <>
            <p className="mt-4 text-sm text-ink/70">
              This order is marked fulfilled. Revert if marked in error.
            </p>
            <button
              type="button"
              onClick={onToggleFulfilled}
              disabled={isPending}
              className="mt-4 border border-brand-red bg-brand-red px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-ink hover:border-ink disabled:opacity-50">
              {isPending ? "Saving\u2026" : "Revert to pending"}
            </button>
          </>
        )}
        {!isFulfillable && !isRevertable && (
          <p className="mt-4 text-sm text-ink/40">
            No fulfilment action available for status &quot;{status}&quot;.
          </p>
        )}
        {fulfilFeedback && (
          <p className="mt-3 text-xs text-brand-red">{fulfilFeedback}</p>
        )}
      </div>

      {/* Notes editor */}
      <div className="border border-rule bg-paper p-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink/60">
          Internal notes
        </h2>
        <p className="mt-2 text-xs text-ink/60">
          Visible to admin only. 2000 character limit.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={"Anything worth knowing about this order\u2026"}
          className="mt-3 w-full border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder-ink/30 focus:border-ink focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onSaveNotes}
            disabled={isPending || notes === initialNotes}
            className="border border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50">
            {isPending ? "Saving\u2026" : "Save notes"}
          </button>
          <span className="text-xs text-ink/40 tabular-nums">
            {notes.length} / 2000
          </span>
        </div>
        {notesFeedback && (
          <p
            className={
              notesFeedback.kind === "saved"
                ? "mt-3 text-xs text-ink/60"
                : "mt-3 text-xs text-brand-red"
            }>
            {notesFeedback.message}
          </p>
        )}
      </div>
    </div>

      {/* Refund (full) */}
      <div className="border border-brand-red/40 bg-paper p-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-brand-red">
          Refund
        </h2>
        {canRefund ? (
          <>
            <p className="mt-4 text-sm text-ink/70">
              Issue a full refund of{" "}
              <span className="font-bold tabular-nums">
                {formatPence(remainingPence)}
              </span>{" "}
              via Stripe.
              {refundedPence > 0 && (
                <>
                  {" "}
                  ({formatPence(refundedPence)} already refunded.)
                </>
              )}{" "}
              This cannot be undone.
            </p>
            {!confirmingRefund ? (
              <button
                type="button"
                onClick={() => {
                  setRefundFeedback(null);
                  setConfirmingRefund(true);
                }}
                disabled={isPending}
                className="mt-4 border border-brand-red bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-brand-red transition hover:bg-brand-red hover:text-paper disabled:opacity-50">
                Refund {formatPence(remainingPence)}
              </button>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-ink">
                  Refund {formatPence(remainingPence)} in full?
                </span>
                <button
                  type="button"
                  onClick={onConfirmRefund}
                  disabled={isPending}
                  className="border border-brand-red bg-brand-red px-4 py-2 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-ink hover:border-ink disabled:opacity-50">
                  {isPending ? "Refunding…" : "Confirm refund"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRefund(false)}
                  disabled={isPending}
                  className="border border-rule bg-paper px-4 py-2 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-ink hover:text-paper disabled:opacity-50">
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-ink/40">
            {!hasPaymentIntent
              ? "This order has no Stripe payment intent and cannot be refunded here."
              : remainingPence <= 0 && refundedPence > 0
                ? "This order has been fully refunded."
                : `No refund action available for status “${status}”.`}
          </p>
        )}
        {refundFeedback && (
          <p
            className={
              refundFeedback.kind === "submitted"
                ? "mt-3 text-xs text-ink/60"
                : "mt-3 text-xs text-brand-red"
            }>
            {refundFeedback.message}
          </p>
        )}
      </div>
    </div>
  );
}
