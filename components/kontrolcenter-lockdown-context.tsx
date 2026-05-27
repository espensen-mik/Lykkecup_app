"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthBrowserClient } from "@/lib/auth-browser";
import type { AuthAppUser } from "@/lib/auth-app-user";
import { setPlanningLockdownAction } from "@/lib/kontrolcenter-lockdown-actions";
import { isPlanningLockdownPath, PLANNING_LOCKDOWN_MESSAGE } from "@/lib/kontrolcenter-lockdown-shared";
import { LYKKECUP_EVENT_ID } from "@/lib/players";

type KontrolcenterLockdownContextValue = {
  planningLockdown: boolean;
  isPlanningSection: boolean;
  isAdmin: boolean;
  message: string;
  toggleBusy: boolean;
  setPlanningLockdown: (enabled: boolean) => Promise<void>;
};

const KontrolcenterLockdownContext = createContext<KontrolcenterLockdownContextValue | null>(null);

export function KontrolcenterLockdownProvider({
  children,
  initialPlanningLockdown,
  currentUser,
}: {
  children: ReactNode;
  initialPlanningLockdown: boolean;
  currentUser: AuthAppUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [planningLockdown, setPlanningLockdownState] = useState(initialPlanningLockdown);
  const [toggleBusy, setToggleBusy] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const isPlanningSection = isPlanningLockdownPath(pathname);

  useEffect(() => {
    setPlanningLockdownState(initialPlanningLockdown);
  }, [initialPlanningLockdown]);

  useEffect(() => {
    const client = getAuthBrowserClient();

    const channel = client
      .channel("kontrolcenter-planning-lockdown")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kontrolcenter_event_settings",
          filter: `event_id=eq.${LYKKECUP_EVENT_ID}`,
        },
        (payload) => {
          const row = payload.new as { planning_lockdown?: boolean } | null;
          if (row && typeof row.planning_lockdown === "boolean") {
            setPlanningLockdownState(row.planning_lockdown);
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const setPlanningLockdown = useCallback(
    async (enabled: boolean) => {
      if (!isAdmin) return;
      setToggleBusy(true);
      try {
        const result = await setPlanningLockdownAction(enabled);
        if (!result.ok) {
          window.alert(result.message);
          return;
        }
        setPlanningLockdownState(Boolean(result.planningLockdown));
        router.refresh();
      } finally {
        setToggleBusy(false);
      }
    },
    [isAdmin, router],
  );

  const value = useMemo(
    (): KontrolcenterLockdownContextValue => ({
      planningLockdown,
      isPlanningSection,
      isAdmin,
      message: PLANNING_LOCKDOWN_MESSAGE,
      toggleBusy,
      setPlanningLockdown,
    }),
    [planningLockdown, isPlanningSection, isAdmin, toggleBusy, setPlanningLockdown],
  );

  return (
    <KontrolcenterLockdownContext.Provider value={value}>{children}</KontrolcenterLockdownContext.Provider>
  );
}

export function useKontrolcenterLockdown(): KontrolcenterLockdownContextValue {
  const ctx = useContext(KontrolcenterLockdownContext);
  if (!ctx) {
    return {
      planningLockdown: false,
      isPlanningSection: false,
      isAdmin: false,
      message: PLANNING_LOCKDOWN_MESSAGE,
      toggleBusy: false,
      setPlanningLockdown: async () => {},
    };
  }
  return ctx;
}
