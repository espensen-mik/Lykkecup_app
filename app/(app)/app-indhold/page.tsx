import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "App indhold",
  description: "Rediger indhold til LykkeCup26 app-sider",
};

const LINKS = [
  { href: "/app-indhold/dagens-program", label: "Dagens program" },
  { href: "/app-indhold/find-rundt-i-mch", label: "Find rundt i MCH" },
  { href: "/app-indhold/praktisk-info", label: "Praktisk info" },
  { href: "/app-indhold/nyt-fra-lykkeliga", label: "Nyt fra LykkeLiga" },
  { href: "/beskeder", label: "Beskeder" },
];

export default function AppIndholdPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">LykkeCup 26</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">App indhold</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Rediger siderne i den offentlige LykkeCup26 app uden kodeændringer.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-xl border border-lc-border bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 dark:border-gray-700 dark:bg-gray-900/35 dark:text-white dark:hover:border-teal-700 dark:hover:bg-teal-950/20"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
