"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getAuthBrowserClient } from "@/lib/auth-browser";

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

export default function ResetPasswordPage() {
  const supabase = getAuthBrowserClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = parseHashParams(window.location.hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");

        if (type === "recovery" && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            if (!cancelled) setErrorMsg("Reset-linket kunne ikke valideres. Bed om et nyt link.");
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          if (data.session) setReady(true);
          else setErrorMsg("Din reset-session er udløbet. Bed om et nyt link.");
        }
      } catch {
        if (!cancelled) setErrorMsg("Kunne ikke starte nulstilling af adgangskode.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (password.length < 8) {
      setErrorMsg("Adgangskoden skal være mindst 8 tegn.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Adgangskoderne matcher ikke.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErrorMsg("Kunne ikke opdatere adgangskode. Bed om et nyt reset-link.");
      return;
    }
    setSuccessMsg("Din adgangskode er opdateret. Du kan nu logge ind.");
    await supabase.auth.signOut();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-lc-border bg-white p-6 shadow-lc-card sm:p-8">
        <header>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">LykkeCup</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">Opret ny adgangskode</h1>
          <p className="mt-2 text-sm text-gray-500">Indtast en ny adgangskode for din konto.</p>
        </header>

        {ready ? (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Ny adgangskode</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Gentag ny adgangskode</span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-60"
            >
              {busy ? "Gemmer..." : "Gem ny adgangskode"}
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-gray-600">Validerer reset-link...</p>
        )}

        {errorMsg ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
        ) : null}
        {successMsg ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMsg}
          </p>
        ) : null}

        <div className="mt-4">
          <Link href="/login" className="text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline">
            Tilbage til login
          </Link>
        </div>
      </section>
    </main>
  );
}
