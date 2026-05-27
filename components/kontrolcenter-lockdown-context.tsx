"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const [remoteToast, setRemoteToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHydrateRealtimeRef = useRef(false);

  const isAdmin = currentUser?.role === "admin";
  const isPlanningSection = isPlanningLockdownPath(pathname);

  useEffect(() => {
    setPlanningLockdownState(initialPlanningLockdown);
  }, [initialPlanningLockdown]);

  useEffect(() => {
    const client = getAuthBrowserClient();
    let cancelled = false;

    function applyPlanningLockdown(next: boolean, source: "initial-sync" | "realtime") {
      setPlanningLockdownState((prev) => {
        if (prev === next) return prev;
        if (source === "realtime" && didHydrateRealtimeRef.current && !toggleBusy) {
          setRemoteToast(
            next
              ? "Lockdown blev slået til af en anden admin."
              : "Lockdown blev slået fra af en anden admin.",
          );
        }
        return next;
      });
    }

    async function refreshPlanningLockdownFromDb(source: "initial-sync" | "realtime") {
      const { data, error } = await client
        .from("kontrolcenter_event_settings")
        .select("planning_lockdown")
        .eq("event_id", LYKKECUP_EVENT_ID)
        .maybeSingle();
      if (cancelled || error) return;
      applyPlanningLockdown(Boolean(data?.planning_lockdown), source);
    }

    const channel = client
      .channel("kontrolcenter-planning-lockdown")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kontrolcenter_event_settings",
          filter: `event_id=eq.${LYKKECUP_EVENT_ID}`,
        },
        (payload) => {
          const row =
            (payload.new as { planning_lockdown?: boolean } | null) ??
            (payload.old as { planning_lockdown?: boolean } | null);
          if (row && typeof row.planning_lockdown === "boolean") {
            applyPlanningLockdown(row.planning_lockdown, "realtime");
            return;
          }
          void refreshPlanningLockdownFromDb("realtime");
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void refreshPlanningLockdownFromDb("initial-sync").finally(() => {
            didHydrateRealtimeRef.current = true;
          });
        }
      });

    return () => {
      cancelled = true;
      void client.removeChannel(channel);
    };
  }, [toggleBusy]);

  useEffect(() => {
    if (!remoteToast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setRemoteToast(null);
      toastTimerRef.current = null;
    }, 3200);
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [remoteToast]);

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
    <KontrolcenterLockdownContext.Provider value={value}>
      {children}
      {remoteToast ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[120] max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          {remoteToast}
        </div>
      ) : null}
    </KontrolcenterLockdownContext.Provider>
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
