import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  const supabase = await createClient();

  // Try a simple call: get the auth session (will be null, but proves connection works)
  const { data: { session }, error } = await supabase.auth.getSession();

  const connected = !error;
  const errorMessage = error?.message ?? null;

  return (
    <main className="min-h-screen bg-paper text-ink px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <div className="text-xs tracking-[0.22em] uppercase mb-4 text-stone-500">
          Internal · Connection test
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-8">
          Supabase connection
        </h1>

        <div className="border-2 border-rule rounded-sm p-6 mb-6">
          <div className="text-xs tracking-[0.18em] uppercase font-bold mb-2 text-stone-500">
            Status
          </div>
          <div
            className={`text-2xl font-black tracking-tight ${
              connected ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {connected ? "✓ Connected" : "✗ Failed"}
          </div>
          {errorMessage && (
            <div className="mt-4 text-sm font-mono text-red-900 bg-red-50 p-3 rounded">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="border-2 border-rule rounded-sm p-6">
          <div className="text-xs tracking-[0.18em] uppercase font-bold mb-2 text-stone-500">
            Session
          </div>
          <div className="text-sm font-mono">
            {session ? JSON.stringify(session, null, 2) : "No session (expected — not signed in yet)"}
          </div>
        </div>

        <p className="text-xs text-stone-500 mt-12">
          This is a temporary diagnostic page. It will be removed once the CRM is built.
        </p>
      </div>
    </main>
  );
}
