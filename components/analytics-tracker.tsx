"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getAuthBrowserClient } from "@/lib/auth-browser";

const STORAGE_KEY = "lc_visitor_id";
const DEDUP_MS = 2500;

function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.length > 80) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Registrerer sidevisning (sti + anonym visitor_id i localStorage) til lc_analytics_page_views.
 * Bruges både på /lykkecup26 og i KontrolCenter.
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
    if (!visitorId) return;

    const supabase = getAuthBrowserClient();
    void supabase.from("lc_analytics_page_views").insert({ visitor_id: visitorId, path });
  }, [pathname]);

  return null;
}
