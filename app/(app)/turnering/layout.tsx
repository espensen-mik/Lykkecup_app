import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Turnering",
};

export default function TurneringLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
