import Image from "next/image";

type Props = {
  /** Brug `true` kun på den side, der loades først, hvis du vil prioritere LCP. */
  priority?: boolean;
  /** Fuld-bredde headerbillede i `public/` (fx `/lykkecupheader2.webp`). */
  imageSrc?: string;
};

const DEFAULT_HEADER_SRC = "/lykkecupheader.jpg";

/** Fuld-bredde header til undersider (forsiden har eget hero). */
export function Lykkecup26PageHero({ priority = false, imageSrc = DEFAULT_HEADER_SRC }: Props) {
  return (
    <div className="relative h-44 w-full shrink-0 overflow-hidden sm:h-52">
      <Image
        src={imageSrc}
        alt=""
        fill
        className="object-cover object-[center_25%]"
        priority={priority}
        sizes="100vw"
      />
    </div>
  );
}
