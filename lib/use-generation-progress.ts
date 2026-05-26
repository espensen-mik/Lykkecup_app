"use client";

import { useCallback, useEffect, useState } from "react";

const PHASE_LABELS = [
  "Genererer kampe…",
  "Planlægger bane og tid…",
  "Optimerer kampprogram…",
  "Afslutter…",
] as const;

/** Smooth simulated progress for long single server actions (caps below 100 until complete). */
export function useSimulatedGenerationProgress(active: boolean) {
  const [value, setValue] = useState(0);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!active) {
      setValue(0);
      setLabel("");
      return;
    }

    setValue(4);
    setLabel("Starter…");

    const interval = window.setInterval(() => {
      setValue((prev) => {
        const next = Math.min(prev + 1.5 + Math.random() * 2.5, 93);
        const phaseIndex = Math.min(PHASE_LABELS.length - 1, Math.floor((next / 93) * PHASE_LABELS.length));
        setLabel(PHASE_LABELS[phaseIndex] ?? PHASE_LABELS[0]!);
        return next;
      });
    }, 700);

    return () => window.clearInterval(interval);
  }, [active]);

  const complete = useCallback(() => {
    setValue(100);
    setLabel("Færdig");
  }, []);

  const reset = useCallback(() => {
    setValue(0);
    setLabel("");
  }, []);

  return { value, label, complete, reset };
}
