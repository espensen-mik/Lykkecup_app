"use client";

import {
  Building2,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hasClubFeedbackInLastHours } from "@/lib/club-feedback";
import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";

const RECENT_COMMENTS_HOURS = 24;

const APP_SIDEBAR_TITLE = "LykkeCup KontrolCenter 2026";

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Overblik", icon: LayoutDashboard },
  { href: "/", label: "Spillere", icon: Users },
  { href: "/klubber", label: "Klubber", icon: Building2 },
  { href: "/kommentarer", label: "Kommentarer", icon: MessageSquareText },
  { href: "/holddannelse", label: "Holddannelse", icon: UsersRound },
];

function pathLevelKeyFromPathname(pathname: string): string | null {
  if (!pathname.startsWith("/holddannelse/")) return null;
  const rest = pathname.slice("/holddannelse/".length);
  if (!rest) return null;
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/lykkeliga-logo.svg"
      alt="Lykkeliga"
      className={`w-auto object-contain object-left brightness-0 invert ${
        compact
          ? "h-5 max-w-[min(100%,7.5rem)]"
          : "h-6 max-w-[min(100%,9rem)] lg:h-7 lg:max-w-[10.5rem]"
      }`}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [holdLevels, setHoldLevels] = useState<string[]>([]);
  const [kommentarerNye, setKommentarerNye] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("players")
        .select("level")
        .eq("event_id", LYKKECUP_EVENT_ID);
      if (cancelled || error || !data) return;
      const keys = new Set<string>();
      for (const row of data as { level: string | null }[]) {
        keys.add(normalizeLevelKey(row.level));
      }
      setHoldLevels(sortLevelKeysForNav([...keys]));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const has = await hasClubFeedbackInLastHours(RECENT_COMMENTS_HOURS);
      if (!cancelled) setKommentarerNye(has);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function isActive(href: string) {
    if (href === "/holddannelse") {
      return pathname === "/holddannelse" || pathname.startsWith("/holddannelse/");
    }
    return pathname === href;
  }

  const currentHoldLevelKey = pathLevelKeyFromPathname(pathname);

  const sortedHoldLevels = useMemo(() => sortLevelKeysForNav([...holdLevels]), [holdLevels]);

  const sidebar = (
    <>
      {/* OptiSigns-style solid teal brand bar + hvid logo */}
      <div className="flex h-11 shrink-0 items-center px-4 lg:h-12 lg:px-5 bg-[#14b8a6] dark:bg-teal-600">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center"
          onClick={() => setMobileOpen(false)}
        >
          <BrandLogo />
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain border-b border-lc-border p-3 dark:border-gray-700 lg:p-4">
        <p className="mb-1.5 px-3 text-[0.6875rem] font-medium uppercase tracking-wide text-lc-muted dark:text-gray-500">
          Menu
        </p>
        {nav.map((item) => {
          const active = isActive(item.href);
          const NavIcon = item.icon;

          if (item.href === "/holddannelse") {
            return (
              <div key={item.href} className="space-y-0.5">
                <Link
                  href="/holddannelse"
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-md py-2.5 pr-3 text-[0.9375rem] font-medium transition-colors border-l-2 ${
                    active
                      ? "border-[#14b8a6] bg-teal-50/90 pl-[10px] text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                      : "border-transparent pl-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white"
                  } `}
                >
                  <NavIcon
                    className={`h-4 w-4 shrink-0 ${active ? "text-[#0f766e] dark:text-teal-300" : "text-gray-400 dark:text-gray-500"}`}
                    strokeWidth={2}
                    aria-hidden
                  />
                  {item.label}
                </Link>
                {sortedHoldLevels.length > 0 ? (
                  <ul
                    className="ml-4 space-y-0.5 border-l border-gray-200 py-0.5 pl-3 dark:border-gray-700"
                    aria-label="Niveauer"
                  >
                    {sortedHoldLevels.map((levelKey) => {
                      const href = `/holddannelse/${encodeURIComponent(levelKey)}`;
                      const subActive = currentHoldLevelKey === levelKey;
                      return (
                        <li key={levelKey}>
                          <Link
                            href={href}
                            title={levelKey}
                            onClick={() => setMobileOpen(false)}
                            className={`block max-w-[13rem] truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors ${
                              subActive
                                ? "bg-teal-50 text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-200"
                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                            }`}
                          >
                            {levelKey}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          }

          const showKommentarerNyeTag =
            item.href === "/kommentarer" && kommentarerNye;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-label={
                showKommentarerNyeTag
                  ? `${item.label} — nye kommentarer inden for de seneste ${RECENT_COMMENTS_HOURS} timer`
                  : undefined
              }
              className={`flex items-center gap-3 rounded-md py-2.5 pr-3 text-[0.9375rem] font-medium transition-colors border-l-2 ${
                active
                  ? "border-[#14b8a6] bg-teal-50/90 pl-[10px] text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                  : "border-transparent pl-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white"
              } `}
            >
              <NavIcon
                className={`h-4 w-4 shrink-0 ${active ? "text-[#0f766e] dark:text-teal-300" : "text-gray-400 dark:text-gray-500"}`}
                strokeWidth={2}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {showKommentarerNyeTag ? (
                <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[#0f766e] dark:bg-teal-900/50 dark:text-teal-200">
                  Nye
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-lc-border bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:p-5">
        <p className="px-1 text-[0.8125rem] font-semibold leading-snug text-gray-900 dark:text-gray-100">
          {APP_SIDEBAR_TITLE}
        </p>
        <p className="mt-1.5 px-1 text-xs leading-relaxed text-lc-muted dark:text-gray-500">
          Arrangement og deltagere.
        </p>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-gray-900/25 backdrop-blur-[1px] lg:hidden"
          aria-label="Luk menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={`z-50 flex h-full min-h-0 w-[16.5rem] flex-col border-r border-lc-border bg-white dark:border-gray-700 dark:bg-gray-900 max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:transition-transform max-lg:duration-200 max-lg:ease-out lg:sticky lg:top-0 lg:h-svh lg:max-h-svh lg:shrink-0 lg:self-start ${
          mobileOpen ? "max-lg:translate-x-0 max-lg:shadow-lc-card" : "max-lg:-translate-x-full"
        } `}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-lc-border bg-white px-4 dark:border-gray-700 dark:bg-gray-900 lg:hidden">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
          <Link
            href="/dashboard"
            className="flex min-h-[2.25rem] min-w-0 flex-1 items-center rounded-md bg-[#14b8a6] px-3 py-1.5 dark:bg-teal-600"
          >
            <BrandLogo compact />
          </Link>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-11 xl:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
