import { AppShell } from "@/components/app-shell";
import { PlayerModalProvider } from "@/components/player-modal-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerModalProvider>
      <AppShell>{children}</AppShell>
    </PlayerModalProvider>
  );
}
