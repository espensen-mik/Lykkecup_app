"use client";

import { useEffect } from "react";

/**
 * Registrerer service worker for LykkeCup 26.
 * Kører kun i browser og påvirker ikke server-rendering.
 */
export function Lc26PwaBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/lykkecup26-sw.js", { scope: "/lykkecup26/" });
      } catch {
        // Progressive enhancement: app fungerer stadig uden SW.
      }
    };

    void register();
  }, []);

  return null;
}
