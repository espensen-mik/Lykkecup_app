"use client";

import { ArrowRight, Check, ChevronDown, HeartHandshake, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { submitVolunteerSignupAction, type VolunteerActionResult } from "@/lib/volunteers-actions";
import { AVAILABILITY_OPTIONS, AVAILABILITY_TIMEBOX, TSHIRT_SIZES } from "@/lib/volunteers";

const ACCENT = "#22b573";

const glassPanel = "rounded-3xl bg-white/[0.08] p-6 ring-1 ring-white/15 backdrop-blur-xl sm:p-8 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.5)]";

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 text-[0.9375rem] text-white outline-none transition placeholder:text-white/35 hover:border-white/25 focus:border-[#5ee0a4]/70 focus:bg-white/[0.12] focus:ring-4 focus:ring-[#22b573]/20";

const MONTHS = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];

function Step({ number, title, hint, children }: { number: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={`${glassPanel} relative space-y-5 has-[[aria-expanded=true]]:z-20`}>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22b573] text-sm font-bold text-white shadow-[0_0_20px_rgb(34_181_115/0.5)]">
          {number}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {hint ? <p className="text-sm text-white/60">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-sm font-medium text-white/80">
      {children}
      {required ? <span className="text-[#5ee0a4]"> *</span> : null}
    </span>
  );
}

type SelectOption = { value: string; label: string };

function GlassSelect({ name, placeholder, options }: { name: string; placeholder: string; options: SelectOption[] }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function choose(index: number) {
    setValue(options[index].value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        role="combobox"
        aria-label={placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${inputClass} flex items-center justify-between gap-1 pl-3 pr-2.5 text-left sm:pl-4 sm:pr-3 ${
          open ? "border-[#5ee0a4]/70 bg-white/[0.12] ring-4 ring-[#22b573]/20" : ""
        }`}
      >
        <span className={`truncate ${selected ? "text-white" : "text-white/55"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition ${open ? "rotate-180 text-[#5ee0a4]" : ""}`} aria-hidden />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={placeholder}
          className="absolute left-0 right-0 z-30 mt-2 max-h-64 min-w-[6.5rem] overflow-y-auto overscroll-contain rounded-2xl bg-[#163358]/90 p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/15 backdrop-blur-2xl [scrollbar-color:rgb(255_255_255/0.2)_transparent] [scrollbar-width:thin]"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-[0.9375rem] transition ${
                  i === active ? "bg-white/10 text-white" : "text-white/80"
                } ${isSelected ? "font-semibold text-[#5ee0a4]" : ""}`}
              >
                {o.label}
                {isSelected ? <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ChoiceCards({
  name,
  options,
  required,
  onChange,
}: {
  name: string;
  options: readonly { value: string; label: string; hint?: string }[];
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.value} className="group relative cursor-pointer">
          <input
            type="radio"
            name={name}
            value={o.value}
            required={required}
            onChange={() => onChange?.(o.value)}
            className="peer sr-only"
          />
          <span className="flex h-full items-start gap-3 rounded-2xl border border-white/15 bg-white/[0.05] p-4 transition group-hover:border-white/30 group-hover:bg-white/[0.09] peer-checked:border-[#5ee0a4]/80 peer-checked:bg-[#22b573]/20 peer-checked:shadow-[0_0_24px_-6px_rgb(34_181_115/0.6)] peer-focus-visible:ring-4 peer-focus-visible:ring-[#22b573]/30">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-white/40 transition group-has-[:checked]:border-[#22b573] group-has-[:checked]:bg-[#22b573]">
              <Check className="h-3 w-3 text-white opacity-0 transition group-has-[:checked]:opacity-100" strokeWidth={3.5} aria-hidden />
            </span>
            <span>
              <span className="block text-[0.9375rem] font-semibold">{o.label}</span>
              {o.hint ? <span className="mt-0.5 block text-sm text-white/60">{o.hint}</span> : null}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function PillChoices({ name, options, required }: { name: string; options: readonly { value: string; label: string }[]; required?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input type="radio" name={name} value={o.value} required={required} className="peer sr-only" />
          <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:bg-white/[0.12] peer-checked:border-transparent peer-checked:bg-white peer-checked:text-[#0f2442] peer-focus-visible:ring-4 peer-focus-visible:ring-white/30">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function VolunteerSignupForm({ eventDateLabel }: { eventDateLabel: string }) {
  const [state, setState] = useState<VolunteerActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [availability, setAvailability] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await submitVolunteerSignupAction(form);
      setState(result);
      if (result.ok) topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (state?.ok) {
    return (
      <div ref={topRef} className={`${glassPanel} scroll-mt-8 py-12 text-center sm:py-16`}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#22b573]/25 text-[#5ee0a4] ring-1 ring-[#5ee0a4]/40 shadow-[0_0_40px_rgb(34_181_115/0.45)]">
          <HeartHandshake className="h-10 w-10" aria-hidden />
        </div>
        <h2 className="mt-6 font-[family-name:var(--font-lc27-display)] text-3xl uppercase tracking-[0.06em] sm:text-4xl">
          Tak – du er med!
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/75">
          Tusind tak, fordi du vil være en del af A-TEAMET. Vi kontakter dig, så snart vi er klar med mere info om dagen.
        </p>
        <p className="mt-6 text-sm font-semibold text-[#5ee0a4]">Vi glæder os til at skabe lykke sammen med dig!</p>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-8">
      <form onSubmit={onSubmit} className="relative">
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
          <Step number={1} title="Om dig">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <Label required>Fornavn</Label>
                <input name="first_name" required autoComplete="given-name" className={inputClass} />
              </label>
              <label>
                <Label required>Efternavn</Label>
                <input name="last_name" required autoComplete="family-name" className={inputClass} />
              </label>
              <label>
                <Label required>E-mail</Label>
                <input name="email" type="email" required autoComplete="email" placeholder="navn@eksempel.dk" className={inputClass} />
              </label>
              <label>
                <Label required>Mobilnummer</Label>
                <input name="phone" type="tel" required autoComplete="tel" placeholder="12 34 56 78" className={inputClass} />
              </label>
            </div>
            <fieldset>
              <legend className="mb-1.5 block text-sm font-medium text-white/80">Fødselsdato</legend>
              <div className="grid grid-cols-3 gap-3">
                <GlassSelect
                  name="birth_day"
                  placeholder="Dag"
                  options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                />
                <GlassSelect
                  name="birth_month"
                  placeholder="Måned"
                  options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                />
                <GlassSelect
                  name="birth_year"
                  placeholder="År"
                  options={Array.from({ length: 90 }, (_, i) => String(currentYear - 10 - i)).map((y) => ({ value: y, label: y }))}
                />
              </div>
            </fieldset>
            <div>
              <Label required>Har du tidligere været frivillig til LykkeCup?</Label>
              <PillChoices
                name="previous_volunteer"
                required
                options={[
                  { value: "yes", label: "Ja" },
                  { value: "no", label: "Nej" },
                ]}
              />
            </div>
          </Step>

          <Step number={2} title="Din dag" hint={eventDateLabel ? `LykkeCup d. ${eventDateLabel}` : undefined}>
            <div>
              <Label required>Hvornår kan du hjælpe til?</Label>
              <ChoiceCards
                name="availability"
                required
                onChange={setAvailability}
                options={AVAILABILITY_OPTIONS.map((o) => ({
                  value: o,
                  label: o === AVAILABILITY_TIMEBOX ? "I et bestemt tidsrum" : "Hele dagen",
                  hint: o,
                }))}
              />
            </div>
            {availability === AVAILABILITY_TIMEBOX ? (
              <label className="block">
                <Label>Hvornår kan du?</Label>
                <input name="availability_note" placeholder="Fx kl. 9–13" className={inputClass} />
              </label>
            ) : null}
            <div>
              <Label>T-shirt størrelse</Label>
              <PillChoices name="tshirt_size" options={TSHIRT_SIZES.map((s) => ({ value: s, label: s }))} />
            </div>
          </Step>

          <Step number={3} title="Ønsker og hensyn" hint="Frivilligt – men det hjælper os med at sætte holdet.">
            <label className="block">
              <Label>Ønsker du en bestemt opgave på dagen?</Label>
              <input name="task_wish" placeholder="Fx café, indgang, bane-ansvarlig …" className={inputClass} />
            </label>
            <label className="block">
              <Label>Vil du gerne stå sammen med en bestemt person?</Label>
              <input name="buddy_wish" placeholder="Navn på din makker" className={inputClass} />
            </label>
            <label className="block">
              <Label>Særlige kosthensyn</Label>
              <input name="dietary_needs" placeholder="Fx vegetar, glutenfri, allergier" className={inputClass} />
            </label>
            <div>
              <Label required>Må vi bruge billeder og videoer af dig?</Label>
              <PillChoices
                name="photo_consent"
                required
                options={[
                  { value: "yes", label: "Ja, gerne" },
                  { value: "no", label: "Nej tak" },
                ]}
              />
            </div>
            <label className="block">
              <Label>Andet, vi skal vide?</Label>
              <textarea name="other_info" rows={3} className={inputClass} />
            </label>
          </Step>

          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
            <label>
              Lad dette felt være tomt
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className={`${glassPanel} space-y-5`}>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-white/80">
              <input type="checkbox" name="gdpr_consent" required className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer" style={{ accentColor: ACCENT }} />
              <span>
                Jeg accepterer, at Lykkeliga gemmer mine oplysninger til brug for planlægningen af LykkeCup.
                <span className="text-[#5ee0a4]"> *</span>
              </span>
            </label>

            {state && !state.ok ? (
              <p className="rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-100" role="alert">
                {state.message}
              </p>
            ) : null}

            <button
              type="submit"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#22b573] px-6 py-4 text-base font-bold text-white shadow-[0_10px_40px_-8px_rgb(34_181_115/0.7)] transition hover:bg-[#28c47f] hover:shadow-[0_14px_50px_-8px_rgb(34_181_115/0.85)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#22b573]/40 disabled:cursor-wait"
            >
              {pending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Sender …
                </>
              ) : (
                <>
                  Tilmeld mig som frivillig
                  <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" aria-hidden />
                </>
              )}
            </button>
            <p className="text-center text-xs text-white/50">
              Felter med <span className="text-[#5ee0a4]">*</span> skal udfyldes.
            </p>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
