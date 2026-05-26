import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Cake, ChevronRight, Info, MapPinned, MessageSquareText, Newspaper } from "lucide-react";

export const metadata: Metadata = {
  title: "App indhold",
  description: "Rediger indhold til LykkeCup26 app-sider",
};

const LINKS = [
  { href: "/app-indhold/dagens-program", label: "Dagens program", icon: CalendarDays, tone: "from-sky-50 to-cyan-50 border-sky-200" },
  { href: "/app-indhold/find-rundt-i-mch", label: "Find rundt i MCH", icon: MapPinned, tone: "from-violet-50 to-indigo-50 border-violet-200" },
  { href: "/app-indhold/praktisk-info", label: "Praktisk info", icon: Info, tone: "from-amber-50 to-yellow-50 border-amber-200" },
  { href: "/app-indhold/nyt-fra-lykkeliga", label: "Nyt fra LykkeLiga", icon: Newspaper, tone: "from-fuchsia-50 to-pink-50 border-fuchsia-200" },
  {
    href: "/app-indhold/lykke-og-lagkage",
    label: "Lykke & Lagkage (VIP)",
    icon: Cake,
    tone: "from-[#f7f2e3] to-[#f3edd8] border-[#d3af37]/40",
  },
  { href: "/beskeder", label: "Beskeder", icon: MessageSquareText, tone: "from-emerald-50 to-teal-50 border-emerald-200" },
];

export default function AppIndholdPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-white px-5 py-6 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-transparent">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">LykkeCup 26</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">App indhold</h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Rediger siderne i den offentlige LykkeCup26 app uden kodeændringer.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm dark:border-emerald-900/40 dark:bg-gray-900/35">
        <div className="relative aspect-[16/7] w-full">
          <Image
            src="/lykkecup_app_mockup.jpg"
            alt="LykkeCup app mockup"
            fill
            priority
            className="object-cover object-center"
          />
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`group block rounded-xl border bg-gradient-to-br ${item.tone} px-4 py-4 text-sm font-medium text-gray-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/35 dark:text-white`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-gray-700 dark:text-gray-200" aria-hidden />
                  <span>{item.label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:text-teal-600 dark:text-gray-500 dark:group-hover:text-teal-400" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
