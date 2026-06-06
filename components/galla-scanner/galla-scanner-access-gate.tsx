"use client";

import { useState } from "react";
import {
  GALLA_SCANNER_ACCESS_SESSION_KEY,
  getGallaScannerAccessCode,
} from "@/lib/galla-scanner-config";

type Props = {
  onUnlocked: () => void;
};

export function GallaScannerAccessGate({ onUnlocked }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const expected = getGallaScannerAccessCode();
    if (!expected) {
      onUnlocked();
      return;
    }
    if (code.trim() !== expected) {
      setError("Forkert adgangskode");
      return;
    }
    try {
      sessionStorage.setItem(GALLA_SCANNER_ACCESS_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    onUnlocked();
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-950 px-6 text-white">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-300">LykkeCup Galla</p>
      <h1 className="mt-3 text-center text-xl font-semibold">Scanner — adgangskode</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-neutral-400">
        Indtast adgangskoden for at åbne check-in.
      </p>
      <form onSubmit={submit} className="mt-8 w-full max-w-xs space-y-3">
        <input
          type="password"
          inputMode="text"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="Adgangskode"
          className="w-full rounded-xl border border-neutral-600 bg-neutral-900 px-4 py-3 text-center text-lg text-white outline-none focus:border-teal-400"
        />
        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          className="w-full rounded-xl bg-teal-600 py-3 text-base font-semibold text-white active:bg-teal-700"
        >
          Åbn scanner
        </button>
      </form>
    </div>
  );
}

export function hasGallaScannerAccess(): boolean {
  if (!getGallaScannerAccessCode()) return true;
  try {
    return sessionStorage.getItem(GALLA_SCANNER_ACCESS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
