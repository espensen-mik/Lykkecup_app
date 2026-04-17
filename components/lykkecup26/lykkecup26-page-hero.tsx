import Image from "next/image";

type Props = {
  /** Brug `true` kun på den side, der loades først, hvis du vil prioritere LCP. */
  priority?: boolean;
};

/** Samme fuld-bredde header som forsiden — udskift billedsti senere pr. side. */
export function Lykkecup26PageHero({ priority = false }: Props) {
  return (
    <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-52">
      <Image
        src="/lykkecupheader.jpg"
        alt=""
        fill
        className="object-cover object-[center_25%]"
        priority={priority}
        sizes="100vw"
      />
    </div>
  );
}
