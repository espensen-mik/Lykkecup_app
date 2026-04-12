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
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { supabase } from "@/lib/supabase";

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
      <nav className="flex flex-1 flex-col gap-0.5 border-b border-lc-border p-3 dark:border-gray-700 lg:p-4">
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

          return (
            <Link
              key={item.href}
              href={item.href}
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
          );
        })}
      </nav>
      <div className="mt-auto p-4 lg:p-5">
        <p className="px-3 text-xs leading-relaxed text-lc-muted dark:text-gray-500">
          LykkeCup KontrolCenter — arrangement og deltagere.
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
        className={`fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-lc-border bg-white transition-transform duration-200 ease-out dark:border-gray-700 dark:bg-gray-900 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-lc-card" : "-translate-x-full"
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
          <div className="flex min-h-[2.25rem] min-w-0 flex-1 items-center rounded-md bg-[#14b8a6] px-3 py-1.5 dark:bg-teal-600">
            <BrandLogo compact />
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-11 xl:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
