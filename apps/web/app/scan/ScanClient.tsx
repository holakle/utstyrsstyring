"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { getApiBase } from "../lib/api";

type Asset = {
  id: string;
  name: string;
  assetTagId: string;
  serial?: string | null;
  status: string;
};

type DetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (input: ImageBitmapSource) => Promise<DetectorResult[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const SCAN_FORMATS = [
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "upc_a",
  "upc_e",
  "itf",
  "qr_code",
  "data_matrix",
  "pdf417",
  "aztec",
];

export default function ScanClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const scanActiveRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>("");
  const [manualCode, setManualCode] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [matches, setMatches] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [isBinding, setIsBinding] = useState(false);
  const [bindMessage, setBindMessage] = useState("");
  const [scannerMode, setScannerMode] = useState<"none" | "zxing" | "native">("none");

  const stopCamera = useCallback(() => {
    scanActiveRef.current = false;
    setIsScanning(false);
    setScannerMode("none");
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (zxingRef.current) {
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      zxingRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const lookupCode = useCallback(async (code: string) => {
    const res = await fetch(`${getApiBase()}/scan/lookup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Lookup failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as Asset[];
    setMatches(data);
    setSelectedAssetId(data[0]?.id ?? "");
  }, []);

  const handleDetected = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || !scanActiveRef.current) return;
      setScannedCode(trimmed);
      setManualCode(trimmed);
      setScanError("");
      setBindMessage("");
      stopCamera();
      try {
        await lookupCode(trimmed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Lookup failed";
        setScanError(message);
      }
    },
    [lookupCode, stopCamera],
  );

  const scanLoopNative = useCallback(async () => {
    if (!scanActiveRef.current || !videoRef.current || !detectorRef.current) return;
    if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      timerRef.current = window.setTimeout(() => {
        void scanLoopNative();
      }, 200);
      return;
    }
    try {
      const detections = await detectorRef.current.detect(videoRef.current);
      const first = detections.find((item) => item.rawValue?.trim());
      if (first?.rawValue) {
        await handleDetected(first.rawValue);
        return;
      }
    } catch {
      // Ignore transient detector errors while camera warms up.
    }
    timerRef.current = window.setTimeout(() => {
      void scanLoopNative();
    }, 240);
  }, [handleDetected]);

  async function startZXingScanner() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error(
        "Kamera er ikke tilgjengelig i denne konteksten. Pa mobil over LAN kreves vanligvis HTTPS (eller localhost).",
      );
    }
    if (!videoRef.current) throw new Error("Klarte ikke initialisere video");
    videoRef.current.setAttribute("playsinline", "true");

    const reader = new BrowserMultiFormatReader();
    zxingRef.current = reader;
    scanActiveRef.current = true;
    setIsScanning(true);
    setScannerMode("zxing");

    zxingControlsRef.current = await reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      },
      videoRef.current,
      (result, err) => {
        if (!scanActiveRef.current) return;
        if (result) {
          void handleDetected(result.getText());
          return;
        }
        if (err && (err as Error).name !== "NotFoundException") {
          setScanError(err.message);
        }
      },
    );
  }

  async function startNativeScanner() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error(
        "Kamera er ikke tilgjengelig i denne konteksten. Pa mobil over LAN kreves vanligvis HTTPS (eller localhost).",
      );
    }
    const Detector = (window as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) throw new Error("BarcodeDetector er ikke tilgjengelig");
    if (!videoRef.current) throw new Error("Klarte ikke initialisere video");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    videoRef.current.setAttribute("playsinline", "true");
    await videoRef.current.play();

    detectorRef.current = new Detector({ formats: SCAN_FORMATS });
    scanActiveRef.current = true;
    setIsScanning(true);
    setScannerMode("native");
    void scanLoopNative();
  }

  async function startScanner() {
    setIsStarting(true);
    setScanError("");
    setBindMessage("");
    setMatches([]);
    setSelectedAssetId("");
    stopCamera();

    try {
      await startZXingScanner();
    } catch (zxingError) {
      try {
        await startNativeScanner();
      } catch (nativeError) {
        const zxingMsg = zxingError instanceof Error ? zxingError.message : "ZXing failed";
        const nativeMsg = nativeError instanceof Error ? nativeError.message : "Native failed";
        setScanError(`Skanner feilet. ZXing: ${zxingMsg}. Native: ${nativeMsg}`);
      }
    } finally {
      setIsStarting(false);
    }
  }

  async function runManualLookup() {
    const code = manualCode.trim();
    if (!code) return;
    setScannedCode(code);
    setScanError("");
    setBindMessage("");
    try {
      await lookupCode(code);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lookup failed";
      setScanError(message);
    }
  }

  async function bindCodeToSelectedAsset() {
    if (!scannedCode || !selectedAssetId) return;
    setIsBinding(true);
    setBindMessage("");
    try {
      const res = await fetch(`${getApiBase()}/assets/${selectedAssetId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ barcode: scannedCode }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Bind failed (${res.status}): ${text}`);
      }
      const selected = matches.find((a) => a.id === selectedAssetId);
      setBindMessage(`Kode koblet til ${selected?.name ?? "valgt gjenstand"} som barcode.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bind failed";
      setBindMessage(message);
    } finally {
      setIsBinding(false);
    }
  }

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card grid" style={{ gap: 10 }}>
        <h3>Skanner</h3>
        <video
          ref={videoRef}
          muted
          className="scan-video"
          style={{ width: "100%", maxWidth: 620, borderRadius: 10, background: "#111", minHeight: 220 }}
        />
        <div className="row">
          <button className="primary" type="button" disabled={isStarting || isScanning} onClick={startScanner}>
            {isStarting ? "Starter..." : isScanning ? "Skanner..." : "Start kamera"}
          </button>
          <button type="button" disabled={!isScanning} onClick={stopCamera}>
            Stopp kamera
          </button>
        </div>
        <p className="muted">
          Skannermodus: {scannerMode === "zxing" ? "ZXing" : scannerMode === "native" ? "BarcodeDetector" : "Ingen"}.
        </p>
      </div>

      <div className="card grid" style={{ gap: 10 }}>
        <h3>Kode</h3>
        <div className="row">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Skannet kode (eller skriv inn manuelt)"
            style={{ minWidth: 260 }}
          />
          <button type="button" onClick={runManualLookup}>
            Finn gjenstand
          </button>
        </div>
        {scannedCode ? (
          <p>
            Aktiv kode: <strong>{scannedCode}</strong>
          </p>
        ) : (
          <p className="muted">Ingen kode valgt.</p>
        )}
        {scanError ? (
          <p className="muted" style={{ color: "#b91c1c" }}>
            {scanError}
          </p>
        ) : null}
      </div>

      <div className="card grid" style={{ gap: 10 }}>
        <h3>Treff og kobling</h3>
        {matches.length === 0 ? (
          <p className="muted">Ingen treff enda. Skann en kode eller bruk manuelt oppslag.</p>
        ) : (
          <>
            <select value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
              {matches.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} ({asset.assetTagId}) - {asset.status}
                </option>
              ))}
            </select>
            <button
              className="primary"
              type="button"
              disabled={!selectedAssetId || !scannedCode || isBinding}
              onClick={bindCodeToSelectedAsset}
            >
              {isBinding ? "Kobler..." : "Knytt kode til valgt gjenstand"}
            </button>
          </>
        )}
        {bindMessage ? <p>{bindMessage}</p> : null}
      </div>
    </div>
  );
}
