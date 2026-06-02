import { notFound } from "next/navigation";

/** Skærmdashboard er slået fra — undgår unødige DB-forespørgsler. */
export default function KontrolcenterDashboardPage() {
  notFound();
}
