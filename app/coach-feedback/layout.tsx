import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kommentarer fra trænere",
  description:
    "Vælg klub, se tilmeldte spillere og send kommentarer om niveauer eller holdinddeling.",
};

export default function CoachFeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#fafafa] text-gray-900">
      {children}
    </div>
  );
}
