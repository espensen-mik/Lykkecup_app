"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CoachDetailModal } from "@/components/coach-detail-modal";

type Ctx = {
  openCoach: (id: string) => void;
  closeCoach: () => void;
};

const CoachModalContext = createContext<Ctx | null>(null);

export function useCoachModal(): Ctx {
  const ctx = useContext(CoachModalContext);
  if (!ctx) {
    throw new Error("useCoachModal skal bruges inden for CoachModalProvider");
  }
  return ctx;
}

export function CoachModalProvider({ children }: { children: React.ReactNode }) {
  const [coachId, setCoachId] = useState<string | null>(null);

  const openCoach = useCallback((id: string) => {
    setCoachId(id);
  }, []);

  const closeCoach = useCallback(() => {
    setCoachId(null);
  }, []);

  const value = useMemo(() => ({ openCoach, closeCoach }), [openCoach, closeCoach]);

  return (
    <CoachModalContext.Provider value={value}>
      {children}
      <CoachDetailModal coachId={coachId} onClose={closeCoach} />
    </CoachModalContext.Provider>
  );
}

