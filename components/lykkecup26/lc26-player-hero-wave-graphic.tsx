/**
 * Wave background from `public/wave.svg` (Illustrator) — teal fills only, no artboard gray.
 * Colors: #00B69C / #00BFA5
 */
export function Lc26PlayerHeroWaveGraphic() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect width="1920" height="1080" fill="#00BFA5" />
      <path
        fill="#00B69C"
        d="M1089.3,493.8C838,885.4,423,1091.1,44.9,882.5c-378.2-208.6-522.1-84.3-522.1-84.3v217.7c0,114.2,92.5,206.7,206.7,206.7h2370c114.2,0,206.7-92.5,206.7-206.7V-53.2c-194.2,550.6-822-68.3-1216.9,547Z"
      />
    </svg>
  );
}
