import { Mail, Phone } from "lucide-react";

const CHARLOTTE_EMAIL = "Charlotte@lykkeliga.dk";
const CHARLOTTE_PHONE_DISPLAY = "28 55 47 31";
const CHARLOTTE_PHONE_HREF = "tel:+4528554731";

export function Lc26BusinessCta() {
  return (
    <section className="border-t border-stone-200/80 px-2 pt-10 text-center sm:px-4 sm:pt-12">
      <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-2 border-lc26-navy/10 bg-white shadow-sm sm:h-32 sm:w-32">
        <img
          src="/charlotte.webp"
          alt="Charlotte"
          width={128}
          height={128}
          decoding="async"
          className="h-full w-full object-cover object-[center_38%]"
        />
      </div>

      <h2 className="mt-6 text-balance text-2xl font-semibold leading-snug tracking-[-0.03em] text-lc26-navy sm:text-[1.65rem]">
        Skal vi tale Business?
      </h2>

      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-lc26-navy/65 sm:text-[0.9375rem]">
        Hos LykkeLiga kalder vi vores erhvervsaftaler for &ldquo;
        <span className="font-semibold text-lc26-navy">Legeaftaler</span>
        &rdquo; og vi har brug for flere af dem! Vi
        har nemlig brug for en stabil økonomi, som ikke afhænger så meget af fondsprojekter og skiftende politisk
        støtte. Har du lyst til at tale business? Så tag fat på Charlotte enten til LykkeCup eller skriv / ring til hende
      </p>

      <ul className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-3 sm:max-w-sm">
        <li>
          <a
            href={`mailto:${CHARLOTTE_EMAIL}`}
            className="inline-flex items-center gap-2.5 text-base font-semibold text-lc26-teal underline-offset-4 transition hover:text-[#008f72] hover:underline"
          >
            <Mail className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            {CHARLOTTE_EMAIL}
          </a>
        </li>
        <li>
          <a
            href={CHARLOTTE_PHONE_HREF}
            className="inline-flex items-center gap-2.5 text-base font-semibold text-lc26-teal underline-offset-4 transition hover:text-[#008f72] hover:underline"
          >
            <Phone className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Tlf {CHARLOTTE_PHONE_DISPLAY}
          </a>
        </li>
      </ul>
    </section>
  );
}
