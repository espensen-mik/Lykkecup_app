export default function TemporaryFrontpage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <img
        src="/frontpage.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/70" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <img
          src="/lykkecup26_blue.svg"
          alt="LykkeCup 26"
          className="h-auto w-full max-w-[18rem] brightness-0 invert sm:max-w-[22rem] md:max-w-[26rem]"
        />
        <p className="mt-8 text-lg font-medium tracking-tight text-white sm:text-xl">
          LykkeCup App åbner snart.
        </p>
      </div>
    </main>
  );
}
