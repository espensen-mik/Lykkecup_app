import { PublicHeader } from "@/components/lykkecup26/public-header";

export function Lykkecup26Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-stone-50 text-lc26-navy selection:bg-lc26-teal/15 selection:text-lc26-navy">
      <PublicHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <footer className="pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 sm:px-6">
          <img
            src="/lykkeliga-logo.svg"
            alt="LykkeLiga"
            className="h-6 w-auto opacity-100"
            loading="lazy"
            decoding="async"
          />
        </div>
      </footer>
    </div>
  );
}
