import type { Metadata } from "next";
import { PublicDashboardScreen } from "@/components/public-dashboard-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LykkeCup 2026 - KontrolCenter Dashboard",
  description: "Public skærmdashboard til kontoret",
};

export default function KontrolcenterDashboardPage() {
  return <PublicDashboardScreen />;
}
