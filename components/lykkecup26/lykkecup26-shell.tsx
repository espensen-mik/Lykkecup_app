import { PublicHeader } from "@/components/lykkecup26/public-header";

export function Lykkecup26Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-50 via-white to-teal-50/40 text-stone-900">
      <PublicHeader />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
