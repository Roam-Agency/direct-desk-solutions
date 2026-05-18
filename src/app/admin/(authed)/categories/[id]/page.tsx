import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "../_CategoryForm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: category }, { data: allCategories }] = await Promise.all([
    supabase.from("categories").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("categories")
      .select("id, name, kind, parent_id")
      .order("name", { ascending: true }),
  ]);

  if (!category) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/categories"
          className="text-xs font-bold uppercase tracking-widest text-ink/60 transition hover:text-ink"
        >
          ← Categories
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          {category.name}
        </h1>
        <p className="mt-1 text-xs text-ink/40 font-mono">{category.slug}</p>
      </div>

      <CategoryForm
        mode="edit"
        initialCategory={category}
        allCategories={allCategories ?? []}
      />
    </div>
  );
}
