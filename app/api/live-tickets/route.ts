import { NextResponse } from "next/server";

type WpBreakdownGroup = {
  key: string;
  label: string;
  sold: number;
};

type WpBreakdownResponse = {
  event_id: number;
  total: number;
  groups: WpBreakdownGroup[];
  updated: string;
  error?: string;
};

export async function GET() {
  // Fallbacks gør siden brugbar lokalt med det samme.
  const baseUrl = (process.env.LL_WP_BASE_URL?.trim() || "https://lykkeliga.dk").replace(/\/+$/, "");
  const key = process.env.LL_WP_TICKETS_KEY?.trim() || "lykkecup26_key";
  const eventId = (process.env.LL_WP_EVENT_ID?.trim() || "16899").replace(/\D+/g, "");

  if (!key || !eventId) {
    return NextResponse.json(
      {
        error: "Manglende konfiguration. Sæt LL_WP_TICKETS_KEY og evt. LL_WP_EVENT_ID i miljøvariabler.",
      },
      { status: 500 },
    );
  }

  const url = `${baseUrl}/wp-json/lykkeliga/v1/tickets-breakdown/${eventId}?key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as WpBreakdownResponse;

    if (!res.ok || data.error) {
      return NextResponse.json(
        {
          error: data.error || `WordPress endpoint fejl (HTTP ${res.status}).`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        event_id: data.event_id,
        total: data.total ?? 0,
        groups: Array.isArray(data.groups) ? data.groups : [],
        updated: data.updated ?? new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukendt fejl ved hentning fra WordPress.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
