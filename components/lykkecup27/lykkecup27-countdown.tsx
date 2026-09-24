"use client";

import { useEffect, useState } from "react";
import { calendarDaysUntilLykkecup2027, lykkecup27CountdownLabel } from "@/lib/lykkecup27";

/** First paint uses the server value so server and client markup match. */
export function Lykkecup27Countdown({ initialDays, className }: { initialDays: number; className?: string }) {
  const [days, setDays] = useState(initialDays);

  useEffect(() => {
    setDays(calendarDaysUntilLykkecup2027());
  }, []);

  const label = lykkecup27CountdownLabel(days);
  if (!label) return null;

  return <p className={className}>{label}</p>;
}
