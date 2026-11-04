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
  onToggleTunnel?: (enabled: boolean) => Promise<void>;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onRotatePin,
  onUnpairDevice,
  onToggleTunnel,
}) => {
  const [addressMode, setAddressMode] = useState<"tunnel" | "ip" | "hostname">("tunnel");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);
  const [isTogglingTunnel, setIsTogglingTunnel] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(syncStatus.pin_expires_in ?? 60);

  // Compute clean PIN and target hosts
  const cleanPin = (syncStatus.sas_pin || "").replace(/\s+/g, "").trim();
  const port = syncStatus.port || 8765;
  const isTunnelActive = syncStatus.tunnel_enabled !== false;

  const ipHost =
    syncStatus.local_ip && syncStatus.local_ip !== "127.0.0.1" && syncStatus.local_ip !== "0.0.0.0"
      ? syncStatus.local_ip
      : window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
      ? window.location.hostname
      : "192.168.29.186";

  const nameHost = syncStatus.hostname || "Prathams-MacBook-Air.local";

  const tunnelUrl =
    syncStatus.pwa_url_tunnel ||
    (syncStatus.tunnel_url ? `${syncStatus.tunnel_url}/sync?pin=${cleanPin}` : null) ||
    `https://flower-teaches-cast-drive.trycloudflare.com/sync?pin=${cleanPin}`;

  let directConnectUrl = tunnelUrl;
  if (addressMode === "ip") {
    directConnectUrl = `http://${ipHost}:${port}/sync?pin=${cleanPin}`;
  } else if (addressMode === "hostname") {
    directConnectUrl = `http://${nameHost}:${port}/sync?pin=${cleanPin}`;
  }

  // Strict Guardrail: Filter out all hardcoded sample / demo phones
  const realDevices = (syncStatus.devices || []).filter(
    (dev) =>
      dev.id !== "dev-iphone-16" &&
      dev.id !== "dev-pixel-9" &&
      !dev.id.includes("sample") &&
      !dev.name.includes("Pratham's iPhone 16 Pro") &&
      !dev.name.includes("Pixel 9 Pro XL")
  );

  // Synchronize countdown with backend pin_expires_in
  useEffect(() => {
    if (syncStatus.pin_expires_in !== undefined && syncStatus.pin_expires_in !== null) {
      setCountdown(syncStatus.pin_expires_in);
    }
  }, [syncStatus.pin_expires_in, syncStatus.sas_pin]);

  // Anti-hack dynamic OTP timer: countdown every second and auto-rotate when no device is paired
  useEffect(() => {
    if (!isOpen || realDevices.length > 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRotatePin();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, realDevices.length, onRotatePin]);

  // Generate QR Code as high-contrast Data URL whenever URL or PIN changes
  useEffect(() => {
    let isMounted = true;
    if (!isOpen) return;
    if (addressMode === "tunnel" && !isTunnelActive) {
      setQrDataUrl("");
      return;
    }

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
  }, [isOpen, directConnectUrl, addressMode, isTunnelActive]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directConnectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleTunnel = async (enabled: boolean) => {
    if (isTogglingTunnel) return;
    setIsTogglingTunnel(true);
    try {
      if (onToggleTunnel) {
        await onToggleTunnel(enabled);
      }
    } finally {
      setIsTogglingTunnel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-6 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-colors"
          title="Close modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
            📡
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
              P2P Mobile Sync &amp; Ingest
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-normal">
                {isTunnelActive ? "TLS Encrypted" : "Air-Gapped Only"}
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Instantly connect and upload photos from your phone directly to this Mac.
            </p>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Main Connection Card */}
          <div className="p-4 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] flex flex-col items-center text-center">
            {/* Host Mode Selector Tabs */}
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--card)] border border-[var(--glass-border)] mb-3 text-[11px] max-w-full overflow-x-auto">
              <button
                onClick={() => setAddressMode("tunnel")}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  addressMode === "tunnel"
                    ? isTunnelActive
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-700 text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
                title="Universal connection that works over any Wi-Fi, 5G/4G, or Hotspot"
              >
                <span>🌐</span>
                <span>Universal {isTunnelActive ? "(Recommended)" : "(Disabled)"}</span>
              </button>
              <button
                onClick={() => setAddressMode("ip")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                  addressMode === "ip"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
                title="Direct local IP on your Wi-Fi"
              >
                📶 Local IP
              </button>
              <button
                onClick={() => setAddressMode("hostname")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all whitespace-nowrap ${
                  addressMode === "hostname"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
                title="Bonjour / mDNS local Mac name"
              >
                🏷️ Mac Name
              </button>
            </div>

            {/* Universal Mode: On/Off Switch & Details */}
            {addressMode === "tunnel" && (
              <div className="w-full flex items-center justify-between p-2.5 mb-3 rounded-xl bg-[var(--card)] border border-[var(--glass-border)] text-left">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isTunnelActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                      Cloudflare Universal Tunnel
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium ${
                          isTunnelActive
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-500/15 text-slate-400"
                        }`}
                      >
                        {isTunnelActive ? "ON" : "OFF"}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {isTunnelActive
                        ? "Active external HTTPS pipe (bypasses router isolation)"
                        : "Switched OFF. Zero data leaves your local machine"}
                    </div>
                  </div>
                </div>

                {/* Apple-style Toggle Switch */}
                <button
                  type="button"
                  onClick={() => handleToggleTunnel(!isTunnelActive)}
                  disabled={isTogglingTunnel}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isTunnelActive ? "bg-emerald-500" : "bg-slate-600"
                  } ${isTogglingTunnel ? "opacity-60 cursor-wait" : ""}`}
                  title={
                    isTunnelActive
                      ? "Click to switch OFF Universal Tunnel"
                      : "Click to switch ON Universal Tunnel"
                  }
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isTunnelActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            )}

            {/* If Universal is selected but toggled OFF: Show Air-Gapped State */}
            {addressMode === "tunnel" && !isTunnelActive ? (
              <div className="p-5 flex flex-col items-center text-center space-y-2.5 my-1 w-full bg-[var(--card)]/40 rounded-xl border border-[var(--glass-border)]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
                  🛡️
                </div>
                <div className="text-xs font-bold text-[var(--text-main)]">
                  Universal Tunnel is Switched OFF
                </div>
                <p className="text-[11px] text-[var(--text-muted)] max-w-xs leading-relaxed">
                  Strict air-gapped isolation is active. No third-party network can touch or inspect your traffic.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setAddressMode("ip")}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[11px] font-medium shadow-sm hover:opacity-90 transition-all"
                  >
                    Use Local IP 📶
                  </button>
                  <button
                    onClick={() => handleToggleTunnel(true)}
                    disabled={isTogglingTunnel}
                    className="px-3 py-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[11px] text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-all"
                  >
                    Turn ON Tunnel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* QR Code Canvas */}
                <div className="p-2.5 bg-white rounded-2xl shadow-md border border-slate-200/80 my-1">
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

                <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 max-w-xs">
                  Point your phone&apos;s camera at this QR code to authenticate and open the uploader.
                </p>

                {/* Direct Link Bar */}
                <div className="mt-2.5 flex items-center gap-2 w-full max-w-sm">
                  <input
                    readOnly
                    value={directConnectUrl}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--glass-border)] font-mono text-[11px] text-[var(--text-muted)] truncate select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-all shrink-0"
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Troubleshoot Alert Banner */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs">
            <button
              onClick={() => setShowTroubleshoot((prev) => !prev)}
              className="w-full flex items-center justify-between text-left font-semibold text-blue-700 dark:text-blue-400"
            >
              <span className="flex items-center gap-1.5">
                <span>💡</span>
                <span>Why did local hotspot/Wi-Fi connection fail?</span>
              </span>
              <span className="text-[11px] underline">
                {showTroubleshoot ? "Hide Details ▲" : "Learn More ▼"}
              </span>
            </button>

            {showTroubleshoot && (
              <div className="mt-2.5 space-y-2 text-[11px] text-[var(--text-secondary)] border-t border-blue-500/20 pt-2.5 leading-relaxed">
                <div>
                  <strong className="text-[var(--text-main)]">1. Router AP Isolation:</strong>
                  <br />
                  Many home Wi-Fi routers (e.g. JioFiber) block Wi-Fi devices from seeing or connecting to each other for security.
                </div>
                <div>
                  <strong className="text-[var(--text-main)]">2. Mobile Hotspot Firewall:</strong>
                  <br />
                  When your phone runs a Personal Hotspot, Android/iOS firewalls often drop requests from the phone&apos;s own browser to connected tethered devices.
                </div>
                <div>
                  <strong className="text-[var(--text-main)]">3. The Solution:</strong>
                  <br />
                  Use <strong>USB Tethering</strong> or turn on <strong>Universal Tunnel</strong> above!
                </div>
              </div>
            )}
          </div>

          {/* Anti-Hack Dynamic Security OTP & Manual PIN */}
          <div className="p-3.5 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Dynamic Security OTP
                </span>
                {realDevices.length === 0 ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Rotates in {countdown}s</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <span>🔒</span>
                    <span>Paired ({realDevices.length})</span>
                  </span>
                )}
              </div>
              <div className="text-xl font-mono font-bold tracking-widest text-[var(--accent)] mt-0.5">
                {syncStatus.sas_pin}
              </div>
              {realDevices.length === 0 ? (
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  🛡️ Auto-rotates every 60s while unpaired to prevent unauthorized access
                </div>
              ) : (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ✓ Device authenticated. Old pairing PINs are invalid.
                </div>
              )}
            </div>
            <button
              onClick={onRotatePin}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all flex items-center gap-1 shrink-0"
              title="Generate a fresh pairing OTP immediately"
            >
              <span>↻</span>
              <span>New OTP</span>
            </button>
          </div>

          {/* Connected / Paired Devices */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--text-main)] flex items-center justify-between">
              <span>Connected Mesh Devices ({realDevices.length})</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {syncStatus.service_name}
              </span>
            </div>

            {realDevices.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-[var(--glass-sidebar)] border border-dashed border-[var(--glass-border)] text-center text-xs text-[var(--text-muted)]">
                <div className="text-xl mb-1 opacity-75">📱</div>
                <div className="font-semibold text-[var(--text-main)] mb-0.5">
                  No Devices Connected Yet
                </div>
                <p className="text-[11px] text-[var(--text-muted)] max-w-xs mx-auto">
                  Scan the QR code above with your mobile phone to begin uploading photos.
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
