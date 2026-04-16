"use client";

import { AlignJustify, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/lykkecup26", label: "Forside" },
  { href: "/lykkecup26/side-1", label: "Side 1" },
  { href: "/lykkecup26/side-2", label: "Side 2" },
  { href: "/lykkecup26/side-3", label: "Side 3" },
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/92 pt-[env(safe-area-inset-top)] backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:h-[3.75rem] sm:px-6">
        <Link
          href="/lykkecup26"
          className="group flex min-w-0 flex-1 items-center gap-3"
          onClick={() => setOpen(false)}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/18 to-cyan-500/14 ring-1 ring-teal-700/10 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.65)]">
            <span className="text-[13px] font-bold tracking-[0.08em] text-teal-800">LC</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.02em] text-stone-900">
              LykkeCup 26
            </p>
            <p className="truncate text-[11px] font-medium leading-tight tracking-[0.01em] text-stone-500">
              Spillere & familier
            </p>
          </div>
        </Link>

        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stone-200/80 bg-white/95 text-stone-600 shadow-[0_1px_2px_rgb(15_23_42/0.05)] transition hover:border-teal-300/55 hover:bg-teal-50/40 hover:text-teal-900 active:scale-[0.97] focus-visible:outline focus-visible:ring-2 focus-visible:ring-teal-500/35"
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
            className="fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 bg-stone-900/30 backdrop-blur-[3px] sm:top-[calc(3.75rem+env(safe-area-inset-top))]"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <nav
            id="lc26-nav-drawer"
            className="fixed right-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 flex max-h-[min(70vh,420px)] w-[min(100%,20rem)] flex-col overflow-y-auto rounded-bl-2xl border border-stone-200/90 border-r-0 border-t-0 bg-white shadow-[0_12px_40px_-8px_rgb(15_23_42/0.18)] sm:top-[calc(3.75rem+env(safe-area-inset-top))]"
          >
            <ul className="flex flex-col py-2">
              {NAV.map((item) => {
                const active =
                  item.href === "/lykkecup26"
                    ? pathname === "/lykkecup26" || pathname === "/lykkecup26/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block px-5 py-3.5 text-[0.9375rem] font-medium transition ${
                        active
                          ? "bg-gradient-to-r from-teal-50 to-white text-teal-900"
                          : "text-stone-700 hover:bg-stone-50 hover:text-stone-900"
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
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
