import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GALLA_EVENT_ID } from "@/lib/galla-scanner-config";
import { buildCheckedInByLabel } from "@/lib/galla-scanner-device";
import { getClientIp } from "@/lib/request-client-ip";
import type { GallaCheckInResult, GallaCheckInStatus } from "@/lib/galla-scanner";

type Body = {
  attendeeId?: number;
  securityCode?: string;
  browserDeviceId?: string;
  customName?: string;
};

function parseRpcResult(data: unknown): GallaCheckInResult {
  const row = (data ?? {}) as Record<string, unknown>;
  const status = row.status as GallaCheckInStatus;
  if (status !== "approved" && status !== "already_checked_in" && status !== "invalid") {
    return { status: "invalid", message: "Ugyldig billet", reason: "unknown" };
  }
  return {
    status,
    message: typeof row.message === "string" ? row.message : "Ugyldig billet",
    reason: typeof row.reason === "string" ? row.reason : undefined,
    attendee_id: typeof row.attendee_id === "number" ? row.attendee_id : undefined,
    name: typeof row.name === "string" ? row.name : null,
    ticket_type: typeof row.ticket_type === "string" ? row.ticket_type : null,
    checked_in_at: typeof row.checked_in_at === "string" ? row.checked_in_at : null,
  };
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ status: "invalid", message: "Ugyldig billet", reason: "parse_error" } satisfies GallaCheckInResult, {
      status: 400,
    });
  }

  const attendeeId = body.attendeeId;
  const securityCode = typeof body.securityCode === "string" ? body.securityCode.trim() : "";
  const browserDeviceId =
    typeof body.browserDeviceId === "string" && body.browserDeviceId.trim()
      ? body.browserDeviceId.trim()
      : "unknown";

  if (!Number.isFinite(attendeeId) || !securityCode) {
    return NextResponse.json(
      { status: "invalid", message: "Ugyldig billet", reason: "parse_error" } satisfies GallaCheckInResult,
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { status: "invalid", message: "Ugyldig billet", reason: "rpc_error" } satisfies GallaCheckInResult,
      { status: 500 },
    );
  }

  const ip = getClientIp(request);
  const checkedInBy = buildCheckedInByLabel({
    browserDeviceId,
    ip,
    customName: body.customName,
  });

  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("galla_check_in_ticket", {
    p_attendee_id: attendeeId,
    p_security_code: securityCode,
    p_event_id: GALLA_EVENT_ID,
    p_checked_in_by: checkedInBy,
  });

  if (error) {
    return NextResponse.json(
      { status: "invalid", message: "Ugyldig billet", reason: "rpc_error" } satisfies GallaCheckInResult,
      { status: 502 },
    );
  }

  return NextResponse.json(parseRpcResult(data), { headers: { "Cache-Control": "no-store" } });
}
