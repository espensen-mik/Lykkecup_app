"use client";

import { useState } from "react";
import { PickSelect } from "@/components/ui/pick-select";
import {
  AVAILABILITY_OPTIONS,
  AVAILABILITY_TIMEBOX,
  TSHIRT_SIZES,
  type Volunteer,
} from "@/lib/volunteers";

export const volunteerFieldClass =
  "w-full rounded-md border border-lc-border bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-100 dark:placeholder:text-gray-500";

const MONTHS = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december",
];

function Field({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 ${className}`}>
      <span>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

type Props = {
  defaults?: Partial<Volunteer>;
  disabled?: boolean;
  /** Offentlig formular: dato som dag/måned/år og påkrævede valg. */
  publicMode?: boolean;
};

export function VolunteerFields({ defaults = {}, disabled, publicMode = false }: Props) {
  const [availability, setAvailability] = useState(defaults.availability ?? "");
  const [birthYear, birthMonth, birthDay] = (defaults.birthdate ?? "").slice(0, 10).split("-");
  const currentYear = new Date().getFullYear();
  const previousDefault = defaults.previous_volunteer === true ? "yes" : defaults.previous_volunteer === false ? "no" : "";
  const photoDefault = defaults.photo_consent === true ? "yes" : defaults.photo_consent === false ? "no" : "";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Fornavn" required>
        <input name="first_name" required defaultValue={defaults.first_name ?? ""} autoComplete="given-name" className={volunteerFieldClass} disabled={disabled} />
      </Field>
      <Field label="Efternavn" required>
        <input name="last_name" required defaultValue={defaults.last_name ?? ""} autoComplete="family-name" className={volunteerFieldClass} disabled={disabled} />
      </Field>
      <Field label="E-mail" required>
        <input name="email" type="email" required defaultValue={defaults.email ?? ""} autoComplete="email" className={volunteerFieldClass} disabled={disabled} />
      </Field>
      <Field label="Mobilnummer" required>
        <input name="phone" type="tel" required defaultValue={defaults.phone ?? ""} autoComplete="tel" className={volunteerFieldClass} disabled={disabled} />
      </Field>

      {publicMode ? (
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Fødselsdato</legend>
          <div className="grid grid-cols-3 gap-2">
            <PickSelect
              name="birth_day"
              defaultValue={birthDay ? String(Number(birthDay)) : ""}
              placeholder="Dag"
              disabled={disabled}
              searchable={false}
              options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            />
            <PickSelect
              name="birth_month"
              defaultValue={birthMonth ? String(Number(birthMonth)) : ""}
              placeholder="Måned"
              disabled={disabled}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
            <PickSelect
              name="birth_year"
              defaultValue={birthYear ?? ""}
              placeholder="År"
              disabled={disabled}
              options={Array.from({ length: 90 }, (_, i) => String(currentYear - 10 - i)).map((y) => ({ value: y, label: y }))}
            />
          </div>
        </fieldset>
      ) : (
        <Field label="Fødselsdato">
          <input name="birthdate" type="date" defaultValue={defaults.birthdate?.slice(0, 10) ?? ""} className={volunteerFieldClass} disabled={disabled} />
        </Field>
      )}

      <Field label="Har tidligere været frivillig til LykkeCup" required={publicMode}>
        <PickSelect
          name="previous_volunteer"
          defaultValue={previousDefault}
          disabled={disabled}
          options={[
            { value: "yes", label: "Ja" },
            { value: "no", label: "Nej" },
          ]}
        />
      </Field>

      <Field label="Hvornår kan du hjælpe til?" required={publicMode} className="sm:col-span-2">
        <PickSelect
          name="availability"
          value={availability}
          onChange={setAvailability}
          disabled={disabled}
          options={AVAILABILITY_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
      </Field>

      {availability === AVAILABILITY_TIMEBOX ? (
        <Field label="Kan du kun hjælpe i et bestemt tidsrum, hvornår er så det?" className="sm:col-span-2">
          <input name="availability_note" defaultValue={defaults.availability_note ?? ""} placeholder="Fx kl. 9–13" className={volunteerFieldClass} disabled={disabled} />
        </Field>
      ) : null}

      <Field label="T-shirt størrelse">
        <PickSelect
          name="tshirt_size"
          defaultValue={defaults.tshirt_size ?? ""}
          disabled={disabled}
          options={TSHIRT_SIZES.map((sz) => ({ value: sz, label: sz }))}
        />
      </Field>

      <Field label="I må gerne bruge billeder/videoer af mig" required={publicMode}>
        <PickSelect
          name="photo_consent"
          defaultValue={photoDefault}
          disabled={disabled}
          options={[
            { value: "yes", label: "Ja" },
            { value: "no", label: "Nej" },
          ]}
        />
      </Field>

      <Field label="Noter her, hvis du ønsker en specifik opgave på dagen" className="sm:col-span-2">
        <input name="task_wish" defaultValue={defaults.task_wish ?? ""} className={volunteerFieldClass} disabled={disabled} />
      </Field>
      <Field label="Noter her, hvis du ønsker at stå sammen med en bestemt person" className="sm:col-span-2">
        <input name="buddy_wish" defaultValue={defaults.buddy_wish ?? ""} className={volunteerFieldClass} disabled={disabled} />
      </Field>
      <Field label="Særlige kosthensyn" className="sm:col-span-2">
        <input name="dietary_needs" defaultValue={defaults.dietary_needs ?? ""} className={volunteerFieldClass} disabled={disabled} />
      </Field>
      <Field label="Andet?" className="sm:col-span-2">
        <textarea name="other_info" rows={3} defaultValue={defaults.other_info ?? ""} className={volunteerFieldClass} disabled={disabled} />
      </Field>
    </div>
  );
}
