"use client";

import { HelpCircle, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

export function KontrolcenterHelp() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0f766e] shadow-sm outline-none transition hover:bg-white/95 hover:shadow focus-visible:ring-2 focus-visible:ring-white/60 sm:px-4 sm:py-2 sm:text-sm"
        aria-label="Hjælp og vejledning"
        title="Åbn hjælp — vejledning til KontrolCenter"
      >
        <HelpCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        Hjælp
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
            aria-label="Luk hjælp"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">
                  Hjælp til LykkeCup KontrolCenter
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Kort vejledning til daglig brug
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                aria-label="Luk"
              >
                <X className="h-5 w-5" strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              <GuideSections />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function GuideSections() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Hvad er det?</h3>
        <p className="mt-2">
          LykkeCup KontrolCenter er et internt værktøj til at følge spillere, klubber, kommentarer, holddannelse og
          turnering (puljer og kampe). Du arbejder i en menu til venstre og ser indholdet i midten.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Log ind og log ud</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Du logger ind med den e-mail og adgangskode, som er oprettet til dig i systemet.</li>
          <li>
            Tryk <strong>Log ud</strong> (øverst til højre), når du er færdig — særligt på delte computere.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Glemt adgangskode</h3>
        <p className="mt-2">
          På login-siden kan du vælge <strong>Glemt kode?</strong> og indtaste din e-mail. Du får et link til at sætte en
          ny adgangskode. Følg linket i mailen og opret den nye kode på den side, der åbnes — derefter kan du logge ind som
          vanligt.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Menuen til venstre</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Overblik</strong> — tal og oversigter for arrangementet.
          </li>
          <li>
            <strong>Spillere</strong> — liste over tilmeldte spillere; søg og filtrér efter behov.
          </li>
          <li>
            <strong>Klubber</strong> — spillere grupperet efter klub.
          </li>
          <li>
            <strong>Kommentarer</strong> — feedback fra klubber; der kan være et mærke <strong>Nye</strong>, hvis der er nye
            kommentarer inden for de seneste 24 timer.
          </li>
          <li>
            <strong>Holddannelse</strong> — fold ud for at se niveauer (fx CoolStars, SuperStars). Vælg et niveau for at
            danne og redigere hold.
          </li>
          <li>
            <strong>Turnering</strong> — fold ud for <strong>Puljer</strong> og <strong>Turneringsplan</strong>. Under hvert
            punkt vælger du niveau for at arbejde med puljer eller kampprogram for det niveau.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Holddannelse (kort)</h3>
        <p className="mt-2">
          På niveau-siderne flytter du spillere til hold og kan se status for holddannelsen. Brug filtre og søgning, så du
          hurtigt finder de spillere, du skal arbejde med.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Turnering — puljer</h3>
        <p className="mt-2">
          Her placerer du hold i puljer, kan bruge automatisk fordeling hvor det er tilgængeligt, og se holdenes spillere.
          Kapacitet og små statusmærker hjælper dig med at holde styr på, om alt ser rigtigt ud.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Turnering — turneringsplan</h3>
        <p className="mt-2">
          Her genereres kampe ud fra puljerne (fx alle-mod-alle inden for en pulje). Hvis du ændrer hold i en pulje efter
          kampe er lavet, kan du få besked om at generere kampe igen for den pulje, så listen stemmer med de aktuelle hold.
          Tider og baner kan komme i senere versioner — fokus er først på at få de rigtige kampe på plads.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Din bruger øverst til højre</h3>
        <p className="mt-2">
          Du ser dit navn (og evt. billede), din rolle og kan logge ud. Knappen <strong>Hjælp</strong> åbner denne
          vejledning.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Roller</h3>
        <p className="mt-2">
          Din rolle (fx administrator eller bruger) styrker på sigt, hvad du må se og gøre. Indtil videre er funktionerne
          ens for de fleste — kontakt den tekniske ansvarlige, hvis du mangler adgang til noget.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white">Problemer?</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Opdater siden (F5) hvis noget ser forkert ud efter login.</li>
          <li>Tjek at du bruger den rigtige e-mail og at Caps Lock er slået fra ved adgangskode.</li>
          <li>Ved vedvarende fejl: notér hvad du forsøgte, og kontakt support med tidspunkt og skærmbillede.</li>
        </ul>
      </section>
    </div>
  );
}
