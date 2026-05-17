import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, sku, name, brand, condition, condition_grade, price_pence, status")
    .order("created_at", { ascending: false });

  const formatPrice = (pence: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(pence / 100);

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-xs tracking-[0.22em] uppercase mb-4 text-stone-500">
          Internal · Database test
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2">
          Products
        </h1>
        <p className="text-stone-500 text-sm mb-10">
          Reading from Supabase{products && ` · ${products.length} ${products.length === 1 ? "row" : "rows"}`}
        </p>

        {error && (
          <div className="border-2 border-red-700 bg-red-50 text-red-900 p-6 rounded-sm mb-6">
            <div className="text-xs tracking-[0.18em] uppercase font-bold mb-2">
              Query failed
            </div>
            <div className="text-sm font-mono">{error.message}</div>
          </div>
        )}

        {products && products.length > 0 && (
          <div className="border-2 border-rule rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink text-paper">
                <tr>
                  <th className="text-left px-4 py-3 font-bold tracking-[0.12em] uppercase text-xs">SKU</th>
                  <th className="text-left px-4 py-3 font-bold tracking-[0.12em] uppercase text-xs">Name</th>
                  <th className="text-left px-4 py-3 font-bold tracking-[0.12em] uppercase text-xs">Brand</th>
                  <th className="text-left px-4 py-3 font-bold tracking-[0.12em] uppercase text-xs">Condition</th>
                  <th className="text-right px-4 py-3 font-bold tracking-[0.12em] uppercase text-xs">Price</th>
                  <th className="text-left px-4 py-3 font-bold tracking-[0.12em] uppercase text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-rule hover:bg-rule/40">
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">{p.sku}</td>
                    <td className="px-4 py-3 font-bold">{p.name}</td>
                    <td className="px-4 py-3">{p.brand}</td>
                    <td className="px-4 py-3">
                      {p.condition === "used" ? (
                        <span>
                          Used <span className="text-stone-500">· Grade {p.condition_grade}</span>
                        </span>
                      ) : (
                        <span>New</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatPrice(p.price_pence)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs tracking-[0.12em] uppercase font-bold ${p.status === "live" ? "text-emerald-700" : "text-stone-500"}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-stone-500 mt-12">
          This is a temporary diagnostic page. It will be removed once the CRM is built.
        </p>
      </div>
    </main>
  );
}
