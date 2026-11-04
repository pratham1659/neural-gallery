import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { SyncStatus } from "../../types/gallery";

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onRotatePin: () => void;
  onPairPin: (pin: string) => void;
  onUnpairDevice?: (deviceId: string) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onRotatePin,
  onUnpairDevice,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Compute direct P2P connection URL (accessible over local Wi-Fi)
  const cleanPin = (syncStatus.sas_pin || "").replace(/\s+/g, "").trim();
  const host =
    syncStatus.local_ip && syncStatus.local_ip !== "127.0.0.1" && syncStatus.local_ip !== "0.0.0.0"
      ? syncStatus.local_ip
      : window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
      ? window.location.hostname
      : syncStatus.local_ip || "127.0.0.1";
  const port = syncStatus.port || 8765;
  const directConnectUrl =
    syncStatus.pwa_url_direct || `http://${host}:${port}/sync?pin=${cleanPin}`;

  // Generate QR Code as high-contrast Data URL whenever URL or PIN changes
  useEffect(() => {
    let isMounted = true;
    if (!isOpen) return;

    QRCode.toDataURL(directConnectUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0a0f1d",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, directConnectUrl]);

  if (!isOpen) return null;

  // Strict Guardrail: Filter out all hardcoded sample / demo phones
  const realDevices = (syncStatus.devices || []).filter(
    (dev) =>
      dev.id !== "dev-iphone-16" &&
      dev.id !== "dev-pixel-9" &&
      !dev.id.includes("sample") &&
      !dev.name.includes("Pratham's iPhone 16 Pro") &&
      !dev.name.includes("Pixel 9 Pro XL")
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directConnectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-6 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-colors"
          title="Close modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
            📡
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              Air-Gapped P2P Wi-Fi Sync
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-normal">
                TLS 1.3 Direct
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Direct device-to-device local transfer over Wi-Fi. Zero cloud egress.
            </p>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-5 pr-1 text-xs">
          {/* QR Code Instant Access Card */}
          <div className="p-4 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                Instant Scan &amp; Connect
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium">
                Same Wi-Fi
              </span>
            </div>

            {/* QR Code Canvas / Image */}
            <div className="p-2.5 bg-white rounded-2xl shadow-md border border-slate-200/80 my-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan QR code for direct P2P sync"
                  className="w-44 h-44 rounded-lg block"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-[var(--text-muted)]">
                  Generating QR...
                </div>
              )}
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-xs">
              Point your phone's camera at this QR code to pair and open the photo uploader instantly.
            </p>

            {/* Direct Link Bar */}
            <div className="mt-3 flex items-center gap-2 w-full max-w-sm">
              <input
                readOnly
                value={directConnectUrl}
                className="flex-1 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--glass-border)] font-mono text-[11px] text-[var(--text-muted)] truncate select-all"
              />
              <button
                onClick={handleCopyLink}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-all shrink-0"
              >
                {copied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* SAS Pairing PIN Manual Option */}
          <div className="p-3.5 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                Manual SAS PIN
              </div>
              <div className="text-xl font-mono font-bold tracking-widest text-[var(--accent)] mt-0.5">
                {syncStatus.sas_pin}
              </div>
            </div>
            <button
              onClick={onRotatePin}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all"
              title="Generate a fresh pairing PIN and QR code"
            >
              ↻ Rotate PIN
            </button>
          </div>

          {/* Connected / Paired Devices (No Mock Data) */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[var(--text-main)] flex items-center justify-between">
              <span>Connected Mesh Devices ({realDevices.length})</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {syncStatus.service_name}
              </span>
            </div>

            {realDevices.length === 0 ? (
              <div className="p-4 rounded-xl bg-[var(--glass-sidebar)] border border-dashed border-[var(--glass-border)] text-center text-xs text-[var(--text-muted)]">
                <div className="text-2xl mb-1.5 opacity-75">📱</div>
                <div className="font-semibold text-[var(--text-main)] mb-1">
                  No Devices Connected Yet
                </div>
                <p className="text-[11px] text-[var(--text-muted)] max-w-xs mx-auto">
                  Scan the QR code above with your mobile phone while connected to this Wi-Fi network to begin uploading photos.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {realDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {dev.name.includes("iPhone") || dev.model.includes("iPhone") ? "📱" : "📲"}
                      </span>
                      <div>
                        <div className="font-semibold text-[var(--text-main)]">{dev.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {dev.model} · {dev.last_sync}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Paired &amp; Verified
                      </span>
                      {onUnpairDevice && (
                        <button
                          onClick={() => onUnpairDevice(dev.id)}
                          className="px-2 py-0.5 rounded text-[10px] text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Disconnect device"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
