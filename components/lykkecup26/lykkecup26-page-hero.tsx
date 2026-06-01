import Image from "next/image";
import {
  LC26_PAGE_HERO_FRAME_CLASS,
  LC26_PAGE_HERO_IMAGE_CLASS,
  LC26_PAGE_HERO_IMAGE_SIZES,
} from "@/components/lykkecup26/lc26-page-hero-styles";

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
    <div className={LC26_PAGE_HERO_FRAME_CLASS}>
      <Image
        src={imageSrc}
        alt=""
        fill
        className={LC26_PAGE_HERO_IMAGE_CLASS}
        priority={priority}
        sizes={LC26_PAGE_HERO_IMAGE_SIZES}
      />
    </div>
  );
}
