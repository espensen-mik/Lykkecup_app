import { AppShell } from "@/components/app-shell";
import { PlayerModalProvider } from "@/components/player-modal-context";
import { getCurrentAuthAppUser } from "@/lib/auth-server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentAuthAppUser();
  return (
    <PlayerModalProvider>
      <AppShell currentUser={user}>{children}</AppShell>
    </PlayerModalProvider>
  );
}
