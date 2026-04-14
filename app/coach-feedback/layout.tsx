import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kommentarer fra trænere",
  description:
    "Skriv kommentarer til dit hold og dine spillere før turneringsplanen for LykkeCup 2026.",
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
