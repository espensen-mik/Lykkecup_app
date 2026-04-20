"use client";

const SONG_URL = "https://lykkeliga.dk/wp-content/uploads/2026/03/Vi-vinder-LykkeCup.mp3";

/**
 * Minimal afspiller til forsiden — native controls, ingen Web Audio (virker bedre på mobil).
 */
export function TemporaryFrontpageSongPlayer() {
  return (
    <div className="mt-3 w-full max-w-[min(100%,20rem)] text-left sm:mt-4 sm:max-w-md">
      <p className="text-[13px] leading-snug text-white/90 sm:text-sm">
        Mens du venter kan du øve dig i den helt nye LykkeCup-sang{" "}
        <span className="font-semibold text-white">«Vi vinder LykkeCup»</span>.
      </p>
      <p className="mt-1.5 text-sm font-semibold text-white sm:text-base">Vi vinder LykkeCup</p>
      <audio
        className="mt-2.5 w-full max-w-full rounded-md"
        controls
        preload="metadata"
        aria-label="Afspil sangen Vi vinder LykkeCup"
      >
        <source src={SONG_URL} type="audio/mpeg" />
      </audio>
    </div>
  );
}
