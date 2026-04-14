"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showManualContinue, setShowManualContinue] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowManualContinue(false);

    try {
      const loginPromise = supabase.auth.signInWithPassword({ email: email.trim(), password });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("LOGIN_TIMEOUT")), 12000);
      });
      const { error } = await Promise.race([loginPromise, timeoutPromise]);
      if (error) {
        setErrorMsg("Kunne ikke logge ind. Tjek e-mail og adgangskode.");
        return;
      }

      setInfoMsg("Login lykkedes. Viderestiller...");
      setShowManualContinue(true);
      // Hard redirect avoids race where middleware sees stale auth cookies.
      window.location.assign(nextPath);
    } catch (err) {
      if (err instanceof Error && err.message === "LOGIN_TIMEOUT") {
        setErrorMsg("Login tager længere tid end forventet. Prøv igen eller fortsæt manuelt.");
      } else {
        setErrorMsg("Der opstod en fejl under login. Prøv igen.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-lc-border bg-white p-6 shadow-lc-card sm:p-8">
        <header>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">LykkeCup</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">Log ind</h1>
          <p className="mt-2 text-sm text-gray-500">Log ind på LykkeCup KontrolCenter</p>
        </header>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">E-mail</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Adgangskode</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20"
            />
          </label>

          {errorMsg ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
          ) : null}
          {infoMsg ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {infoMsg}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-60"
          >
            {busy ? "Logger ind..." : "Log ind"}
          </button>
        </form>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <Link href="/glemt-kode" className="text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline">
              Glemt kode?
            </Link>
            {showManualContinue ? (
              <button
                type="button"
                onClick={() => window.location.assign(nextPath)}
                className="text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline"
              >
                Fortsæt
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
