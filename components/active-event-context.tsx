"use client";

import { createContext, useContext } from "react";
import type { EventSummary } from "@/lib/events";

const ActiveEventContext = createContext<EventSummary | null>(null);

export function ActiveEventProvider({ event, children }: { event: EventSummary; children: React.ReactNode }) {
  return <ActiveEventContext.Provider value={event}>{children}</ActiveEventContext.Provider>;
}

export function useActiveEvent(): EventSummary {
  const event = useContext(ActiveEventContext);
  if (!event) throw new Error("useActiveEvent skal bruges inden for ActiveEventProvider");
  return event;
}

export function useActiveEventId(): string {
  return useActiveEvent().id;
}
