"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/nulstil-kode` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setBusy(false);
    if (error) {
      setErrorMsg("Kunne ikke sende nulstillingsmail. Prøv igen.");
      return;
    }
    setSuccessMsg("Hvis e-mailen findes, har vi sendt et link til nulstilling af adgangskode.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-lc-border bg-white p-6 shadow-lc-card sm:p-8">
        <header>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488]">LykkeCup</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">Glemt kode?</h1>
          <p className="mt-2 text-sm text-gray-500">Indtast din e-mail for at modtage et nulstillingslink.</p>
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

          {errorMsg ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
          ) : null}
          {successMsg ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMsg}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-medium text-teal-800 transition-colors hover:bg-teal-100 disabled:opacity-60"
          >
            {busy ? "Sender..." : "Send nulstillingslink"}
          </button>
        </form>

        <div className="mt-4">
          <Link href="/login" className="text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline">
            Tilbage til login
          </Link>
        </div>
      </section>
    </main>
  );
}
