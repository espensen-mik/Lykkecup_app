"use client";

import { Building2, CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, MessageSquareText, Users, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { AuthAppUser } from "@/lib/auth-server";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { KontrolcenterHelp } from "@/components/kontrolcenter-help";
import { hasClubFeedbackInLastHours } from "@/lib/club-feedback";
import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";

const RECENT_COMMENTS_HOURS = 24;

const APP_SIDEBAR_TITLE = "LykkeCup KontrolCenter 2026";
const HEADER_TITLE = "LykkeCup KontrolCenter 2026";

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Overblik", icon: LayoutDashboard },
  { href: "/", label: "Spillere", icon: Users },
  { href: "/klubber", label: "Klubber", icon: Building2 },
  { href: "/kommentarer", label: "Kommentarer", icon: MessageSquareText },
];

function pathLevelKeyFromPathname(pathname: string, basePath: string): string | null {
  if (!pathname.startsWith(`${basePath}/`)) return null;
  const rest = pathname.slice(`${basePath}/`.length);
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

export function AppShell({ children, currentUser }: { children: React.ReactNode; currentUser: AuthAppUser | null }) {
  const authClient = getAuthBrowserClient();
  function initialsFromName(name: string) {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return "U";
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }

  async function handleLogout() {
    await authClient.auth.signOut();
    window.location.href = "/login";
  }

  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [holdLevels, setHoldLevels] = useState<string[]>([]);
  const [turneringLevels, setTurneringLevels] = useState<string[]>([]);
  const [kommentarerNye, setKommentarerNye] = useState(false);
  const [holdOpen, setHoldOpen] = useState(() => pathname.startsWith("/holddannelse"));
  const [turneringOpen, setTurneringOpen] = useState(() => pathname.startsWith("/turnering"));
  const [puljerOpen, setPuljerOpen] = useState(() => pathname.startsWith("/turnering/puljer"));
  const [planOpen, setPlanOpen] = useState(() => pathname.startsWith("/turnering/plan"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [playersRes, teamsRes] = await Promise.all([
        supabase.from("players").select("level").eq("event_id", LYKKECUP_EVENT_ID),
        supabase.from("teams").select("level").eq("event_id", LYKKECUP_EVENT_ID),
      ]);
      if (cancelled) return;
      if (playersRes.error || teamsRes.error) return;

      const holdKeys = new Set<string>();
      for (const row of (playersRes.data ?? []) as { level: string | null }[]) {
        holdKeys.add(normalizeLevelKey(row.level));
      }
      setHoldLevels(sortLevelKeysForNav([...holdKeys]));

      const turneringKeys = new Set<string>();
      for (const row of (teamsRes.data ?? []) as { level: string | null }[]) {
        turneringKeys.add(normalizeLevelKey(row.level));
      }
      setTurneringLevels(sortLevelKeysForNav([...turneringKeys]));
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

  useEffect(() => {
    if (pathname.startsWith("/holddannelse")) setHoldOpen(true);
    if (pathname.startsWith("/turnering")) setTurneringOpen(true);
    if (pathname.startsWith("/turnering/puljer")) setPuljerOpen(true);
    if (pathname.startsWith("/turnering/plan")) setPlanOpen(true);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/holddannelse") return pathname === "/holddannelse" || pathname.startsWith("/holddannelse/");
    if (href === "/turnering") return pathname.startsWith("/turnering");
    if (href === "/turnering/puljer")
      return pathname === "/turnering/puljer" || pathname.startsWith("/turnering/puljer/");
    if (href === "/turnering/plan")
      return pathname === "/turnering/plan" || pathname.startsWith("/turnering/plan/");
    return pathname === href;
  }

  const currentHoldLevelKey = pathLevelKeyFromPathname(pathname, "/holddannelse");
  const currentPuljerLevelKey = pathLevelKeyFromPathname(pathname, "/turnering/puljer");
  const currentPlanLevelKey = pathLevelKeyFromPathname(pathname, "/turnering/plan");

  const sortedHoldLevels = useMemo(() => sortLevelKeysForNav([...holdLevels]), [holdLevels]);
  const sortedTurneringLevels = useMemo(() => sortLevelKeysForNav([...turneringLevels]), [turneringLevels]);

  const sidebar = (
    <>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain border-b border-lc-border p-3 dark:border-gray-700 lg:p-4">
        <p className="mb-1.5 px-3 text-[0.6875rem] font-medium uppercase tracking-wide text-lc-muted dark:text-gray-500">
          Menu
        </p>
        {nav.map((item) => {
          const active = isActive(item.href);
          const NavIcon = item.icon;

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
                <span
                  title="Nye kommentarer registreret inden for de sidste 24 timer."
                  className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[#0f766e] dark:bg-teal-900/50 dark:text-teal-200"
                >
                  Nye
                </span>
              ) : null}
            </Link>
          );
        })}

        <div className="mt-1 space-y-0.5">
          <div
            className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
              isActive("/holddannelse")
                ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                : "border-transparent text-gray-700 dark:text-gray-300"
            }`}
          >
            <Link
              href="/holddannelse"
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-1 text-[0.9375rem] font-medium"
            >
              <UsersRound
                className={`h-4 w-4 shrink-0 ${
                  isActive("/holddannelse") ? "text-[#0f766e] dark:text-teal-300" : "text-gray-400 dark:text-gray-500"
                }`}
                strokeWidth={2}
                aria-hidden
              />
              <span className="truncate">Holddannelse</span>
            </Link>
            <button
              type="button"
              onClick={() => setHoldOpen((v) => !v)}
              className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={holdOpen ? "Skjul niveauer" : "Vis niveauer"}
              aria-expanded={holdOpen}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${holdOpen ? "" : "-rotate-90"}`} aria-hidden />
            </button>
          </div>
          {holdOpen && sortedHoldLevels.length > 0 ? (
            <ul className="ml-6 space-y-0.5 border-l border-gray-200 py-0.5 pl-3 dark:border-gray-700" aria-label="Holddannelse niveauer">
              {sortedHoldLevels.map((levelKey) => {
                const href = `/holddannelse/${encodeURIComponent(levelKey)}`;
                const subActive = currentHoldLevelKey === levelKey;
                return (
                  <li key={`hold-${levelKey}`}>
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

        <div className="mt-1 space-y-0.5">
          <div
            className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
              isActive("/turnering")
                ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                : "border-transparent text-gray-700 dark:text-gray-300"
            }`}
          >
            <Link
              href="/turnering"
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-1 text-left text-[0.9375rem] font-medium"
            >
              <CalendarDays
                className={`h-4 w-4 shrink-0 ${
                  isActive("/turnering") ? "text-[#0f766e] dark:text-teal-300" : "text-gray-400 dark:text-gray-500"
                }`}
                strokeWidth={2}
                aria-hidden
              />
              <span className="truncate">Turnering</span>
            </Link>
            <button
              type="button"
              onClick={() => setTurneringOpen((v) => !v)}
              className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={turneringOpen ? "Skjul sektion" : "Vis sektion"}
              aria-expanded={turneringOpen}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${turneringOpen ? "" : "-rotate-90"}`}
                aria-hidden
              />
            </button>
          </div>
          {turneringOpen ? (
            <div className="ml-4 space-y-0.5 border-l border-gray-200 py-0.5 pl-3 dark:border-gray-700">
              <div className="space-y-0.5">
                <div
                  className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
                    isActive("/turnering/puljer")
                      ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                      : "border-transparent text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Link
                    href="/turnering/puljer"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 pr-1 text-[0.86rem] font-medium"
                  >
                    <span className="truncate">Puljer</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPuljerOpen((v) => !v)}
                    className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label={puljerOpen ? "Skjul niveauer" : "Vis niveauer"}
                    aria-expanded={puljerOpen}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${puljerOpen ? "" : "-rotate-90"}`} aria-hidden />
                  </button>
                </div>
                {puljerOpen && sortedTurneringLevels.length > 0 ? (
                  <ul className="ml-4 space-y-0.5 border-l border-gray-200 py-0.5 pl-3 dark:border-gray-700" aria-label="Puljer niveauer">
                    {sortedTurneringLevels.map((levelKey) => {
                      const href = `/turnering/puljer/${encodeURIComponent(levelKey)}`;
                      const subActive = currentPuljerLevelKey === levelKey;
                      return (
                        <li key={`puljer-${levelKey}`}>
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

              <div className="space-y-0.5">
                <div
                  className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
                    isActive("/turnering/plan")
                      ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                      : "border-transparent text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Link
                    href="/turnering/plan"
                    onClick={() => setMobileOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 pr-1 text-[0.86rem] font-medium"
                  >
                    <span className="truncate">Turneringsplan</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPlanOpen((v) => !v)}
                    className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    aria-label={planOpen ? "Skjul niveauer" : "Vis niveauer"}
                    aria-expanded={planOpen}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${planOpen ? "" : "-rotate-90"}`} aria-hidden />
                  </button>
                </div>
                {planOpen && sortedTurneringLevels.length > 0 ? (
                  <ul className="ml-4 space-y-0.5 border-l border-gray-200 py-0.5 pl-3 dark:border-gray-700" aria-label="Turneringsplan niveauer">
                    {sortedTurneringLevels.map((levelKey) => {
                      const href = `/turnering/plan/${encodeURIComponent(levelKey)}`;
                      const subActive = currentPlanLevelKey === levelKey;
                      return (
                        <li key={`plan-${levelKey}`}>
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
            </div>
          ) : null}
        </div>
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-teal-500/40 bg-[#14b8a6] px-4 text-white shadow-[0_4px_18px_rgba(15,118,110,0.24)] dark:border-teal-400/30 dark:bg-teal-600">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <Menu className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </button>
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
          <BrandLogo compact />
          <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-white sm:text-[0.9375rem]">
            {HEADER_TITLE}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          <KontrolcenterHelp />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="shrink-0 rounded-md p-2 text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Log ud"
            title="Log ud af KontrolCenter"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
          <div className="flex min-w-0 items-center gap-3 pl-1 sm:pl-2">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-[0.7rem] font-semibold text-[#0f766e]">
                {initialsFromName(currentUser?.fullName ?? "Ukendt bruger")}
              </span>
            )}
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold text-white">{currentUser?.fullName ?? "Bruger"}</p>
              <p className="truncate text-xs text-white/65">{currentUser?.role ?? "user"}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-14 z-40 bg-gray-900/25 backdrop-blur-[1px] lg:hidden"
          aria-label="Luk menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={`z-50 flex min-h-0 w-[16.5rem] flex-col border-r border-lc-border bg-white dark:border-gray-700 dark:bg-gray-900 max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-14 max-lg:transition-transform max-lg:duration-200 max-lg:ease-out lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:max-h-[calc(100svh-3.5rem)] lg:shrink-0 lg:self-start ${
          mobileOpen ? "max-lg:translate-x-0 max-lg:shadow-lc-card" : "max-lg:-translate-x-full"
        } `}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-11 xl:px-12">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
