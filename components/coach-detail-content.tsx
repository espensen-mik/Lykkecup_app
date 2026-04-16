"use client";

import type { ReactNode } from "react";
import { formatBirthdate } from "@/lib/format";
import type { Coach } from "@/types/coach";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-lc-border py-5 last:border-b-0 dark:border-gray-700">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-2 text-base leading-relaxed text-gray-900 dark:text-gray-100">{value}</dd>
    </div>
  );
}

function formatDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

type Props = {
  coach: Coach;
};

export function CoachDetailContent({ coach }: Props) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">{coach.name}</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Trænerdetaljer</p>

      <dl className="mt-6">
        <DetailRow label="Hjemmeklub" value={formatDash(coach.home_club)} />
        <DetailRow label="Fødselsdato" value={formatBirthdate(coach.birthdate)} />
        <DetailRow label="Alder" value={formatDash(coach.age)} />
        <DetailRow label="T-shirt" value={formatDash(coach.tshirt_size)} />
        <DetailRow label="E-mail" value={formatDash(coach.email)} />
        <DetailRow label="Telefon" value={formatDash(coach.phone)} />
        <DetailRow
          label="Billet-ID"
          value={<span className="font-mono text-sm text-gray-700 dark:text-gray-300">{formatDash(coach.ticket_id)}</span>}
        />
      </dl>
    </>
  );
}

