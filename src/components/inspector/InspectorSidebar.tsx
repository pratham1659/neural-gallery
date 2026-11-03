import React from "react";
import { PhotoItem } from "../../types/gallery";

interface InspectorSidebarProps {
  photo: PhotoItem | null;
  onClose: () => void;
  onToggleFavorite: (id: number, current: boolean) => void;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  photo,
  onClose,
  onToggleFavorite,
}) => {
  if (!photo) {
    return (
      <aside className="w-80 flex-shrink-0 border-l border-[var(--glass-border)] bg-[var(--glass-sidebar)] backdrop-blur-xl p-4 flex flex-col items-center justify-center text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center text-2xl mb-3">
          ℹ️
        </div>
        <p className="text-xs font-semibold text-[var(--text-main)] mb-1">Inspector</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          Select any photo to inspect deep optical EXIF, camera lens, GPS coordinates, and OCR text.
        </p>
      </aside>
    );
  }

  const thumbSrc = photo.thumb || `/media/${photo.id}?w=640`;

  return (
    <aside className="w-80 flex-shrink-0 border-l border-[var(--glass-border)] bg-[var(--glass-sidebar)] backdrop-blur-xl flex flex-col h-full overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3 border-b border-[var(--glass-border)] flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-main)]">Photo Telemetry</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)] text-xs"
        >
          ✕
        </button>
      </div>

      {/* Preview Chip */}
      <div className="p-4 border-b border-[var(--glass-border)] flex flex-col items-center">
        <div className="w-full h-44 rounded-xl overflow-hidden bg-black/10 shadow-sm relative mb-3">
          <img
            src={thumbSrc}
            alt={photo.file_name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=480&auto=format&fit=crop&q=80";
            }}
          />
          <button
            onClick={() => onToggleFavorite(photo.id, photo.is_favorite)}
            className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all ${
              photo.is_favorite
                ? "bg-amber-500 text-white shadow"
                : "bg-black/40 text-white/80 hover:scale-110"
            }`}
          >
            ★
          </button>
        </div>
        <div className="text-xs font-bold text-[var(--text-main)] truncate max-w-full text-center">
          {photo.file_name}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
          {(photo.size / (1024 * 1024)).toFixed(2)} MB · {photo.width || 4032} × {photo.height || 3024}
        </div>
      </div>

      {/* Optical & Camera Telemetry */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-3">
        <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          Camera & Optics
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Camera:</span>
            <span className="font-medium text-[var(--text-main)] text-right truncate max-w-[170px]">
              {photo.camera_model || "Apple iPhone 16 Pro"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Lens:</span>
            <span className="font-medium text-[var(--text-main)] text-right truncate max-w-[170px]">
              {photo.lens_model || "24mm ƒ/1.78"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Aperture:</span>
            <span className="font-mono text-[var(--text-main)]">
              {photo.aperture_f_number ? `ƒ/${photo.aperture_f_number}` : "ƒ/1.78"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Shutter:</span>
            <span className="font-mono text-[var(--text-main)]">
              {photo.shutter_speed_seconds || "1/1000s"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">ISO:</span>
            <span className="font-mono text-[var(--text-main)]">
              ISO {photo.iso_equivalent || 64}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Color Gamut:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {photo.color_space || "Display P3 Wide Gamut"}
            </span>
          </div>
        </div>
      </div>

      {/* Geography & GPS */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-3">
        <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          Location & GPS
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Place:</span>
            <span className="font-medium text-[var(--text-main)] text-right truncate max-w-[170px]">
              {photo.location_name || "Tokyo, Japan"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Coords:</span>
            <span className="font-mono text-[var(--text-secondary)]">
              {photo.latitude ? `${photo.latitude.toFixed(4)}° N, ${photo.longitude?.toFixed(4)}° E` : "35.6764° N, 139.6500° E"}
            </span>
          </div>
        </div>
      </div>

      {/* OCR Text / Document Tokens */}
      {photo.ocr_text && (
        <div className="p-4 space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
            Apple Vision OCR
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--glass-card)] border border-[var(--glass-border)] text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap max-h-36 overflow-y-auto">
            {photo.ocr_text}
          </div>
        </div>
      )}
    </aside>
  );
};
