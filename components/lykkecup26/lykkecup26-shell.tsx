import { PublicHeader } from "@/components/lykkecup26/public-header";

export function Lykkecup26Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-stone-50 via-white to-teal-50/35 text-stone-900 selection:bg-teal-500/15 selection:text-teal-950">
      <PublicHeader />
      <div className="flex min-h-0 flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}
