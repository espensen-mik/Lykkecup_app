"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type PickOption = {
  value: string;
  label: string;
  /** Ekstra tekst under/efter navnet, fx tidsrum. */
  hint?: string;
  /** Overskrift, som valgmuligheden grupperes under. */
  group?: string;
  /** Lille advarsel ved valgmuligheden, fx "Overlapper". */
  warning?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type Props = {
  options: PickOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Giver et skjult felt, så værdien kommer med i FormData. */
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Nulstil til tom efter valg — til "Tilføj …"-knapper. */
  resetOnSelect?: boolean;
  /** Vis søgefelt; standard når der er mange valgmuligheder. */
  searchable?: boolean;
  emptyText?: string;
  className?: string;
  "aria-label"?: string;
};

type Rect = { left: number; top: number; width: number; bottom: number };

export function PickSelect({
  options,
  value: controlled,
  defaultValue = "",
  onChange,
  name,
  placeholder = "Vælg …",
  disabled,
  resetOnSelect,
  searchable,
  emptyText = "Ingen valgmuligheder",
  className = "",
  "aria-label": ariaLabel,
}: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value && value !== "");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""} ${o.group ?? ""}`.toLowerCase().includes(q));
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
      if (popRef.current?.contains(e.target as Node)) return;
      measure();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    popRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    measure();
    setOpen(true);
    if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(option: PickOption | undefined) {
    if (!option || option.disabled) return;
    if (!resetOnSelect && controlled === undefined) setInternal(option.value);
    onChange?.(option.value);
    close();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(visible.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(visible[active]);
    }
  }

  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const placeAbove = rect ? spaceBelow < 280 && rect.top > spaceBelow : false;

  const popover =
    open && rect
      ? createPortal(
          <div
            ref={popRef}
            onKeyDown={onKeyDown}
            style={{
              position: "fixed",
              left: rect.left,
              width: Math.max(rect.width, 224),
              ...(placeAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
            }}
            className="z-[300] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_16px_40px_-12px_rgb(15_23_42/0.25)] dark:border-gray-700 dark:bg-gray-900"
          >
            {showSearch ? (
              <div className="flex items-center gap-2 border-b border-gray-100 px-3 dark:border-gray-800">
                <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Søg …"
                  className="w-full bg-transparent py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
                  aria-label="Søg"
                />
              </div>
            ) : null}
            <ul id={listId} role="listbox" aria-label={ariaLabel ?? placeholder} className="max-h-72 overflow-y-auto overscroll-contain p-1">
              {visible.length === 0 ? <li className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">{query ? "Ingen match" : emptyText}</li> : null}
              {visible.map((o, i) => {
                const isSelected = o.value === value && value !== "";
                const showGroup = o.group && o.group !== visible[i - 1]?.group;
                return (
                  <li key={`${o.group ?? ""}:${o.value}`} role="presentation">
                    {showGroup ? (
                      <p className="px-3 pb-1 pt-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">{o.group}</p>
                    ) : null}
                    <div
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={o.disabled}
                      onPointerEnter={() => setActive(i)}
                      onClick={() => choose(o)}
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                        o.disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
                      } ${i === active && !o.disabled ? "bg-teal-50 dark:bg-teal-900/25" : ""} ${
                        isSelected ? "font-semibold text-[#0f766e] dark:text-teal-300" : "text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {o.icon ? <span className="shrink-0">{o.icon}</span> : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.hint ? <span className="block truncate text-xs font-normal text-gray-500 dark:text-gray-400">{o.hint}</span> : null}
                      </span>
                      {o.warning ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          {o.warning}
                        </span>
                      ) : null}
                      {isSelected ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3.5 py-2.5 text-left text-sm outline-none transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-800/50 ${
          open
            ? "border-[#14b8a6] ring-2 ring-[#14b8a6]/15"
            : "border-lc-border hover:border-gray-300 focus-visible:border-[#14b8a6] focus-visible:ring-2 focus-visible:ring-[#14b8a6]/15 dark:border-gray-600 dark:hover:border-gray-500"
        } ${className}`}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${selected ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
          {selected?.icon ? <span className="shrink-0">{selected.icon}</span> : null}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180 text-[#14b8a6]" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      {popover}
    </>
  );
}
