import type { PlayerDetail } from "@/types/player";

const PLAYER_UPDATED_EVENT = "lykkecup:player-updated";

export type PlayerUpdatedPayload = Pick<
  PlayerDetail,
  "id" | "name" | "home_club" | "birthdate" | "age" | "gender" | "level" | "preferences" | "ticket_id"
>;

export function emitPlayerUpdated(payload: PlayerUpdatedPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PlayerUpdatedPayload>(PLAYER_UPDATED_EVENT, { detail: payload }));
}

export function subscribePlayerUpdated(handler: (payload: PlayerUpdatedPayload) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener: EventListener = (event) => {
    const custom = event as CustomEvent<PlayerUpdatedPayload>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener(PLAYER_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PLAYER_UPDATED_EVENT, listener);
}
