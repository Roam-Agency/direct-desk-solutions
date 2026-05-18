"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveCategory, restoreCategory } from "./_actions";

export function ArchiveButton({
  categoryId,
  isActive,
}: {
  categoryId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = isActive
        ? await archiveCategory(categoryId)
        : await restoreCategory(categoryId);
      if (result.ok) {
        router.refresh();
      } else if (result.formError) {
        alert(result.formError);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-bold uppercase tracking-widest text-ink/40 transition hover:text-brand-red disabled:opacity-50"
    >
      {isPending ? "…" : isActive ? "Archive" : "Restore"}
    </button>
  );
}
