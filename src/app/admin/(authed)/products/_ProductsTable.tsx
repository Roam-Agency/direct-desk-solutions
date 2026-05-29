"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPence } from "@/lib/products/format";
import type { Database } from "@/types/database";
import { StatusPill } from "../_ui/StatusPill";
import { archiveProducts, deleteProducts, publishProducts } from "./_actions";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type Hero = { url: string; alt: string | null };

/**
 * Products list table with multi-select.
 *
 * Client component because selection is interactive state. The header
 * checkbox selects/clears every visible (filtered) row; a per-row checkbox
 * toggles one. When at least one row is selected, a bulk-action bar appears
 * with Set Live, Archive and Delete.
 *
 * Selection is keyed to the *visible* row set: navigating between status /
 * condition filters (or a post-action refresh) swaps the rows, and the
 * effect below resets the selection so we never act on rows that scrolled
 * out of view.
 *
 * Delete mirrors the per-product `canHardDelete` rule — the server only
 * removes draft, never-published rows and reports how many it skipped.
 */
export function ProductsTable({
  rows,
  heroes,
}: {
  rows: ProductRow[];
  heroes: Record<string, Hero>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);

  // Reset selection whenever the visible set changes (filter nav / refresh).
  // This is the "adjust state during render" pattern: cheaper and more
  // correct than a useEffect, which would briefly render a stale selection.
  const idKey = visibleIds.join(",");
  const [prevIdKey, setPrevIdKey] = useState(idKey);
  if (idKey !== prevIdKey) {
    setPrevIdKey(idKey);
    setSelected(new Set());
  }

  const selectedCount = selected.size;
  const allSelected =
    visibleIds.length > 0 && selectedCount === visibleIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  // Native indeterminate state can only be set imperatively.
  const headerCheckbox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckbox.current) {
      headerCheckbox.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePublish() {
    const ids = [...selected];
    const n = ids.length;
    if (n === 0) return;
    if (
      !confirm(
        `Set ${n} product${n === 1 ? "" : "s"} live? ${
          n === 1 ? "It" : "They"
        } will be visible on the customer site.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await publishProducts(ids);
      if (!result.ok) {
        alert(result.formError);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleArchive() {
    const ids = [...selected];
    const n = ids.length;
    if (n === 0) return;
    if (
      !confirm(
        `Archive ${n} product${n === 1 ? "" : "s"}? ${
          n === 1 ? "It" : "They"
        } will be hidden from the customer site.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await archiveProducts(ids);
      if (!result.ok) {
        alert(result.formError);
        return;
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleDelete() {
    const ids = [...selected];
    const n = ids.length;
    if (n === 0) return;
    if (
      !confirm(
        `Permanently delete ${n} selected product${n === 1 ? "" : "s"}?\n\n` +
          "Only draft, never-published products are deleted — live and " +
          "archived items are skipped. This cannot be undone."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProducts(ids);
      if (!result.ok) {
        alert(result.formError);
        return;
      }
      setSelected(new Set());
      router.refresh();
      if (result.skippedCount > 0) {
        alert(
          `Deleted ${result.deletedCount}. Skipped ${result.skippedCount} ` +
            "(only draft, never-published products can be deleted)."
        );
      }
    });
  }

  return (
    <div>
      <BulkActionBar
        count={selectedCount}
        disabled={isPending}
        onPublish={handlePublish}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onClear={() => setSelected(new Set())}
      />

      <div className="overflow-hidden border border-rule">
        <table className="w-full">
          <thead className="bg-ink text-paper">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  ref={headerCheckbox}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all products"
                  className="h-4 w-4 cursor-pointer accent-brand-red"
                />
              </th>
              <Th>Image</Th>
              <Th>SKU</Th>
              <Th>Name</Th>
              <Th>Brand</Th>
              <Th>Condition</Th>
              <Th className="text-right">Price</Th>
              <Th>Stock</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hero = heroes[row.id] ?? null;
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={
                    "border-t border-rule transition " +
                    (isSelected ? "bg-rule/50" : "hover:bg-rule/30")
                  }
                >
                  <Td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.name}`}
                      className="h-4 w-4 cursor-pointer accent-brand-red"
                    />
                  </Td>
                  <Td>
                    <ProductThumbnail hero={hero} productName={row.name} />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/products/${row.id}`}
                      className="font-mono text-xs text-ink hover:text-brand-red"
                    >
                      {row.sku}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/products/${row.id}`}
                      className="font-bold text-ink hover:text-brand-red"
                    >
                      {row.name}
                    </Link>
                  </Td>
                  <Td className="text-ink/70">{row.brand ?? "—"}</Td>
                  <Td>
                    <ConditionLabel
                      condition={row.condition}
                      grade={row.condition_grade}
                    />
                  </Td>
                  <Td className="text-right font-bold tabular-nums">
                    {formatPence(row.price_pence)}
                  </Td>
                  <Td className="tabular-nums">{row.stock_quantity}</Td>
                  <Td>
                    <StatusLabel status={row.status} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkActionBar({
  count,
  disabled,
  onPublish,
  onArchive,
  onDelete,
  onClear,
}: {
  count: number;
  disabled: boolean;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 border border-ink bg-ink px-4 py-3 text-paper">
      <span className="text-xs font-bold uppercase tracking-widest">
        {count} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPublish}
          disabled={disabled}
          className="border border-paper bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-ink transition hover:bg-paper/80 disabled:opacity-50"
        >
          Set Live
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={disabled}
          className="border border-paper/40 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-paper transition hover:border-paper hover:bg-paper hover:text-ink disabled:opacity-50"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="border border-brand-red bg-brand-red px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-paper hover:text-brand-red disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="ml-auto text-xs font-bold uppercase tracking-widest text-paper/60 transition hover:text-paper disabled:opacity-50"
      >
        Clear
      </button>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-widest ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

/**
 * Insert a Cloudinary URL transform so the admin list only downloads a
 * small thumbnail instead of the full hero. Falls through to the original
 * URL untransformed if the pattern doesn't match.
 */
function toThumbUrl(url: string): string {
  return url.replace("/upload/", "/upload/c_fill,w_128,h_128,q_auto,f_auto/");
}

function ProductThumbnail({
  hero,
  productName,
}: {
  hero: Hero | null;
  productName: string;
}) {
  if (!hero) {
    return (
      <div className="h-16 w-16 border border-rule bg-rule/40" aria-hidden />
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={toThumbUrl(hero.url)}
      alt={hero.alt ?? productName}
      width={64}
      height={64}
      className="h-16 w-16 border border-rule object-cover"
      loading="lazy"
    />
  );
}

function ConditionLabel({
  condition,
  grade,
}: {
  condition: ProductRow["condition"];
  grade: ProductRow["condition_grade"];
}) {
  if (condition === "new") {
    return <span className="text-ink/80">New</span>;
  }
  return (
    <span className="text-ink/80">
      Used <span className="text-ink/40">·</span>{" "}
      <span className="font-mono text-ink/60">Grade {grade ?? "?"}</span>
    </span>
  );
}

function StatusLabel({ status }: { status: ProductRow["status"] }) {
  const label =
    status === "live" ? "Live" : status === "draft" ? "Draft" : "Archived";
  return <StatusPill tone={status}>{label}</StatusPill>;
}
