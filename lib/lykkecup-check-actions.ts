"use server";

import { fetchAndRunLykkecupCheck } from "@/lib/lykkecup-check-server";
import type { LykkecupCheckResult } from "@/lib/lykkecup-check";

export async function runLykkecupCheckAction(): Promise<LykkecupCheckResult & { error: string | null }> {
  return fetchAndRunLykkecupCheck();
}
