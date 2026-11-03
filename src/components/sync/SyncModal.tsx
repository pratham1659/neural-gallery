import React from "react";
import { SyncStatus } from "../../types/gallery";

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onRotatePin: () => void;
  onPairPin: (pin: string) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onRotatePin,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-6 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)]"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-2xl">
            📡
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)]">
              Air-Gapped P2P Wi-Fi Sync
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Direct device-to-device local transfer. Zero cloud relays.
            </p>
          </div>
        </div>

        {/* SAS Pairing PIN Display */}
        <div className="p-4 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] text-center mb-6">
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-1">
            Short Authentication String (SAS PIN)
          </div>
          <div className="text-3xl font-mono font-bold tracking-widest text-[var(--accent)] my-1">
            {syncStatus.sas_pin}
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-3">
            Enter this 6-digit PIN on your iPhone or Android phone to authenticate.
          </p>
          <button
            onClick={onRotatePin}
            className="px-3 py-1 rounded-lg text-xs font-medium border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all"
          >
            ↻ Generate Fresh PIN
          </button>
        </div>

        {/* Connected / Paired Devices */}
        <div className="space-y-3 mb-6">
          <div className="text-xs font-semibold text-[var(--text-main)] flex items-center justify-between">
            <span>Mesh Devices</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {syncStatus.service_name}
            </span>
          </div>

          <div className="space-y-2">
            {syncStatus.devices.map((dev) => (
              <div
                key={dev.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{dev.name.includes("iPhone") ? "📱" : "📲"}</span>
                  <div>
                    <div className="font-semibold text-[var(--text-main)]">{dev.name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {dev.model} · {dev.last_sync}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    dev.state === "paired"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {dev.state === "paired" ? "Paired & Verified" : "Nearby"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Local PWA Quick Ingest URL */}
        <div className="p-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/20 text-xs">
          <div className="font-semibold text-[var(--accent)] mb-1">
            📱 Mobile Web Ingest (Zero Install)
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Open <span className="font-mono font-semibold underline">{syncStatus.pwa_url}</span> in your phone's browser on the same Wi-Fi to upload photos directly to your Mac.
          </p>
        </div>
      </div>
    </div>
  );
};
