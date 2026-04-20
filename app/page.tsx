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

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
        <img
          src="/LykkeCUP26_blue.svg"
          alt="LykkeCup 26"
          className="h-auto w-full max-w-[18rem] brightness-0 invert sm:max-w-[22rem] md:max-w-[26rem]"
        />
        <p className="mt-8 text-lg font-medium tracking-tight text-white sm:text-xl">
          LykkeCup App åbner snart.
        </p>
        <TemporaryFrontpageSongPlayer />
      </div>
    </main>
  );
}
