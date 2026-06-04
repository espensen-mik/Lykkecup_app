import { GALLA_EVENT_ID } from "@/lib/galla-scanner-config";

export type GallaQrParsed = {
  ticket_id: string;
  event_id: string;
  security_code: string;
};

export type GallaQrParseError = {
  error: "parse_error";
  message: string;
};

export function parseGallaQrPayload(raw: string): GallaQrParsed | GallaQrParseError {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "parse_error", message: "QR code could not be parsed" };
  }

  let ticketId: string | null = null;
  let eventId: string | null = null;
  let securityCode: string | null = null;

  try {
    const asUrl = trimmed.includes("://") ? new URL(trimmed) : new URL(trimmed, "https://lykkeliga.dk/");
    ticketId = asUrl.searchParams.get("ticket_id");
    eventId = asUrl.searchParams.get("event_id");
    securityCode = asUrl.searchParams.get("security_code");
  } catch {
    const params = new URLSearchParams(trimmed.startsWith("?") ? trimmed : `?${trimmed}`);
    ticketId = params.get("ticket_id");
    eventId = params.get("event_id");
    securityCode = params.get("security_code");
  }

  if (!ticketId?.trim() || !securityCode?.trim()) {
    return { error: "parse_error", message: "QR code could not be parsed" };
  }

  return {
    ticket_id: ticketId.trim(),
    event_id: eventId?.trim() || String(GALLA_EVENT_ID),
    security_code: securityCode.trim(),
  };
}

export function attendeeIdFromTicketId(ticketId: string): number | null {
  const n = Number.parseInt(ticketId.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
