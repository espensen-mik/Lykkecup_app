"use client";

import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MessageSquareText,
  Newspaper,
  MapPinned,
  MessagesSquare,
  Settings,
  Info,
  Ticket,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { AuthAppUser } from "@/lib/auth-server";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import { KontrolcenterHelp } from "@/components/kontrolcenter-help";
import { fetchUnhandledClubFeedbackCount } from "@/lib/club-feedback";
import { normalizeLevelKey, sortLevelKeysForNav } from "@/lib/holddannelse";
import { LYKKECUP_EVENT_ID } from "@/lib/players";
import { supabase } from "@/lib/supabase";

const HEADER_TITLE = "LykkeCup KontrolCenter 2026";

const CUPCHAT_LAST_SEEN_KEY = "lc26_cupchat_last_seen_at";

function readCupChatLastSeen(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CUPCHAT_LAST_SEEN_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

function writeCupChatLastSeen(iso: string) {
  try {
    window.localStorage.setItem(CUPCHAT_LAST_SEEN_KEY, iso);
  } catch {
    /* ignore */
  }
}

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overblik", icon: LayoutDashboard },
  { href: "/spillere", label: "Spillere", icon: Users },
  { href: "/traenere", label: "Trænere", icon: UsersRound },
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
  const isAdmin = currentUser?.role === "admin";
  const turneringLocked = !isAdmin;
  const turneringLockedHint = "Denne del af app er under udarbejdelse";
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
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cupChatHasNew, setCupChatHasNew] = useState(false);
  const [holdLevels, setHoldLevels] = useState<string[]>([]);
  const [turneringLevels, setTurneringLevels] = useState<string[]>([]);
  const [kommentarerNyeCount, setKommentarerNyeCount] = useState(0);
  const [holdOpen, setHoldOpen] = useState(() => pathname.startsWith("/holddannelse"));
  const [turneringOpen, setTurneringOpen] = useState(() => pathname.startsWith("/turnering"));
  const [puljerOpen, setPuljerOpen] = useState(() => pathname.startsWith("/turnering/puljer"));
  const [planOpen, setPlanOpen] = useState(() => pathname.startsWith("/turnering/plan"));
  const [appIndholdOpen, setAppIndholdOpen] = useState(false);
  const [mereOpen, setMereOpen] = useState(() => ["/lister", "/analyse", "/billetsalg"].some((href) => pathname.startsWith(href)));

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
      const count = await fetchUnhandledClubFeedbackCount();
      if (!cancelled) setKommentarerNyeCount(count);
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
    if (pathname.startsWith("/app-indhold")) setAppIndholdOpen(true);
    if (["/lister", "/analyse", "/billetsalg"].some((href) => pathname.startsWith(href))) setMereOpen(true);
  }, [pathname]);

  useEffect(() => {
    const client = getAuthBrowserClient();
    let cancelled = false;

    async function refreshCupChatUnread() {
      const { data, error } = await client
        .from("holddannelse_chat_messages")
        .select("created_at")
        .eq("event_id", LYKKECUP_EVENT_ID)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setCupChatHasNew(false);
        return;
      }
      const latest = (data as { created_at?: string } | null)?.created_at;
      if (!latest) {
        setCupChatHasNew(false);
        return;
      }
      const onCupChat = pathnameRef.current === "/cup-chat";
      if (onCupChat) {
        writeCupChatLastSeen(latest);
        setCupChatHasNew(false);
        return;
      }
      const lastSeen = readCupChatLastSeen();
      if (!lastSeen) {
        setCupChatHasNew(true);
        return;
      }
      const latestMs = new Date(latest).getTime();
      const seenMs = new Date(lastSeen).getTime();
      setCupChatHasNew(Number.isFinite(latestMs) && Number.isFinite(seenMs) && latestMs > seenMs);
    }

    void refreshCupChatUnread();

    const channel = client
      .channel("app-shell-cupchat-unread")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "holddannelse_chat_messages",
          filter: `event_id=eq.${LYKKECUP_EVENT_ID}`,
        },
        () => {
          void refreshCupChatUnread();
        },
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void refreshCupChatUnread();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/cup-chat") return;
    const client = getAuthBrowserClient();
    (async () => {
      const { data } = await client
        .from("holddannelse_chat_messages")
        .select("created_at")
        .eq("event_id", LYKKECUP_EVENT_ID)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const latest = (data as { created_at?: string } | null)?.created_at;
      if (latest) writeCupChatLastSeen(latest);
      else writeCupChatLastSeen(new Date().toISOString());
      setCupChatHasNew(false);
    })();
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/holddannelse") return pathname === "/holddannelse" || pathname.startsWith("/holddannelse/");
    if (href === "/turnering/baner") return pathname === "/turnering/baner" || pathname.startsWith("/turnering/baner/");
    if (href === "/turnering") return pathname.startsWith("/turnering");
    if (href === "/turnering/puljer")
      return pathname === "/turnering/puljer" || pathname.startsWith("/turnering/puljer/");
    if (href === "/turnering/plan")
      return pathname === "/turnering/plan" || pathname.startsWith("/turnering/plan/");
    if (href === "/kampprogram") return pathname === "/kampprogram";
    if (href === "/kampprogram/check") return pathname.startsWith("/kampprogram/check");
    if (href === "/admin") return pathname === "/admin" || pathname === "/dashboard";
    if (href === "/beskeder") return pathname === "/beskeder";
    if (href === "/app-indhold") return pathname === "/app-indhold" || pathname.startsWith("/app-indhold/");
    if (href === "/analyse") return pathname === "/analyse";
    if (href === "/lister") return pathname === "/lister";
    if (href === "/cup-chat") return pathname === "/cup-chat";
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

          const showKommentarerNyeTag = item.href === "/kommentarer" && kommentarerNyeCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-label={
                showKommentarerNyeTag
                  ? `${item.label} — ${kommentarerNyeCount} nye uhåndterede kommentarer`
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
                  title={`${kommentarerNyeCount} nye uhåndterede kommentarer`}
                  className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[#0f766e] dark:bg-teal-900/50 dark:text-teal-200"
                >
                  <span>Nye</span>
                  <span className="ml-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-[#0f766e] px-1 py-[1px] text-[0.58rem] font-bold leading-none text-white dark:bg-teal-300 dark:text-[#0f766e]">
                    {kommentarerNyeCount}
                  </span>
                </span>
              ) : null}
            </Link>
          );
        })}

        <div className="mt-1 space-y-0.5">
          {/* Kun mobil: samme links som top-pills — skjules på lg+ hvor pillene vises */}
          <div className="lg:hidden">
            <div
              className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
                isActive("/lister") || isActive("/analyse") || isActive("/billetsalg")
                  ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                  : "border-transparent text-gray-700 dark:text-gray-300"
              }`}
            >
              <button
                type="button"
                onClick={() => setMereOpen((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-1 text-left text-[0.9375rem] font-medium"
                aria-label={mereOpen ? "Skjul Mere-menu" : "Vis Mere-menu"}
                aria-expanded={mereOpen}
              >
                <Menu
                  className={`h-4 w-4 shrink-0 ${
                    isActive("/lister") || isActive("/analyse") || isActive("/billetsalg")
                      ? "text-[#0f766e] dark:text-teal-300"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">Mere</span>
              </button>
              <button
                type="button"
                onClick={() => setMereOpen((v) => !v)}
                className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                aria-label={mereOpen ? "Skjul Mere-menu" : "Vis Mere-menu"}
                aria-expanded={mereOpen}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${mereOpen ? "" : "-rotate-90"}`} aria-hidden />
              </button>
            </div>
            {mereOpen ? (
              <ul className="ml-6 space-y-0.5 border-l border-gray-200 py-0.5 pl-3 dark:border-gray-700" aria-label="Mere-menu">
                <li>
                  <Link
                    href="/lister"
                    onClick={() => setMobileOpen(false)}
                    className={`flex max-w-[13rem] items-center gap-2 truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors ${
                      isActive("/lister")
                        ? "bg-teal-50 text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                    }`}
                  >
                    <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Lister
                  </Link>
                </li>
                <li>
                  <Link
                    href="/analyse"
                    onClick={() => setMobileOpen(false)}
                    className={`flex max-w-[13rem] items-center gap-2 truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors ${
                      isActive("/analyse")
                        ? "bg-teal-50 text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Analyse
                  </Link>
                </li>
                <li>
                  <Link
                    href="/billetsalg"
                    onClick={() => setMobileOpen(false)}
                    className={`flex max-w-[13rem] items-center gap-2 truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors ${
                      isActive("/billetsalg")
                        ? "bg-teal-50 text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-200"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                    }`}
                  >
                    <Ticket className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Billetsalg
                  </Link>
                </li>
              </ul>
            ) : null}
          </div>

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
          {holdOpen ? (
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
              <li key="hold-alle-hold">
                <Link
                  href="/holddannelse/alle-hold"
                  onClick={() => setMobileOpen(false)}
                  className={`flex max-w-[13rem] items-center gap-1.5 truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-semibold transition-colors ${
                    pathname === "/holddannelse/alle-hold"
                      ? "bg-teal-50 text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-200"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">Alle hold</span>
                </Link>
              </li>
            </ul>
          ) : null}
        </div>

        <div className="mt-1 space-y-0.5" title={turneringLocked ? turneringLockedHint : undefined}>
          <div
            className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
              turneringLocked
                ? "border-transparent text-gray-400 dark:text-gray-500"
                : isActive("/turnering")
                ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                : "border-transparent text-gray-700 dark:text-gray-300"
            }`}
          >
            <Link
              href="/turnering"
              onClick={(e) => {
                if (turneringLocked) {
                  e.preventDefault();
                  return;
                }
                setMobileOpen(false);
              }}
              aria-disabled={turneringLocked}
              tabIndex={turneringLocked ? -1 : undefined}
              className={`flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-3 pr-1 text-left text-[0.9375rem] font-medium ${
                turneringLocked ? "cursor-not-allowed text-gray-400 dark:text-gray-500" : ""
              }`}
            >
              <CalendarDays
                className={`h-4 w-4 shrink-0 ${
                  turneringLocked
                    ? "text-gray-400 dark:text-gray-500"
                    : isActive("/turnering")
                      ? "text-[#0f766e] dark:text-teal-300"
                      : "text-gray-400 dark:text-gray-500"
                }`}
                strokeWidth={2}
                aria-hidden
              />
              <span className="truncate">Turnering</span>
            </Link>
            <button
              type="button"
              disabled={turneringLocked}
              onClick={() => setTurneringOpen((v) => !v)}
              title={turneringLocked ? turneringLockedHint : undefined}
              className={`mr-1 inline-flex h-7 w-7 items-center justify-center rounded-md ${
                turneringLocked
                  ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
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
              <Link
                href="/turnering/baner"
                onClick={(e) => {
                  if (turneringLocked) {
                    e.preventDefault();
                    return;
                  }
                  setMobileOpen(false);
                }}
                aria-disabled={turneringLocked}
                tabIndex={turneringLocked ? -1 : undefined}
                className={`flex items-center gap-2 rounded-md border-l-2 py-1.5 pl-2 pr-2 text-[0.86rem] font-medium transition-colors ${
                  turneringLocked
                    ? "cursor-not-allowed border-transparent text-gray-400 dark:text-gray-500"
                    : isActive("/turnering/baner")
                    ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                    : "border-transparent text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60"
                }`}
                title={turneringLocked ? turneringLockedHint : undefined}
              >
                <Settings
                  className={`h-3.5 w-3.5 shrink-0 ${
                    turneringLocked
                      ? "text-gray-400 dark:text-gray-500"
                      : isActive("/turnering/baner")
                      ? "text-[#0f766e] dark:text-teal-300"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">Opsætning</span>
              </Link>

              <div className="space-y-0.5">
                <div
                  className={`flex items-center gap-1.5 rounded-md border-l-2 py-1 ${
                    turneringLocked
                      ? "border-transparent text-gray-400 dark:text-gray-500"
                      : isActive("/turnering/puljer")
                      ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                      : "border-transparent text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Link
                    href="/turnering/puljer"
                    onClick={(e) => {
                      if (turneringLocked) {
                        e.preventDefault();
                        return;
                      }
                      setMobileOpen(false);
                    }}
                    aria-disabled={turneringLocked}
                    tabIndex={turneringLocked ? -1 : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 pr-1 text-[0.86rem] font-medium ${
                      turneringLocked ? "cursor-not-allowed text-gray-400 dark:text-gray-500" : ""
                    }`}
                  >
                    <span className="truncate">Puljer</span>
                  </Link>
                  <button
                    type="button"
                    disabled={turneringLocked}
                    onClick={() => setPuljerOpen((v) => !v)}
                    className={`mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md ${
                      turneringLocked
                        ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
                        : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
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
                            onClick={(e) => {
                              if (turneringLocked) {
                                e.preventDefault();
                                return;
                              }
                              setMobileOpen(false);
                            }}
                            aria-disabled={turneringLocked}
                            tabIndex={turneringLocked ? -1 : undefined}
                            className={`block max-w-[13rem] truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors ${
                              turneringLocked
                                ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
                                : subActive
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
                    turneringLocked
                      ? "border-transparent text-gray-400 dark:text-gray-500"
                      : isActive("/turnering/plan")
                      ? "border-[#14b8a6] bg-teal-50/90 text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                      : "border-transparent text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <Link
                    href="/turnering/plan"
                    onClick={(e) => {
                      if (turneringLocked) {
                        e.preventDefault();
                        return;
                      }
                      setMobileOpen(false);
                    }}
                    aria-disabled={turneringLocked}
                    tabIndex={turneringLocked ? -1 : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 pr-1 text-[0.86rem] font-medium ${
                      turneringLocked ? "cursor-not-allowed text-gray-400 dark:text-gray-500" : ""
                    }`}
                  >
                    <span className="truncate">Turneringsplan</span>
                  </Link>
                  <button
                    type="button"
                    disabled={turneringLocked}
                    onClick={() => setPlanOpen((v) => !v)}
                    className={`mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md ${
                      turneringLocked
                        ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
                        : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
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
                            onClick={(e) => {
                              if (turneringLocked) {
                                e.preventDefault();
                                return;
                              }
                              setMobileOpen(false);
                            }}
                            aria-disabled={turneringLocked}
                            tabIndex={turneringLocked ? -1 : undefined}
                            className={`block max-w-[13rem] truncate rounded-md py-1.5 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors ${
                              turneringLocked
                                ? "cursor-not-allowed text-gray-400 dark:text-gray-500"
                                : subActive
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

        <Link
          href="/kampprogram"
          onClick={(e) => {
            if (turneringLocked) {
              e.preventDefault();
              return;
            }
            setMobileOpen(false);
          }}
          aria-disabled={turneringLocked}
          tabIndex={turneringLocked ? -1 : undefined}
          title={turneringLocked ? turneringLockedHint : undefined}
          className={`mt-1 flex items-center gap-3 rounded-md border-l-2 py-2.5 pr-3 text-[0.9375rem] font-medium transition-colors ${
            turneringLocked
              ? "cursor-not-allowed border-transparent pl-3 text-gray-400 dark:text-gray-500"
              : isActive("/kampprogram")
                ? "border-[#14b8a6] bg-teal-50/90 pl-[10px] text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                : "border-transparent pl-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white"
          }`}
        >
          <ClipboardList
            className={`h-4 w-4 shrink-0 ${
              turneringLocked
                ? "text-gray-400 dark:text-gray-500"
                : isActive("/kampprogram")
                  ? "text-[#0f766e] dark:text-teal-300"
                  : "text-gray-400 dark:text-gray-500"
            }`}
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate">Kampprogram</span>
        </Link>

        <Link
          href="/kampprogram/check"
          onClick={(e) => {
            if (turneringLocked) {
              e.preventDefault();
              return;
            }
            setMobileOpen(false);
          }}
          aria-disabled={turneringLocked}
          tabIndex={turneringLocked ? -1 : undefined}
          title={turneringLocked ? turneringLockedHint : undefined}
          className={`flex items-center gap-3 rounded-md border-l-2 py-2 pr-3 text-[0.8125rem] font-medium transition-colors ${
            turneringLocked
              ? "cursor-not-allowed border-transparent pl-6 text-gray-400 dark:text-gray-500"
              : isActive("/kampprogram/check")
                ? "border-[#14b8a6] bg-teal-50/90 pl-[22px] text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                : "border-transparent pl-6 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
          }`}
        >
          <ShieldCheck
            className={`h-3.5 w-3.5 shrink-0 ${
              turneringLocked
                ? "text-gray-400 dark:text-gray-500"
                : isActive("/kampprogram/check")
                  ? "text-[#0f766e] dark:text-teal-300"
                  : "text-gray-400 dark:text-gray-500"
            }`}
            strokeWidth={2}
            aria-hidden
          />
          <span className="truncate">LykkeCup Check</span>
        </Link>

        <div className="mt-auto shrink-0 pb-1 pt-4">
          <Link
            href="/cup-chat"
            onClick={() => setMobileOpen(false)}
            aria-current={isActive("/cup-chat") ? "page" : undefined}
            aria-label={
              cupChatHasNew && !isActive("/cup-chat") ? "CupChat — nye beskeder" : "CupChat"
            }
            className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-[0.9375rem] font-semibold transition-colors ${
              isActive("/cup-chat")
                ? "border-[#163358] bg-[#163358] text-white"
                : "border-transparent text-[#163358] hover:bg-[#163358]/10 hover:text-[#163358] dark:text-[#8fb0d8] dark:hover:bg-[#163358]/25 dark:hover:text-[#b8cdea]"
            }`}
          >
            <span className="relative shrink-0">
              <MessagesSquare
                className={`h-4 w-4 shrink-0 ${isActive("/cup-chat") ? "text-white" : "text-[#163358] dark:text-[#8fb0d8]"}`}
                strokeWidth={2.25}
                aria-hidden
              />
              {cupChatHasNew && !isActive("/cup-chat") ? (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900"
                  title="Nye beskeder i CupChat"
                  aria-hidden
                />
              ) : null}
            </span>
            <span className="min-w-0 flex-1 truncate">CupChat</span>
          </Link>
        </div>
      </nav>
      <div className="shrink-0 border-t border-teal-200/80 bg-teal-50/35 p-3 dark:border-teal-900/40 dark:bg-teal-950/12 lg:p-4">
        <div className="flex items-center justify-between gap-2 rounded-md bg-white/70 px-3 py-1.5 dark:bg-gray-900/40">
          <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-lc-muted dark:text-gray-500">App indhold</p>
          <button
            type="button"
            onClick={() => setAppIndholdOpen((v) => !v)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label={appIndholdOpen ? "Skjul App indhold" : "Vis App indhold"}
            aria-expanded={appIndholdOpen}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${appIndholdOpen ? "" : "-rotate-90"}`} aria-hidden />
          </button>
        </div>
        {appIndholdOpen ? (
          <div className="mt-2 space-y-0.5">
            <Link
              href="/app-indhold"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-md py-2 pr-3 text-[0.86rem] font-medium transition-colors border-l-2 ${
                isActive("/app-indhold")
                  ? "border-[#14b8a6] bg-teal-50/90 pl-[10px] text-[#0f766e] dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-200"
                  : "border-transparent pl-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white"
              }`}
            >
              <MessageSquareText className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">App indhold (oversigt)</span>
            </Link>
            <Link href="/app-indhold/dagens-program" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[0.8125rem] text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Dagens program
            </Link>
            <Link href="/app-indhold/find-rundt-i-mch" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[0.8125rem] text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200">
              <MapPinned className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Find rundt i MCH
            </Link>
            <Link href="/app-indhold/praktisk-info" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[0.8125rem] text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Praktisk info
            </Link>
            <Link href="/app-indhold/nyt-fra-lykkeliga" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[0.8125rem] text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200">
              <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Nyt fra LykkeLiga
            </Link>
            <Link
              href="/beskeder"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[0.8125rem] transition-colors ${
                isActive("/beskeder")
                  ? "bg-[rgb(223_103_99/0.08)] text-[#b84e4a] dark:bg-[rgb(223_103_99/0.12)] dark:text-[#e8a09c]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Beskeder
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AnalyticsTracker />
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-teal-500/40 bg-[#14b8a6] px-4 text-white shadow-[0_4px_18px_rgba(15,118,110,0.24)] print:hidden dark:border-teal-400/30 dark:bg-teal-600 dark:shadow-[0_4px_18px_rgba(15,118,110,0.2)]">
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
        <Link href="/admin" className="flex min-w-0 flex-1 items-center gap-3">
          <BrandLogo compact />
          <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-white sm:text-[0.9375rem]">
            {HEADER_TITLE}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/lister"
            onClick={() => setMobileOpen(false)}
            className={`hidden shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0f766e] shadow-sm outline-none transition hover:bg-white/95 hover:shadow focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] lg:inline-flex lg:px-4 lg:py-2 lg:text-sm ${
              isActive("/lister") ? "ring-2 ring-white/90 ring-offset-2 ring-offset-[#14b8a6] dark:ring-offset-teal-600" : ""
            }`}
            aria-current={isActive("/lister") ? "page" : undefined}
            title="Lister til udskrift — hold og spillere"
          >
            <ClipboardList className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Lister
          </Link>
          <Link
            href="/analyse"
            onClick={() => setMobileOpen(false)}
            className={`hidden shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0f766e] shadow-sm outline-none transition hover:bg-white/95 hover:shadow focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] lg:inline-flex lg:px-4 lg:py-2 lg:text-sm ${
              isActive("/analyse") ? "ring-2 ring-white/90 ring-offset-2 ring-offset-[#14b8a6] dark:ring-offset-teal-600" : ""
            }`}
            aria-current={isActive("/analyse") ? "page" : undefined}
            title="Brugsstatistik for app og KontrolCenter"
          >
            <BarChart3 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Analyse
          </Link>
          <Link
            href="/billetsalg"
            onClick={() => setMobileOpen(false)}
            className={`hidden shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0f766e] shadow-sm outline-none transition hover:bg-white/95 hover:shadow focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] lg:inline-flex lg:px-4 lg:py-2 lg:text-sm ${
              isActive("/billetsalg") ? "ring-2 ring-white/90 ring-offset-2 ring-offset-[#14b8a6] dark:ring-offset-teal-600" : ""
            }`}
            aria-current={isActive("/billetsalg") ? "page" : undefined}
            title="Live billetsalg fra WordPress"
          >
            <Ticket className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Billetsalg
          </Link>
          <KontrolcenterHelp />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0f766e] shadow-sm outline-none transition hover:bg-white/95 hover:shadow focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.98] sm:px-4 sm:py-2 sm:text-sm"
            aria-label="Log ud"
            title="Log ud af KontrolCenter"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Log ud
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
        className={`z-50 flex min-h-0 w-[16.5rem] flex-col border-r border-lc-border bg-white print:hidden dark:border-gray-700 dark:bg-gray-900 max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-14 max-lg:transition-transform max-lg:duration-200 max-lg:ease-out lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:max-h-[calc(100svh-3.5rem)] lg:shrink-0 lg:self-start ${
          mobileOpen ? "max-lg:translate-x-0 max-lg:shadow-lc-card" : "max-lg:-translate-x-full"
        } `}
      >
        {sidebar}
      </aside>

      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-11 xl:px-12">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
