import { PublicHeader } from "@/components/lykkecup26/public-header";

export function Lykkecup26Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-stone-50 text-lc26-navy selection:bg-lc26-teal/15 selection:text-lc26-navy">
      <PublicHeader />
      <div className="flex min-h-0 flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}
