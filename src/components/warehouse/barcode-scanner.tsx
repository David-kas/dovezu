"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Flashlight, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
];

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  sessionKey?: string;
}

export function BarcodeScanner({ open, onClose, onScan, sessionKey = "scan" }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const handleScan = useCallback(
    (code: string) => {
      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < 800) return;
      lastScanRef.current = { code, at: now };

      if (navigator.vibrate) navigator.vibrate(50);
      onScan(code);
    },
    [onScan]
  );

  useEffect(() => {
    if (!open) return;

    const scanner = new Html5Qrcode("barcode-scanner-region", {
      formatsToSupport: FORMATS,
      verbose: false,
    });
    scannerRef.current = scanner;
    setError("");

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 160 }, aspectRatio: 1 },
        (decoded) => handleScan(decoded),
        () => {}
      )
      .catch(() => setError("Не удалось получить доступ к камере. Разрешите камеру или введите код вручную."));

    return () => {
      scanner.stop().catch(() => {}).finally(() => scanner.clear());
      scannerRef.current = null;
    };
  }, [open, handleScan]);

  async function toggleTorch() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      if (caps.torch) {
        await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
        setTorchOn(!torchOn);
      }
    } catch {
      /* torch not supported */
    }
  }

  function submitManual() {
    if (manualCode.trim()) handleScan(manualCode.trim());
    setManualCode("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center justify-between">
            Сканер штрихкода
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div id="barcode-scanner-region" className="w-full min-h-[280px] bg-black" />

        {error && <p className="px-4 text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 p-4 pt-2">
          <Button variant="outline" size="icon" onClick={toggleTorch} title="Фонарик">
            <Flashlight className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Ввести код вручную"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitManual()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={submitManual}>
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
