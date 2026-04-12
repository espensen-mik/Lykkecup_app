"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { PlayerDetailModal } from "@/components/player-detail-modal";

type Ctx = {
  openPlayer: (id: string) => void;
  closePlayer: () => void;
};

const PlayerModalContext = createContext<Ctx | null>(null);

export function usePlayerModal(): Ctx {
  const ctx = useContext(PlayerModalContext);
  if (!ctx) {
    throw new Error("usePlayerModal skal bruges inden for PlayerModalProvider");
  }
  return ctx;
}

export function PlayerModalProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);

  const openPlayer = useCallback((id: string) => {
    setPlayerId(id);
  }, []);

  const closePlayer = useCallback(() => {
    setPlayerId(null);
  }, []);

  const value = useMemo(() => ({ openPlayer, closePlayer }), [openPlayer, closePlayer]);

  return (
    <PlayerModalContext.Provider value={value}>
      {children}
      <PlayerDetailModal playerId={playerId} onClose={closePlayer} />
    </PlayerModalContext.Provider>
  );
}
