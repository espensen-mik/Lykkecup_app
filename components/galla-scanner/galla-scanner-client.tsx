"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { GallaManualSearch } from "@/components/galla-scanner/galla-manual-search";
import {
  GallaScannerAccessGate,
  hasGallaScannerAccess,
} from "@/components/galla-scanner/galla-scanner-access-gate";
import {
  GALLA_EVENT_ID,
  GALLA_SCANNER_DEDUPE_MS,
  GALLA_SCANNER_RESET_MS,
  isGallaScannerAccessCodeRequired,
} from "@/lib/galla-scanner-config";
import { attendeeIdFromTicketId, parseGallaQrPayload } from "@/lib/galla-qr";
import {
  fetchGallaTicketStats,
  gallaCheckInTicket,
  invalidReasonLabel,
  type GallaCheckInResult,
  type GallaTicketStats,
} from "@/lib/galla-scanner";
import { supabase } from "@/lib/supabase";

type ScanPhase = "camera" | "processing" | "result";

function formatCheckedInAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function GallaScannerClient() {
  const [accessOk, setAccessOk] = useState(() =>
    typeof window === "undefined" ? false : hasGallaScannerAccess(),
  );
  const [phase, setPhase] = useState<ScanPhase>("camera");
  const [cameraStatus, setCameraStatus] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<GallaCheckInResult | null>(null);
  const [stats, setStats] = useState<GallaTicketStats>({ total: 0, checkedIn: 0, remaining: 0 });
  const [checkedInBy, setCheckedInBy] = useState("scanner");

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ raw: string; at: number } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchGallaTicketStats());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.trim();
      if (email) setCheckedInBy(email);
    });
    void refreshStats();
  }, [refreshStats]);

  const stopScanner = useCallback(() => {
    try {
      scanControlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    scanControlsRef.current = null;
    readerRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      processingRef.current = false;
      lastScanRef.current = null;
      setResult(null);
      setPhase("camera");
    }, GALLA_SCANNER_RESET_MS);
  }, []);

  const handleScan = useCallback(
    async (raw: string) => {
      if (processingRef.current) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.raw === raw && now - last.at < GALLA_SCANNER_DEDUPE_MS) return;

      processingRef.current = true;
      lastScanRef.current = { raw, at: now };
      stopScanner();
      setPhase("processing");

      const parsed = parseGallaQrPayload(raw);
      if ("error" in parsed) {
        setResult({
          status: "invalid",
          message: "Ugyldig billet",
          reason: "parse_error",
        });
        setPhase("result");
        scheduleReset();
        return;
      }

      const attendeeId = attendeeIdFromTicketId(parsed.ticket_id);
      if (attendeeId == null) {
        setResult({
          status: "invalid",
          message: "Ugyldig billet",
          reason: "parse_error",
        });
        setPhase("result");
        scheduleReset();
        return;
      }

      const eventId = Number.parseInt(parsed.event_id, 10);
      if (eventId !== GALLA_EVENT_ID) {
        setResult({
          status: "invalid",
          message: "Ugyldig billet",
          reason: "wrong_event_id",
        });
        setPhase("result");
        scheduleReset();
        return;
      }

      try {
        const checkResult = await gallaCheckInTicket({
          attendeeId,
          securityCode: parsed.security_code,
          checkedInBy,
        });
        if (checkResult.status === "invalid" && checkResult.reason) {
          checkResult.message = invalidReasonLabel(checkResult.reason);
        }
        setResult(checkResult);
        if (checkResult.status === "approved") void refreshStats();
      } catch {
        setResult({
          status: "invalid",
          message: "Ugyldig billet",
          reason: "rpc_error",
        });
      }

      setPhase("result");
      scheduleReset();
    },
    [checkedInBy, refreshStats, scheduleReset, stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (!videoRef.current || phase !== "camera") return;
    setCameraStatus("loading");
    setCameraError(null);

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const rear =
        devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
        devices[devices.length - 1]?.deviceId;

      const controls = await reader.decodeFromVideoDevice(rear ?? undefined, videoRef.current, (res) => {
        if (res) void handleScan(res.getText());
      });
      scanControlsRef.current = controls;

      setCameraStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Kamera kunne ikke startes";
      if (/denied|permission|notallowed/i.test(msg)) {
        setCameraStatus("denied");
        setCameraError("Kameraadgang blev afvist. Tillad kamera i browserindstillinger og genindlæs siden.");
      } else {
        setCameraStatus("error");
        setCameraError(msg);
      }
      processingRef.current = false;
    }
  }, [handleScan, phase]);

  useEffect(() => {
    if (!accessOk || phase !== "camera") return;
    void startScanner();
    return () => stopScanner();
  }, [accessOk, phase, startScanner, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [stopScanner]);

  if (isGallaScannerAccessCodeRequired() && !accessOk) {
    return <GallaScannerAccessGate onUnlocked={() => setAccessOk(true)} />;
  }

  if (phase === "result" && result) {
    const isApproved = result.status === "approved";
    const isAlready = result.status === "already_checked_in";
    const bg = isApproved ? "bg-emerald-600" : isAlready ? "bg-amber-500" : "bg-red-600";

    return (
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-6 text-white ${bg}`}>
        {isApproved ? (
          <Check className="h-28 w-28 stroke-[2.5]" aria-hidden />
        ) : isAlready ? (
          <AlertTriangle className="h-28 w-28 stroke-[2]" aria-hidden />
        ) : (
          <X className="h-28 w-28 stroke-[2.5]" aria-hidden />
        )}
        <p className="mt-8 text-center text-2xl font-bold leading-snug sm:text-3xl">
          {isApproved
            ? "Godkendt – Deltager checket ind"
            : isAlready
              ? "Allerede checket ind"
              : "Ugyldig billet"}
        </p>
        {result.name ? (
          <p className="mt-4 text-center text-lg font-medium opacity-95">{result.name}</p>
        ) : null}
        {result.ticket_type ? (
          <p className="mt-1 text-center text-base opacity-90">{result.ticket_type}</p>
        ) : null}
        {isAlready && result.checked_in_at ? (
          <p className="mt-2 text-center text-sm opacity-90">
            Checket ind: {formatCheckedInAt(result.checked_in_at)}
          </p>
        ) : null}
        {result.status === "invalid" && result.reason ? (
          <p className="mt-4 text-center text-base font-medium opacity-95">
            {invalidReasonLabel(result.reason)}
          </p>
        ) : null}
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-neutral-950 text-white">
        <Loader2 className="h-14 w-14 animate-spin text-teal-400" aria-hidden />
        <p className="mt-4 text-sm font-medium text-neutral-300">Tjekker billet…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-neutral-950 text-white">
      <header className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-teal-400/90">
          LykkeCup Galla Scanner
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] font-medium tabular-nums text-neutral-300">
          <div className="rounded-lg bg-neutral-900 py-1.5">
            <span className="block text-neutral-500">Total</span>
            <span className="text-base text-white">{stats.total}</span>
          </div>
          <div className="rounded-lg bg-neutral-900 py-1.5">
            <span className="block text-neutral-500">Checket ind</span>
            <span className="text-base text-emerald-400">{stats.checkedIn}</span>
          </div>
          <div className="rounded-lg bg-neutral-900 py-1.5">
            <span className="block text-neutral-500">Mangler</span>
            <span className="text-base text-white">{stats.remaining}</span>
          </div>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        {cameraStatus === "loading" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
            <p className="mt-3 text-sm text-neutral-300">Starter kamera…</p>
          </div>
        ) : null}
        {(cameraStatus === "denied" || cameraStatus === "error") && cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 px-6 text-center">
            <p className="text-sm text-red-300">{cameraError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold"
            >
              Prøv igen
            </button>
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-8">
          <div className="mx-auto aspect-square max-h-[min(70vw,320px)] rounded-2xl border-2 border-white/40" />
        </div>
      </div>

      <GallaManualSearch
        checkedInBy={checkedInBy}
        disabled={phase !== "camera"}
        onResult={(r) => {
          stopScanner();
          setResult(r);
          setPhase("result");
          scheduleReset();
        }}
        onStatsRefresh={() => void refreshStats()}
      />
    </div>
  );
}
