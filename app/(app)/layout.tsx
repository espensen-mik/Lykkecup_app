import { ActiveEventProvider } from "@/components/active-event-context";
import { AppShell } from "@/components/app-shell";
import { KontrolcenterLockdownProvider } from "@/components/kontrolcenter-lockdown-context";
import { PlayerModalProvider } from "@/components/player-modal-context";
import { getActiveEvent } from "@/lib/active-event-server";
import { getCurrentAuthAppUser } from "@/lib/auth-server";
import { fetchPlanningLockdown } from "@/lib/kontrolcenter-lockdown-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, planningLockdown, event] = await Promise.all([
    getCurrentAuthAppUser(),
    fetchPlanningLockdown(),
    getActiveEvent(),
  ]);
  return (
    <ActiveEventProvider event={event}>
      <KontrolcenterLockdownProvider initialPlanningLockdown={planningLockdown} currentUser={user}>
        <PlayerModalProvider>
          <AppShell currentUser={user}>{children}</AppShell>
        </PlayerModalProvider>
      </KontrolcenterLockdownProvider>
    </ActiveEventProvider>
  );
}
