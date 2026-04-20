import { TemporaryFrontpageSongPlayer } from "@/components/temporary-frontpage-song-player";

export default function TemporaryFrontpage() {
  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <img
        src="/Frontpage.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div className="absolute inset-0 z-10 flex h-[100dvh] max-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] text-center sm:px-6">
        <img
          src="/LykkeCUP26_blue.svg"
          alt="LykkeCup 26"
          className="h-auto w-full max-w-[13rem] shrink-0 brightness-0 invert sm:max-w-[18rem] md:max-w-[22rem]"
        />
        <p className="mt-3 text-base font-medium tracking-tight text-white sm:mt-5 sm:text-lg md:text-xl">
          LykkeCup App åbner snart.
        </p>
        <div className="mt-3 flex w-full max-w-md shrink-0 justify-center sm:mt-4">
          <TemporaryFrontpageSongPlayer />
        </div>
      </div>
    </main>
  );
}
