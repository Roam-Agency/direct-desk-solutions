"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createDraftProduct } from "./_actions";

/**
 * "New product" CTA that creates a skeleton draft and redirects to its
 * edit page (Branch 3 — draft-first create flow).
 *
 * Used in two places on /admin/products: the header CTA and the empty-state
 * CTA. Same visual treatment as the old <Link> they replace — black pill,
 * red hover, uppercase tracking.
 *
 * The variant prop swaps the layout class so the empty-state version stays
 * inline-block + margin-top-6, while the header version is the default
 * (no extra spacing).
 */
export function DraftProductButton({
  variant = "header",
}: {
  variant?: "header" | "empty-state";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createDraftProduct();
      if (result.ok && result.id) {
        router.push(`/admin/products/${result.id}`);
      } else {
        setError(
          result.ok
            ? "Created draft but no id returned"
            : result.formError ?? "Could not create draft"
        );
      }
    });
  }

  const baseClass =
    "bg-ink px-5 py-3 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:cursor-wait disabled:opacity-60";
  const className =
    variant === "empty-state"
      ? `mt-6 inline-block ${baseClass}`
      : baseClass;

  return (
    <div className={variant === "empty-state" ? "inline-flex flex-col items-center" : "flex flex-col items-end"}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={className}
      >
        {isPending ? "Creating…" : "New product"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-brand-red">{error}</p>
      )}
    </div>
  );
}
