import { AppShell } from "@/components/app-shell";
import { KontrolcenterLockdownProvider } from "@/components/kontrolcenter-lockdown-context";
import { PlayerModalProvider } from "@/components/player-modal-context";
import { getCurrentAuthAppUser } from "@/lib/auth-server";
import { fetchPlanningLockdown } from "@/lib/kontrolcenter-lockdown-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, planningLockdown] = await Promise.all([getCurrentAuthAppUser(), fetchPlanningLockdown()]);
  return (
    <KontrolcenterLockdownProvider initialPlanningLockdown={planningLockdown} currentUser={user}>
      <PlayerModalProvider>
        <AppShell currentUser={user}>{children}</AppShell>
      </PlayerModalProvider>
    </KontrolcenterLockdownProvider>
  );
}
