"use client";

import { createContext, useContext } from "react";

const ActiveEventContext = createContext<string | null>(null);

export function ActiveEventProvider({ eventId, children }: { eventId: string; children: React.ReactNode }) {
  return <ActiveEventContext.Provider value={eventId}>{children}</ActiveEventContext.Provider>;
}

export function useActiveEventId(): string {
  const eventId = useContext(ActiveEventContext);
  if (!eventId) throw new Error("useActiveEventId skal bruges inden for ActiveEventProvider");
  return eventId;
}
