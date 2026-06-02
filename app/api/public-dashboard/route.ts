import { NextResponse } from "next/server";

/** Slået fra sammen med /kontrolcenter-dashboard — ingen DB-forespørgsler. */
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
