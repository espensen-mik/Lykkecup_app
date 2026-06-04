"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
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
  gallaCheckInTicket,
  invalidReasonLabel,
  type GallaCheckInResult,
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
  const [checkedInBy, setCheckedInBy] = useState("scanner");

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<import("@zxing/browser").BrowserMultiFormatReader | null>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);
  const deviceIdRef = useRef<string | undefined>(undefined);
  const cameraReadyRef = useRef(false);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ raw: string; at: number } | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.trim();
      if (email) setCheckedInBy(email);
    });
  }, []);

  const pauseDecode = useCallback(() => {
    try {
      scanControlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    scanControlsRef.current = null;
  }, []);

  const teardownCamera = useCallback(() => {
    pauseDecode();
    readerRef.current = null;
    cameraReadyRef.current = false;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [pauseDecode]);

  const handleScanRef = useRef<(raw: string) => void>(() => {});

  const beginDecode = useCallback(async () => {
    if (!videoRef.current || !readerRef.current || scanControlsRef.current) return;

    const controls = await readerRef.current.decodeFromVideoDevice(
      deviceIdRef.current,
      videoRef.current,
      (res) => {
        if (res && !processingRef.current) void handleScanRef.current(res.getText());
      },
    );
    scanControlsRef.current = controls;
  }, []);

  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      processingRef.current = false;
      lastScanRef.current = null;
      setResult(null);
      setPhase("camera");
      void beginDecode();
    }, GALLA_SCANNER_RESET_MS);
  }, [beginDecode]);

  const handleScan = useCallback(
    async (raw: string) => {
      if (processingRef.current) return;
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.raw === raw && now - last.at < GALLA_SCANNER_DEDUPE_MS) return;

      processingRef.current = true;
      lastScanRef.current = { raw, at: now };
      pauseDecode();
      setPhase("processing");

      const parsed = parseGallaQrPayload(raw);
      if ("error" in parsed) {
        setResult({ status: "invalid", message: "Ugyldig billet", reason: "parse_error" });
        setPhase("result");
        scheduleReset();
        return;
      }

      const attendeeId = attendeeIdFromTicketId(parsed.ticket_id);
      if (attendeeId == null) {
        setResult({ status: "invalid", message: "Ugyldig billet", reason: "parse_error" });
        setPhase("result");
        scheduleReset();
        return;
      }

      if (Number.parseInt(parsed.event_id, 10) !== GALLA_EVENT_ID) {
        setResult({ status: "invalid", message: "Ugyldig billet", reason: "wrong_event_id" });
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
      } catch {
        setResult({ status: "invalid", message: "Ugyldig billet", reason: "rpc_error" });
      }

      setPhase("result");
      scheduleReset();
    },
    [checkedInBy, pauseDecode, scheduleReset],
  );

  handleScanRef.current = handleScan;

  const initCamera = useCallback(async () => {
    if (cameraReadyRef.current || !videoRef.current) return;

    setCameraStatus("loading");
    setCameraError(null);

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      deviceIdRef.current =
        devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
        devices[devices.length - 1]?.deviceId;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceIdRef.current ? { ideal: deviceIdRef.current } : undefined,
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      cameraReadyRef.current = true;
      setCameraStatus("ready");
      await beginDecode();
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
  }, [beginDecode]);

  useEffect(() => {
    if (!accessOk) return;
    void initCamera();
    return () => teardownCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once per visit; avoid camera re-request loop
  }, [accessOk]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      teardownCamera();
    };
  }, [teardownCamera]);

  if (isGallaScannerAccessCodeRequired() && !accessOk) {
    return <GallaScannerAccessGate onUnlocked={() => setAccessOk(true)} />;
  }

  const isApproved = result?.status === "approved";
  const isAlready = result?.status === "already_checked_in";
  const isInvalid = result?.status === "invalid";
  const resultBg = isApproved ? "bg-emerald-600" : isAlready ? "bg-amber-500" : isInvalid ? "bg-red-600" : "";

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 text-white">
      <p className="shrink-0 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-teal-400/90">
        LykkeCup Galla Scanner
      </p>

      <div className="relative min-h-0 flex-1 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {cameraStatus === "loading" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/85">
            <Loader2 className="h-10 w-10 animate-spin text-teal-400" aria-hidden />
            <p className="mt-3 text-sm text-neutral-300">Starter kamera…</p>
          </div>
        ) : null}

        {(cameraStatus === "denied" || cameraStatus === "error") && cameraError ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/95 px-6 text-center">
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

        {phase === "camera" && cameraStatus === "ready" ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8">
            <div className="mx-auto aspect-square max-h-[min(72vw,360px)] rounded-2xl border-2 border-white/40" />
          </div>
        ) : null}

        {phase === "processing" ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75">
            <Loader2 className="h-14 w-14 animate-spin text-teal-400" aria-hidden />
            <p className="mt-4 text-sm font-medium text-neutral-200">Tjekker billet…</p>
          </div>
        ) : null}

        {phase === "result" && result ? (
          <div
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center px-6 text-white ${resultBg}`}
          >
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
            {isInvalid && result.reason ? (
              <p className="mt-4 text-center text-base font-medium opacity-95">
                {invalidReasonLabel(result.reason)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
