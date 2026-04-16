import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-xl font-semibold text-stone-900">Spiller ikke fundet</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600">
        Vi kunne ikke finde denne spiller. Tjek linket eller søg fra forsiden.
      </p>
      <Link
        href="/lykkecup26"
        className="mt-8 inline-flex rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
      >
        Gå til forsiden
      </Link>
    </div>
  );
}
