import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "../_CategoryForm";

export default async function NewCategoryPage() {
  const supabase = await createClient();
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, kind, parent_id")
    .order("name", { ascending: true });

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
          New category
        </h1>
      </div>

      <CategoryForm mode="create" allCategories={allCategories ?? []} />
    </div>
  );
}
