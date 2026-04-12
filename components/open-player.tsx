"use client";

import { usePlayerModal } from "@/components/player-modal-context";

type ButtonProps = {
  playerId: string;
  className?: string;
  children: React.ReactNode;
};

/** Knap der åbner spiller-modal (fx dashboard-navn). */
export function OpenPlayerButton({ playerId, className = "", children }: ButtonProps) {
  const { openPlayer } = usePlayerModal();
  return (
    <button
      type="button"
      className={`cursor-pointer border-0 bg-transparent p-0 text-left font-inherit ${className}`}
      onClick={() => openPlayer(playerId)}
    >
      {children}
    </button>
  );
}

type RowProps = {
  playerId: string;
  className?: string;
  children: React.ReactNode;
};

/** Fuld bredde-række der åbner spiller-modal (fx klubliste). */
export function OpenPlayerRowButton({ playerId, className = "", children }: RowProps) {
  const { openPlayer } = usePlayerModal();
  return (
    <button
      type="button"
      className={`cursor-pointer border-0 bg-transparent p-0 font-inherit ${className}`}
      onClick={() => openPlayer(playerId)}
    >
      {children}
    </button>
  );
}
