/** LykkeCup 2027 teaser — change event facts here. */

export const LYKKECUP_2027_EVENT_NAME = "LykkeCup 2027";
export const LYKKECUP_2027_EVENT_DATE = "2027-06-05";
export const LYKKECUP_2027_DATE_LABEL = "5. juni 2027";
export const LYKKECUP_2027_LOCATION = "Herning";
export const LYKKECUP_2027_TIME_ZONE = "Europe/Copenhagen";
export const LYKKECUP_2027_MUX_PLAYBACK_ID = "8Trtg1lKBv5h00fJDeSQO00dxzmae5jYMOFznliPXNj74";

/** Seconds into the video used for the poster frame. */
export const LYKKECUP_2027_POSTER_TIME = 2;

export const LYKKECUP_2027_HLS_SRC = `https://stream.mux.com/${LYKKECUP_2027_MUX_PLAYBACK_ID}.m3u8`;
export const LYKKECUP_2027_POSTER_SRC = `https://image.mux.com/${LYKKECUP_2027_MUX_PLAYBACK_ID}/thumbnail.webp?time=${LYKKECUP_2027_POSTER_TIME}&width=1920`;

export type Lykkecup27Sponsor = {
  name: string;
  /** Path under `public/`. Case-sensitive in production. */
  src: string;
  /** SVG viewBox size. */
  viewBox: [width: number, height: number];
  /** Visible artwork inside the viewBox: x, y, width, height. Artboards often include large margins. */
  artwork: [x: number, y: number, width: number, height: number];
  /** Optical correction on top of equal-area sizing, e.g. 0.8 for a heavy mark. */
  scale?: number;
};

/** Negative (white) partner logos for the dark footer. */
export const LYKKECUP_2027_SPONSORS: Lykkecup27Sponsor[] = [
  {
    name: "Herning Kommune",
    src: "/logo/Partnere/Herningkommune_negativ.svg",
    viewBox: [841.9, 595.3],
    artwork: [68, 156.1, 723.5, 283.1],
  },
  {
    name: "MCH",
    src: "/logo/Partnere/MCH_negativ.svg",
    viewBox: [841.9, 595.3],
    artwork: [73.6, 174.8, 658.1, 223],
    scale: 0.8,
  },
  {
    name: "Normal",
    src: "/logo/Partnere/NORMAL_Logo.svg",
    viewBox: [297.64, 139.5],
    artwork: [6.4, 15.8, 274.3, 117.8],
  },
];

const MS_PER_DAY = 86_400_000;

/** UTC midnight for the calendar date in Europe/Copenhagen. */
export function copenhagenCalendarUtc(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LYKKECUP_2027_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return Date.UTC(year, month - 1, day);
}

/** Whole calendar days from today in Copenhagen until 5 June 2027. Negative after that date. */
export function calendarDaysUntilLykkecup2027(now: Date = new Date()): number {
  const [year, month, day] = LYKKECUP_2027_EVENT_DATE.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  return Math.round((target - copenhagenCalendarUtc(now)) / MS_PER_DAY);
}

/** Countdown line, or null once the event date has passed. */
export function lykkecup27CountdownLabel(days: number): string | null {
  if (days < 0) return null;
  if (days === 0) return "I dag ses vi";
  if (days === 1) return "1 dag til vi ses";
  return `${days} dage til vi ses`;
}
