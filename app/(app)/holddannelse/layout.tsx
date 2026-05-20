import { PlanningLockdownGate } from "@/components/planning-lockdown-gate";

export default function HolddannelseLayout({ children }: { children: React.ReactNode }) {
  return <PlanningLockdownGate>{children}</PlanningLockdownGate>;
}
