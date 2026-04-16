import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-xl font-semibold tracking-[-0.02em] text-lc26-navy">Spiller ikke fundet</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-lc26-navy/55">
        Vi kunne ikke finde denne spiller. Tjek linket eller søg fra forsiden.
      </p>
      <Link
        href="/lykkecup26"
        className="mt-8 inline-flex rounded-full bg-lc26-teal px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgb(0_161_130/0.55)] transition hover:bg-lc26-teal/92 active:scale-[0.98]"
      >
        Gå til forsiden
      </Link>
    </div>
  );
}
