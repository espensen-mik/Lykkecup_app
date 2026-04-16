import { PublicHeader } from "@/components/lykkecup26/public-header";

export function Lykkecup26Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-lc26-cream text-lc26-navy selection:bg-lc26-teal/15 selection:text-lc26-navy">
      {/* Let mint “lys” øverst — meget subtilt */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[min(52vh,28rem)] bg-[radial-gradient(ellipse_120%_90%_at_50%_-15%,rgb(182_226_213/0.42),transparent_65%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <PublicHeader />
        <div className="flex min-h-0 flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
