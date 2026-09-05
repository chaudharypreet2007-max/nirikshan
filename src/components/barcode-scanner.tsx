import { useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onDetected: (value: string, format: string) => void;
  paused?: boolean;
};

function beep() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(80);
    const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      void ctx.close();
    }, 120);
  } catch {
    /* feedback is best-effort */
  }
}

export function BarcodeScanner({ onDetected, paused = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorchAvailable(!!caps.torch);
        setStarting(false);

        const emit = (value: string, format: string) => {
          if (cancelled) return;
          beep();
          onDetected(value, format);
        };

        const NativeDetector = (window as unknown as { BarcodeDetector?: new (o?: unknown) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string; format: string }[]> } }).BarcodeDetector;

        if (NativeDetector) {
          const detector = new NativeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"],
          });
          let raf = 0;
          const tick = async () => {
            if (cancelled) return;
            const v = videoRef.current;
            if (v && v.readyState >= 2) {
              try {
                const codes = await detector.detect(v);
                const hit = codes[0];
                if (hit?.rawValue) {
                  emit(hit.rawValue, hit.format);
                  return;
                }
              } catch {
                /* keep scanning */
              }
            }
            raf = requestAnimationFrame(() => void tick());
          };
          void tick();
          stopRef.current = () => cancelAnimationFrame(raf);
          return;
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(videoRef.current!, (result) => {
          if (result) emit(result.getText(), String(result.getBarcodeFormat()));
        });
        stopRef.current = () => controls.stop();
      } catch {
        if (!cancelled) {
          setStarting(false);
          setError("Camera access was refused or is unavailable. Enter the code manually instead.");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopRef.current?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as MediaTrackConstraints);
      setTorchOn((t) => !t);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-foreground/90">
        <video ref={videoRef} muted playsInline className="h-72 w-full object-cover sm:h-96" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-4/5 max-w-sm rounded-lg border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {paused ? null : (
          <p className="absolute bottom-3 left-0 right-0 text-center text-xs font-medium text-background">
            Align the barcode inside the box
          </p>
        )}
        {starting ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-background">
            <Loader2 className="size-4 animate-spin" /> Starting camera…
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-violation">{error}</p> : null}

      {torchAvailable ? (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={toggleTorch}>
          {torchOn ? <FlashlightOff className="size-4" /> : <Flashlight className="size-4" />}
          {torchOn ? "Turn flash off" : "Turn flash on"}
        </Button>
      ) : null}
    </div>
  );
}
