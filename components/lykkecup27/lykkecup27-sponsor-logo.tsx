import type { Lykkecup27Sponsor } from "@/lib/lykkecup27";

/** Reference aspect ratio; logos of this shape render at exactly `--lc27-logo-h`. */
const REFERENCE_ASPECT = 2.6;

/**
 * Crops the SVG artboard to its visible artwork and sizes logos by equal visual area,
 * so wide and compact marks carry the same weight.
 */
export function Lykkecup27SponsorLogo({ sponsor }: { sponsor: Lykkecup27Sponsor }) {
  const [vbWidth, vbHeight] = sponsor.viewBox;
  const [x, y, width, height] = sponsor.artwork;
  const aspect = width / height;
  const heightFactor = Math.sqrt(REFERENCE_ASPECT / aspect) * (sponsor.scale ?? 1);

  return (
    <span
      className="relative block overflow-hidden"
      style={{ aspectRatio: `${width} / ${height}`, height: `calc(var(--lc27-logo-h) * ${heightFactor.toFixed(3)})` }}
    >
      <img
        src={sponsor.src}
        alt={sponsor.name}
        decoding="async"
        className="absolute max-w-none"
        style={{
          width: `${((vbWidth / width) * 100).toFixed(3)}%`,
          height: `${((vbHeight / height) * 100).toFixed(3)}%`,
          left: `${((-x / width) * 100).toFixed(3)}%`,
          top: `${((-y / height) * 100).toFixed(3)}%`,
        }}
      />
    </span>
  );
}
