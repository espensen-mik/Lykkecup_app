"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  gallaCheckInTicket,
  invalidReasonLabel,
  searchGallaTickets,
  type GallaCheckInResult,
  type GallaTicketRow,
} from "@/lib/galla-scanner";
import { GALLA_EVENT_ID } from "@/lib/galla-scanner-config";

type Props = {
  checkedInBy: string;
  onResult: (result: GallaCheckInResult) => void;
  onStatsRefresh: () => void;
  disabled: boolean;
};

export function GallaManualSearch({ checkedInBy, onResult, onStatsRefresh, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<GallaTicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const search = useCallback(async () => {
    if (query.trim().length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      setRows(await searchGallaTickets(query));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  async function checkInRow(row: GallaTicketRow) {
    if (disabled || busyId != null) return;
    setBusyId(row.attendee_id);
    try {
      const result = await gallaCheckInTicket({
        attendeeId: row.attendee_id,
        securityCode: row.security_code,
        checkedInBy,
      });
      if (result.status === "invalid" && result.reason) {
        result.message = invalidReasonLabel(result.reason);
      }
      onResult(result);
      if (result.status === "approved") {
        onStatsRefresh();
        void search();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="border-t border-neutral-800 bg-neutral-950">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-neutral-300"
      >
        Manuel søgning (backup)
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4">
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
              placeholder="Navn, e-mail, attendee_id, unique_id"
              className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void search()}
              disabled={loading || disabled}
              className="shrink-0 rounded-lg bg-neutral-700 px-3 py-2 text-sm font-semibold text-white"
            >
              Søg
            </button>
          </div>
          {loading ? <p className="text-xs text-neutral-500">Søger…</p> : null}
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.attendee_id}
                className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{row.name}</p>
                  <p className="text-xs text-neutral-500">
                    #{row.attendee_id} · {row.ticket_type ?? "—"} · event {GALLA_EVENT_ID}
                    {row.checked_in ? " · ✓" : ""}
                  </p>
                </div>
                {!row.checked_in && row.order_status.toLowerCase() === "completed" ? (
                  <button
                    type="button"
                    disabled={busyId != null || disabled}
                    onClick={() => void checkInRow(row)}
                    className="shrink-0 rounded-md bg-teal-700 px-2 py-1 text-xs font-semibold text-white"
                  >
                    {busyId === row.attendee_id ? "…" : "Check ind"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
