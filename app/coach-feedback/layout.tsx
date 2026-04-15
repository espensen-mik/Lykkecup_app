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
    <div className="flex min-h-screen w-full flex-1 flex-col bg-[#fafafa] text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {children}
    </div>
  );
}
