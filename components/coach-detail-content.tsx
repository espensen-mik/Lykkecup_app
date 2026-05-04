"use client";

import type { ReactNode } from "react";
import { formatBirthdate } from "@/lib/format";
import type { Coach } from "@/types/coach";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900">
      <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-gray-900 dark:text-gray-100">{value}</dd>
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
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Trænerdetaljer</p>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DetailRow label="Hjemmeklub" value={formatDash(coach.home_club)} />
        <DetailRow label="Fødselsdato" value={formatBirthdate(coach.birthdate)} />
        <DetailRow label="Alder" value={formatDash(coach.age)} />
        <DetailRow label="T-shirt" value={formatDash(coach.tshirt_size)} />
        <DetailRow label="E-mail" value={formatDash(coach.email)} />
        <DetailRow label="Telefon" value={formatDash(coach.phone)} />
        <div className="sm:col-span-2">
          <DetailRow
            label="Billet-ID"
            value={<span className="font-mono text-sm text-gray-700 dark:text-gray-300">{formatDash(coach.ticket_id)}</span>}
          />
        </div>
      </dl>
    </>
  );
}

