import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="mx-auto max-w-lg px-2 py-12 text-center">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
        Spilleren findes ikke
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Denne spiller er ikke tilknyttet arrangementet eller linket er ugyldigt.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex text-sm font-medium text-[#0d9488] underline-offset-4 hover:underline dark:text-teal-400"
      >
        ← Tilbage til spillere
      </Link>
    </div>
  );
}
