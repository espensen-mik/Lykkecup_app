"use client";

import {
  AlignJustify,
  CalendarDays,
  CircleUserRound,
  Home,
  Info,
  LayoutGrid,
  Mail,
  MapPinned,
  Newspaper,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLc26Inbox } from "@/components/lykkecup26/use-lc26-inbox";
import {
  getSavedProfile,
  getSavedProfileHref,
  LC26_SAVED_PLAYER_KEY,
  LC26_SAVED_PROFILE_EVENT,
  type Lc26SavedProfile,
} from "@/lib/lc26-saved-player";

const INBOX_HREF = "/lykkecup26/beskeder" as const;
const INBOX_BRAND = "#df6763";

const NAV_BASE = [
  { href: "/lykkecup26", label: "Forside" },
  { href: INBOX_HREF, label: "Beskeder" },
  { href: "/lykkecup26/side-1", label: "Dagens program" },
  { href: "/lykkecup26/side-2", label: "Find rundt i MCH" },
  { href: "/lykkecup26/side-3", label: "Praktisk info" },
  { href: "/lykkecup26/nyt-fra-lykkeliga", label: "Nyt fra LykkeLiga" },
] as const;

const NAV_ICON: Partial<Record<(typeof NAV_BASE)[number]["href"], typeof Home>> = {
  "/lykkecup26": Home,
  [INBOX_HREF]: Mail,
  "/lykkecup26/side-1": CalendarDays,
  "/lykkecup26/side-2": MapPinned,
  "/lykkecup26/side-3": Info,
  "/lykkecup26/nyt-fra-lykkeliga": Newspaper,
};

function NavMenuIcon({ href, active }: { href: string; active: boolean }) {
  const Icon = NAV_ICON[href as keyof typeof NAV_ICON] ?? LayoutGrid;
  return (
    <Icon
      className={`h-[17px] w-[17px] shrink-0 transition-colors ${
        active ? "text-lc26-teal" : "text-lc26-navy/45 group-hover:text-lc26-navy/70"
      }`}
      strokeWidth={1.85}
      aria-hidden
    />
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [savedProfile, setSavedProfile] = useState<Lc26SavedProfile | null>(null);
  const { unreadCount: inboxUnread } = useLc26Inbox();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    setSavedProfile(getSavedProfile());
    function updateSaved() {
      setSavedProfile(getSavedProfile());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === LC26_SAVED_PLAYER_KEY || e.key === null) {
        updateSaved();
      }
    }
    window.addEventListener(LC26_SAVED_PROFILE_EVENT, updateSaved);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LC26_SAVED_PROFILE_EVENT, updateSaved);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  const mitHref = savedProfile ? getSavedProfileHref(savedProfile) : null;
  const nav = mitHref ? ([NAV_BASE[0], { href: mitHref, label: "Mit LykkeCup" }, ...NAV_BASE.slice(1)] as const) : NAV_BASE;

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/90 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-[3.75rem] sm:px-6">
        <Link
          href="/lykkecup26"
          className="group flex min-w-0 flex-1 items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <Trophy className="h-[22px] w-[22px] shrink-0 text-lc26-teal" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.02em] text-lc26-navy">
              LykkeCup 26
            </p>
            <p className="truncate text-[11px] font-medium leading-tight text-lc26-navy/45">
              Danmarks lykkeligste sæsonfinale.
            </p>
          </div>
        </Link>

        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-lc26-navy/70 transition hover:border-lc26-teal/35 hover:text-lc26-teal active:scale-[0.97] focus-visible:outline focus-visible:ring-2 focus-visible:ring-lc26-teal/30"
          aria-expanded={open}
          aria-controls="lc26-nav-drawer"
          aria-label={open ? "Luk menu" : "Åbn menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          ) : (
            <AlignJustify className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 bg-lc26-navy/20 backdrop-blur-[2px] sm:top-[calc(3.75rem+env(safe-area-inset-top))]"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <nav
            id="lc26-nav-drawer"
            className="fixed right-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 flex max-h-[min(70vh,420px)] w-[min(100%,20rem)] flex-col overflow-y-auto rounded-bl-2xl border border-stone-200/90 border-r-0 border-t-0 bg-white shadow-lg sm:top-[calc(3.75rem+env(safe-area-inset-top))]"
          >
            <ul className="flex flex-col py-2">
              {nav.map((item) => {
                const active =
                  item.href === "/lykkecup26"
                    ? pathname === "/lykkecup26" || pathname === "/lykkecup26/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const isMit = Boolean(mitHref && item.href === mitHref);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group block border-l-[3px] px-5 py-3.5 text-[0.9375rem] font-medium transition ${
                        isMit
                          ? active
                            ? "border-lc26-teal bg-gradient-to-r from-lc26-teal to-lc26-teal/90 text-white shadow-[0_10px_24px_-14px_rgb(0_161_130/0.75)]"
                            : "border-lc26-teal bg-gradient-to-r from-lc26-teal/[0.95] to-lc26-teal/[0.88] text-white shadow-[0_10px_24px_-14px_rgb(0_161_130/0.7)] hover:from-lc26-teal hover:to-lc26-teal/95"
                          : active
                          ? "border-lc26-teal bg-lc26-teal/[0.06] text-lc26-navy"
                          : "border-transparent text-lc26-navy/80 hover:bg-stone-50 hover:text-lc26-navy"
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      {isMit ? (
                        <span className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <CircleUserRound className="h-[17px] w-[17px] shrink-0" strokeWidth={1.85} aria-hidden />
                            <span className="min-w-0">
                              <span className="block truncate">{item.label}</span>
                              {savedProfile?.name ? (
                                <span className="block truncate text-[11px] font-normal text-white/82">{savedProfile.name}</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                            Aktiv
                          </span>
                        </span>
                      ) : (
                        <span className="flex w-full min-w-0 items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <NavMenuIcon href={item.href} active={active} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.href === INBOX_HREF && inboxUnread > 0 ? (
                            <span
                              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
                              style={{ backgroundColor: INBOX_BRAND }}
                              aria-label={`${inboxUnread} ulæste beskeder`}
                            >
                              {inboxUnread > 9 ? "9+" : inboxUnread}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      ) : null}
    </header>
  );
}
