"use client";

import { useEffect } from "react";

const SW_CLEAR_KEY = "lc26-sw-cleared-v3";

/**
 * Fjerner gammel LykkeCup 26 service worker der ødelagde layout ved QR-scan.
 * Én genindlæsning efter oprydning hvis en gammel SW stadig styrede siden.
 */
export function Lc26PwaBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cleanup = async () => {
      const hadControllingSw = Boolean(
        navigator.serviceWorker?.controller?.scriptURL.includes("lykkecup26-sw"),
      );

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k.startsWith("lc26-cache-")).map((k) => caches.delete(k)),
        );
      }

      if (!("serviceWorker" in navigator)) return hadControllingSw;

      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const script = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
        if (script.includes("lykkecup26-sw")) {
          await reg.unregister();
        }
      }

      try {
        await navigator.serviceWorker.register("/lykkecup26-sw-v3.js", { scope: "/lykkecup26/" });
      } catch {
        // Progressive enhancement.
      }

      return hadControllingSw;
    };

    void cleanup().then((hadControllingSw) => {
      if (hadControllingSw && !sessionStorage.getItem(SW_CLEAR_KEY)) {
        sessionStorage.setItem(SW_CLEAR_KEY, "1");
        window.location.reload();
      }
    });
  }, []);

  return null;
}
