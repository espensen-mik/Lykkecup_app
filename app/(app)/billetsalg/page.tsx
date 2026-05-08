import type { Metadata } from "next";
import { LiveTicketBreakdown } from "@/components/live-ticket-breakdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Billetsalg",
  description: "Live billetsalg fra WordPress ticketing endpoint",
};

export default function BilletsalgPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 lg:space-y-9">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Billetter
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Live billetsalg
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Data hentes direkte fra WordPress API og opdateres automatisk hvert minut. Vaer opmaerksom paa, at det er
          raa data - derfor skal data soigneres inden vi tager dem endeligt i brug.
        </p>
      </header>

      <LiveTicketBreakdown />
    </div>
  );
}
