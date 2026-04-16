import type { Metadata } from "next";
import { Lykkecup26Shell } from "@/components/lykkecup26/lykkecup26-shell";

export const metadata: Metadata = {
  title: "LykkeCup 26",
  description: "Find dit hold, holdkammerater og kampprogram til LykkeCup 26.",
};

export default function Lykkecup26Layout({ children }: { children: React.ReactNode }) {
  return <Lykkecup26Shell>{children}</Lykkecup26Shell>;
}
