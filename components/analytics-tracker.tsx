"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "lc_visitor_id";
const DEDUP_MS = 2500;

/** Session-fallback når localStorage er blokeret (privat browsing / ITP). */
let memoryVisitorId: string | null = null;

function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.length > 80) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    if (!memoryVisitorId) memoryVisitorId = crypto.randomUUID();
    return memoryVisitorId;
  }
}

/**
 * Registrerer sidevisning (sti + anonym visitor_id) til lc_analytics_page_views.
 * Bruger {@link supabase} fra `lib/supabase` — samme anon-klient som øvrig offentlig LykkeCup 26-data
 * (undgår ekstra GoTrueClient + matcher virkende fetch-mønster).
 */
export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastRef = useRef<{ path: string; t: number } | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const path = pathname.length > 512 ? pathname.slice(0, 512) : pathname;
    const now = Date.now();
    const prev = lastRef.current;
    if (prev && prev.path === path && now - prev.t < DEDUP_MS) return;
    lastRef.current = { path, t: now };

    const visitorId = getOrCreateVisitorId();

    void (async () => {
      const { error } = await supabase.from("lc_analytics_page_views").insert({ visitor_id: visitorId, path });
      if (error) {
        console.warn(
          "[lc-analytics] insert failed:",
          error.message,
          error.code ?? "",
          error.details ?? "",
          (error as { hint?: string }).hint ?? "",
        );
      }
    })();
  }, [pathname]);

  return null;
}
