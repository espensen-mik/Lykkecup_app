import { PlanningLockdownGate } from "@/components/planning-lockdown-gate";

export default function KampprogramLayout({ children }: { children: React.ReactNode }) {
  return <PlanningLockdownGate viewOnly>{children}</PlanningLockdownGate>;
}
