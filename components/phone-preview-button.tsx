"use client";

import { ExternalLink } from "lucide-react";

type Props = {
  href: string;
  label?: string;
  className?: string;
};

export function PhonePreviewButton({ href, label = "Se frontend", className }: Props) {
  const baseClassName =
    "inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50";

  function openPhonePreview() {
    if (typeof window === "undefined") return;
    const width = 390;
    const height = 844;
    const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
    const specs = `popup=yes,noopener,noreferrer,width=${width},height=${height},left=${left},top=${top}`;
    window.open(href, "_blank", specs);
  }

  return (
    <button type="button" onClick={openPhonePreview} className={className ? `${baseClassName} ${className}` : baseClassName}>
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
