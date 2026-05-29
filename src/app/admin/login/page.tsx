"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import logoDark from "@/assets/brand/dds-logo-dark.png";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin/test";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Full reload so middleware picks up the new session cookie
    // before rendering the destination page.
    router.refresh();
    router.push(redirectTo);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-bold uppercase tracking-widest text-ink mb-2"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-rule bg-paper px-4 py-3 text-ink focus:border-brand-red focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-bold uppercase tracking-widest text-ink mb-2"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-rule bg-paper px-4 py-3 text-ink focus:border-brand-red focus:outline-none"
        />
      </div>

      {error && (
        <div className="border-l-2 border-brand-red bg-paper px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-ink px-6 py-4 text-xs font-bold uppercase tracking-widest text-paper transition hover:bg-brand-red disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          {/* Brand logo (dark variant for the light bg-paper page) */}
          <Image
            src={logoDark}
            alt="Direct Desk Solutions"
            preload
            className="mx-auto block h-10 w-auto"
          />
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-ink/60">
            Admin
          </p>
        </div>

        <Suspense fallback={<div className="text-ink/60">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
