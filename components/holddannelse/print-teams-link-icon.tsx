import Link from "next/link";
import { Printer } from "lucide-react";

type Props = {
  href: string;
  /** Til skærmlæsere og tooltip */
  title?: string;
};

export function PrintTeamsLinkIcon({ href, title = "Print hold" }: Props) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-teal-400 hover:text-[#0f766e] dark:border-gray-600 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:border-teal-600"
      aria-label={title}
      title={title}
    >
      <Printer className="h-5 w-5" strokeWidth={2} aria-hidden />
    </Link>
  );
}
