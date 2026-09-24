import { Lykkecup27Teaser } from "@/components/lykkecup27/lykkecup27-teaser";
import { calendarDaysUntilLykkecup2027 } from "@/lib/lykkecup27";

export const dynamic = "force-dynamic";

export default function Lykkecup27Page() {
  return <Lykkecup27Teaser initialDays={calendarDaysUntilLykkecup2027()} />;
}
