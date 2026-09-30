"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PickOption } from "@/components/ui/pick-select";

type Props = {
  options: PickOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  "aria-label"?: string;
};

type Rect = { left: number; top: number; width: number; bottom: number };

export function PickMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Vælg …",
  disabled,
  emptyText = "Ingen valgmuligheder",
  "aria-label": ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<Rect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = new Set(value);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const measure = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.top, width: r.width, bottom: r.bottom });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) measure();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const labelText =
    value.length === 0
      ? placeholder
      : value.length <= 2
        ? options
            .filter((o) => selected.has(o.value))
            .map((o) => o.label)
            .join(", ")
        : `${value.length} valgt`;

  const placeAbove = rect ? window.innerHeight - rect.bottom < 300 && rect.top > window.innerHeight - rect.bottom : false;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
        onClick={() => {
          if (open) return setOpen(false);
          setQuery("");
          measure();
          setOpen(true);
          requestAnimationFrame(() => searchRef.current?.focus());
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3.5 py-2.5 text-left text-sm outline-none transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800/50 ${
          open
            ? "border-[#14b8a6] ring-2 ring-[#14b8a6]/15"
            : "border-lc-border hover:border-gray-300 focus-visible:border-[#14b8a6] focus-visible:ring-2 focus-visible:ring-[#14b8a6]/15 dark:border-gray-600"
        }`}
      >
        <span className={`truncate ${value.length ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
          {labelText}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180 text-[#14b8a6]" : ""}`}
          aria-hidden
        />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={popRef}
              style={{
                position: "fixed",
                left: rect.left,
                width: Math.max(rect.width, 260),
                ...(placeAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
              }}
              className="z-[300] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_16px_40px_-12px_rgb(15_23_42/0.25)] dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 dark:border-gray-800">
                <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Søg …"
                  className="w-full bg-transparent py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                  aria-label="Søg"
                />
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 text-xs dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => onChange([...new Set([...value, ...visible.filter((o) => !o.disabled).map((o) => o.value)])])}
                  className="font-semibold text-[#0f766e] hover:underline dark:text-teal-300"
                >
                  Vælg {query ? "viste" : "alle"}
                </button>
                <button type="button" onClick={() => onChange([])} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
                  Ryd
                </button>
              </div>
              <ul role="listbox" aria-multiselectable="true" className="max-h-72 overflow-y-auto overscroll-contain p-1">
                {visible.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">{query ? "Ingen match" : emptyText}</li>
                ) : null}
                {visible.map((o, i) => {
                  const isSelected = selected.has(o.value);
                  const showGroup = o.group && o.group !== visible[i - 1]?.group;
                  return (
                    <li key={o.value} role="presentation">
                      {showGroup ? (
                        <p className="px-3 pb-1 pt-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                          {o.group}
                        </p>
                      ) : null}
                      <div
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        onClick={() => !o.disabled && toggle(o.value)}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !o.disabled) {
                            e.preventDefault();
                            toggle(o.value);
                          }
                        }}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-teal-50 focus-visible:bg-teal-50 dark:hover:bg-teal-900/25 dark:focus-visible:bg-teal-900/25 ${
                          o.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected ? "border-[#14b8a6] bg-[#14b8a6] text-white" : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {isSelected ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
                        </span>
                        {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-gray-800 dark:text-gray-200">{o.label}</span>
                          {o.hint ? <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{o.hint}</span> : null}
                        </span>
                        {o.warning ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {o.warning}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
