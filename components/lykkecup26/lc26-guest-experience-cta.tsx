import { Heart } from "lucide-react";
import Link from "next/link";

/** CTA til gæstebogen på Beskeder-siden (hash til formularen). */
export function Lc26GuestExperienceCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/lykkecup26/beskeder#lc26-guest-book"
      className={`group flex w-full items-start gap-4 rounded-2xl border-2 border-[#df6763]/45 bg-gradient-to-br from-[rgb(223_103_99/0.12)] via-white to-white px-4 py-4 text-left shadow-[0_12px_36px_-20px_rgb(223_103_99/0.45)] transition hover:border-[#df6763]/65 hover:shadow-[0_16px_40px_-18px_rgb(223_103_99/0.5)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#df6763]/40 sm:gap-5 sm:px-5 sm:py-5 dark:border-[#df6763]/35 dark:from-[rgb(223_103_99/0.14)] dark:via-gray-950 dark:to-gray-950 ${className}`}
    >
      <Heart
        className="mt-0.5 h-9 w-9 shrink-0 fill-[#df6763] text-[#df6763] drop-shadow-sm sm:h-10 sm:w-10"
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold tracking-tight text-lc26-navy dark:text-white sm:text-[1.05rem]">
          Har du lyst til at dele din oplevelse?
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-lc26-navy/65 dark:text-gray-400">
          Send LykkeLiga en lille hilsen — vi bliver så glade for at høre, hvordan du har haft det til LykkeCup 2026.
        </p>
        <p className="mt-3 text-sm font-semibold text-[#c45450] underline-offset-2 group-hover:underline dark:text-[#e89590]">
          Skriv til os her
        </p>
      </div>
    </Link>
  );
}
