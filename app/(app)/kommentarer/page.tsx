import type { Metadata } from "next";
import { KommentarerFilteredList } from "@/components/kommentarer-filtered-list";
import { fetchClubFeedbackForEvent } from "@/lib/club-feedback";
import { getCurrentAuthAppUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kommentarer",
  description: "Alle trænerkommentarer for arrangementet",
};

export default async function KommentarerPage() {
  const [feedbackRes, currentUser] = await Promise.all([fetchClubFeedbackForEvent(), getCurrentAuthAppUser()]);
  const { comments, error } = feedbackRes;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          Kommentarer
        </h1>
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          Kunne ikke indlæse kommentarer: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 lg:space-y-11">
      <header className="max-w-2xl">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#0d9488] dark:text-teal-400">
          Trænere
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-[2rem] dark:text-white">
          Kommentarer
        </h1>
        <p className="mt-3 text-base leading-relaxed text-gray-500 dark:text-gray-400">
          Samlet oversigt over kommentarer om niveauer og holdinddeling. Filtrer efter klub og søg i
          tekst.
        </p>
      </header>

      <KommentarerFilteredList
        comments={comments}
        totalCount={comments.length}
        currentUser={
          currentUser
            ? { id: currentUser.id, fullName: currentUser.fullName, avatarUrl: currentUser.avatarUrl }
            : null
        }
      />
    </div>
  );
}
