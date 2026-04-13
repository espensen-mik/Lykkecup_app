"use client";

import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Ekstra klasser på den ydre wrapper (fx `min-w-[12rem]`) */
  wrapperClassName?: string;
};

/**
 * Native `<select>` med skjult browser-pil og ensartet Lucide-chevron.
 * `pr-10` sættes sidst så den overskriver evt. `px-*` fra `className`.
 */
export function StyledSelect({ className = "", wrapperClassName = "", disabled, children, ...rest }: Props) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        disabled={disabled}
        className={`w-full cursor-pointer appearance-none ${className} pr-10`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 ${
          disabled ? "text-gray-300 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
        }`}
        strokeWidth={2}
        aria-hidden
      />
    </div>
  );
}
