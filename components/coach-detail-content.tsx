"use client";

import type { ReactNode } from "react";
import { formatBirthdate } from "@/lib/format";
import type { Coach } from "@/types/coach";

type EditableCoachField = "name" | "home_club" | "birthdate" | "age" | "tshirt_size" | "email" | "phone";

function DetailRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          {label}
        </dt>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Rediger
          </button>
        ) : null}
      </div>
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
  onEditField?: (field: EditableCoachField) => void;
};

export function CoachDetailContent({ coach, onEditField }: Props) {
  return (
    <>
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Trænerdetaljer</p>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DetailRow label="Navn" value={formatDash(coach.name)} onEdit={onEditField ? () => onEditField("name") : undefined} />
        <DetailRow
          label="Hjemmeklub"
          value={formatDash(coach.home_club)}
          onEdit={onEditField ? () => onEditField("home_club") : undefined}
        />
        <DetailRow
          label="Fødselsdato"
          value={formatBirthdate(coach.birthdate)}
          onEdit={onEditField ? () => onEditField("birthdate") : undefined}
        />
        <DetailRow label="Alder" value={formatDash(coach.age)} onEdit={onEditField ? () => onEditField("age") : undefined} />
        <DetailRow
          label="T-shirt"
          value={formatDash(coach.tshirt_size)}
          onEdit={onEditField ? () => onEditField("tshirt_size") : undefined}
        />
        <DetailRow label="E-mail" value={formatDash(coach.email)} onEdit={onEditField ? () => onEditField("email") : undefined} />
        <DetailRow label="Telefon" value={formatDash(coach.phone)} onEdit={onEditField ? () => onEditField("phone") : undefined} />
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

