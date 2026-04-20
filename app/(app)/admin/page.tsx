import type { Metadata } from "next";
import DashboardPage from "@/app/(app)/dashboard/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Overblik",
  description: "Overblik — LykkeCup KontrolCenter",
};

export default DashboardPage;
