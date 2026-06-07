import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/request-client-ip";

export async function GET(request: Request) {
  return NextResponse.json(
    { ip: getClientIp(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
