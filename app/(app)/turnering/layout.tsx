import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentAuthAppUser } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Turnering",
};

export default async function TurneringLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentAuthAppUser();
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <h1 className="text-2xl font-semibold tracking-tight">Ingen adgang</h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            Denne del af appen er kun tilgaengelig for administratorer.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            Kontakt en administrator, hvis du mener, at du mangler de rette rettigheder.
          </p>
          <Link
            href="/admin"
            className="mt-5 inline-flex rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
          >
            Tilbage til overblik
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
