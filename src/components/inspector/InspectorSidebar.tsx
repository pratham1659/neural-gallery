import React, { useEffect, useState } from "react";
import {
  Aperture,
  Calendar,
  Camera,
  Check,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Folder,
  HardDrive,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  Sliders,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  User,
} from "lucide-react";
import { PhotoItem } from "../../types/gallery";
import { api } from "../../services/api";
import { Info3DIcon } from "../common/Info3DIcon";

interface InspectorSidebarProps {
  photo: PhotoItem | null;
  onClose: () => void;
  onToggleFavorite: (id: number, current: boolean) => void;
  onToggleHide?: (id: number, currentHidden: boolean) => void;
  onEnlargePhoto?: (photo: PhotoItem) => void;
}

// Helpers
function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  const numBytes = bytes.toLocaleString();
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB (${numBytes} bytes)`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${numBytes} bytes)`;
}

function formatDimensions(width?: number, height?: number) {
  if (!width || !height) return { res: "Not recorded", mp: "", ratio: "" };
  const mp = ((width * height) / 1000000).toFixed(1) + " MP";

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  const ratioW = Math.round(width / divisor);
  const ratioH = Math.round(height / divisor);

  let ratioStr = "";
  const quotient = width / height;
  if (Math.abs(quotient - 4 / 3) < 0.05) ratioStr = "4:3";
  else if (Math.abs(quotient - 16 / 9) < 0.05) ratioStr = "16:9";
  else if (Math.abs(quotient - 3 / 2) < 0.05) ratioStr = "3:2";
  else if (Math.abs(quotient - 1) < 0.05) ratioStr = "1:1";
  else if (Math.abs(quotient - 9 / 16) < 0.05) ratioStr = "9:16";
  else if (Math.abs(quotient - 3 / 4) < 0.05) ratioStr = "3:4";
  else if (ratioW > 0 && ratioH > 0 && ratioW < 50 && ratioH < 50) ratioStr = `${ratioW}:${ratioH}`;

  const isPortrait = height > width;
  const isSquare = height === width;
  const orientation = isPortrait ? "Portrait" : isSquare ? "Square" : "Landscape";

  return { res: `${width} × ${height} px`, mp, ratio: ratioStr, orientation };
}

function formatDate(timestamp?: number) {
  if (!timestamp) return "Not recorded";
  const ms = timestamp > 10000000000 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "Not recorded";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCoordinates(lat?: number | null, lon?: number | null) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
}

function formatBrand(make?: string) {
  if (!make || !make.trim()) return "";
  const cleaned = make.trim();
  // Capitalize properly: "samsung" -> "Samsung", "apple" -> "Apple", "sony" -> "Sony"
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  photo,
  onClose,
  onToggleFavorite,
  onToggleHide,
  onEnlargePhoto,
}) => {
  const [detail, setDetail] = useState<PhotoItem | null>(photo);
  const [copiedPath, setCopiedPath] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Sync state and fetch deep details when selected photo changes
  useEffect(() => {
    setDetail(photo);
    if (!photo) return;

    let isCurrent = true;
    setLoadingDetail(true);

    api
      .getPhotoDetail(photo.id)
      .then((fullData) => {
        if (isCurrent && fullData) {
          setDetail((prev) => ({
            ...(prev || photo),
            ...fullData,
            file_name: fullData.file_name || fullData.name || photo.file_name || photo.name || "",
          }));
        }
      })
      .catch((err) => {
        console.warn("Could not load full photo details:", err);
      })
      .finally(() => {
        if (isCurrent) setLoadingDetail(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [photo?.id]);

  if (!photo) {
    return (
      <aside className="w-80 flex-shrink-0 border-l border-[var(--glass-border)] bg-[var(--glass-sidebar)] backdrop-blur-xl p-4 flex flex-col items-center justify-center text-center select-none">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center mb-3 shadow-inner">
          <Info3DIcon size={28} />
        </div>
        <p className="text-xs font-semibold text-[var(--text-main)] mb-1">Photo Information</p>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Select any photo to inspect camera hardware, lens optics, aperture & exposure, image dimensions, GPS location, and file details.
        </p>
      </aside>
    );
  }

  // Active working object merges props with fetched deep detail
  const current = detail || photo;

  // Derive all data cleanly
  const fileName: string =
    current.file_name ||
    current.name ||
    (current.path ? current.path.split("/").pop() || "" : "") ||
    `Photo #${current.id}`;
  const fileExt: string =
    current.original_extension ||
    (fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() || "JPG" : "JPG");
  const brand = formatBrand(current.camera_make);
  const cameraModel = (current.camera_model || "").trim();
  const lens = (current.lens_model || "").trim();
  const focalLength = current.focal_length || (current.focal_length_mm ? `${current.focal_length_mm}mm` : "");
  const aperture = current.f_number || (current.aperture_f_number ? `ƒ/${current.aperture_f_number}` : "");
  const shutter = current.exposure_time || current.shutter_speed_seconds || "";
  const iso = current.iso || (current.iso_equivalent ? `ISO ${current.iso_equivalent}` : "");
  const colorSpace = current.color_space || "";
  const dimensions = formatDimensions(current.width, current.height);
  const coordsFormatted = formatCoordinates(current.latitude, current.longitude);
  const locationName = current.location_name || (current.city ? `${current.city}${current.country ? `, ${current.country}` : ""}` : "");
  const altitude = current.altitude != null ? `${Math.round(current.altitude)} m` : (current.altitude_meters != null ? `${Math.round(current.altitude_meters)} m` : null);
  const capturedDate = formatDate(current.captured_at || current.created_at);
  const modifiedDate = formatDate(current.mtime);
  const quality = current.quality_score != null ? current.quality_score.toFixed(1) : null;
  const blur = current.blur_score != null ? current.blur_score.toFixed(1) : null;
  const thumbSrc = current.thumb || `/media/${current.id}?w=640`;

  const handleCopyPath = () => {
    if (!current.path) return;
    navigator.clipboard.writeText(current.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <aside className="w-80 flex-shrink-0 border-l border-[var(--glass-border)] bg-[var(--glass-sidebar)] backdrop-blur-xl flex flex-col h-full overflow-y-auto select-none">
      {/* Header */}
      <div className="p-3 border-b border-[var(--glass-border)] flex items-center justify-between sticky top-0 bg-[var(--glass-sidebar)]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-1.5">
          <Info3DIcon size={16} />
          <span className="text-xs font-bold text-[var(--text-main)]">Photo Information</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)] text-xs transition-colors"
          title="Close Inspector"
        >
          ✕
        </button>
      </div>

      {/* Preview Chip */}
      <div className="p-4 border-b border-[var(--glass-border)] flex flex-col items-center">
        <div
          onClick={() => onEnlargePhoto && onEnlargePhoto(current)}
          className={`group w-full rounded-xl overflow-hidden bg-black/10 shadow-sm relative mb-3 cursor-pointer flex items-center justify-center ${
            current.is_portrait || (current.width && current.height && current.height > current.width)
              ? "h-64"
              : "h-44"
          }`}
          title="Click to enlarge photo (Space)"
        >
          <img
            src={thumbSrc}
            alt={fileName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=480&auto=format&fit=crop&q=80";
            }}
          />

          {/* Enlarge Overlay Indicator */}
          {onEnlargePhoto && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium backdrop-blur-[2px]">
              <Maximize2 size={16} />
              <span>Enlarge Photo</span>
            </div>
          )}

          {/* Quick Hide in Vault Button */}
          {onToggleHide && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleHide(current.id, !!current.is_hidden);
              }}
              className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
                current.is_hidden
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-black/40 text-white/80 hover:scale-110"
              }`}
              title={current.is_hidden ? "Unhide from Vault" : "Hide in Hidden Vault (Touch ID protected)"}
            >
              {current.is_hidden ? <Eye size={14} /> : <Lock size={14} />}
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(current.id, current.is_favorite);
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
              current.is_favorite
                ? "bg-amber-500 text-white shadow"
                : "bg-black/40 text-white/80 hover:scale-110"
            }`}
            title={current.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
          >
            <Star size={14} fill={current.is_favorite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="text-xs font-bold text-[var(--text-main)] truncate max-w-full text-center" title={fileName}>
          {fileName}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 text-center">
          {dimensions.res !== "Not recorded" ? `${dimensions.res} · ` : ""}
          {dimensions.mp ? `${dimensions.mp} · ` : ""}
          {(current.size / (1024 * 1024)).toFixed(2)} MB
        </div>
      </div>

      {/* 1. Image Specifications */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          <ImageIcon size={13} className="text-[var(--accent)]" />
          <span>Image Specifications</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Image Name:</span>
            <span className="font-mono text-[var(--text-main)] text-right truncate max-w-[170px]" title={fileName}>
              {fileName}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Format:</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[var(--accent-soft)] text-[var(--accent)]">
              {fileExt}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Dimensions:</span>
            <span className="font-mono text-[var(--text-main)]">
              {dimensions.res}
            </span>
          </div>
          {dimensions.mp && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Megapixels:</span>
              <span className="font-mono text-[var(--text-main)]">
                {dimensions.mp}
              </span>
            </div>
          )}
          {dimensions.ratio && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Aspect Ratio:</span>
              <span className="font-mono text-[var(--text-secondary)]">
                {dimensions.ratio}
              </span>
            </div>
          )}
          {dimensions.orientation && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Orientation:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                  dimensions.orientation === "Portrait"
                    ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                    : dimensions.orientation === "Square"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                }`}
              >
                {dimensions.orientation}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">File Size:</span>
            <span className="font-mono text-[var(--text-main)] text-right text-[11px]">
              {formatFileSize(current.size)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Camera & Hardware */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          <Camera size={13} className="text-[var(--accent)]" />
          <span>Camera & Hardware</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Brand:</span>
            <span className="font-semibold text-[var(--text-main)] text-right truncate max-w-[170px]">
              {brand || "Not recorded in EXIF"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Camera / Phone:</span>
            <span className="font-medium text-[var(--text-main)] text-right truncate max-w-[170px]" title={cameraModel}>
              {cameraModel || (brand ? `${brand} Camera` : "Standard Digital Device")}
            </span>
          </div>
          {lens && (
            <div className="flex justify-between items-start">
              <span className="text-[var(--text-muted)] shrink-0">Lens:</span>
              <span className="font-medium text-[var(--text-main)] text-right truncate max-w-[170px]" title={lens}>
                {lens}
              </span>
            </div>
          )}
          {focalLength && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Focal Length:</span>
              <span className="font-mono text-[var(--text-main)]">
                {focalLength}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Aperture & Exposure Details */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          <Aperture size={13} className="text-[var(--accent)]" />
          <span>Aperture & Exposure</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Aperture:</span>
            <span className="font-mono font-medium text-[var(--text-main)]">
              {aperture || "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Shutter Speed:</span>
            <span className="font-mono text-[var(--text-main)]">
              {shutter || "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">ISO Sensitivity:</span>
            <span className="font-mono text-[var(--text-main)]">
              {iso ? (iso.startsWith("ISO") ? iso : `ISO ${iso}`) : "—"}
            </span>
          </div>
          {colorSpace && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Color Space:</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {colorSpace}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Location & Map (iPhone / Android style) */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
            <MapPin size={13} className="text-[var(--accent)]" />
            <span>Location & Map</span>
          </div>
          {current.latitude != null && current.longitude != null && (
            <a
              href={`https://maps.apple.com/?q=${current.latitude},${current.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline font-medium"
              title="Open full interactive map"
            >
              <span>Apple Maps</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        {/* Small Embedded Map view */}
        {current.latitude != null && current.longitude != null ? (
          <div className="space-y-2">
            <div className="relative w-full h-36 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-inner bg-[var(--canvas-bg)] group">
              <iframe
                title="Photo Location Map"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${current.longitude - 0.008}%2C${current.latitude - 0.005}%2C${current.longitude + 0.008}%2C${current.latitude + 0.005}&layer=mapnik&marker=${current.latitude}%2C${current.longitude}`}
                className="w-full h-full border-0 pointer-events-auto"
                loading="lazy"
              />
              {/* Floating Bottom Location Pill */}
              <div className="absolute bottom-2 left-2 right-2 p-1.5 rounded-lg bg-black/80 backdrop-blur-md text-white flex items-center justify-between text-[10px] shadow-lg pointer-events-none">
                <span className="truncate font-semibold tracking-tight" title={locationName || coordsFormatted || ""}>
                  {locationName || "Photo Location"}
                </span>
                <span className="font-mono text-white/70 text-[9px] shrink-0 ml-1.5">
                  {coordsFormatted}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs pt-0.5">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-[var(--text-muted)]">Coordinates:</span>
                <span className="font-mono text-[var(--text-secondary)]">{coordsFormatted}</span>
              </div>
              {altitude && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[var(--text-muted)]">Altitude:</span>
                  <span className="font-mono text-[var(--text-secondary)]">{altitude}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--surface-hover)]/30 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 rounded-full bg-[var(--button-bg)] flex items-center justify-center text-[var(--text-muted)] mb-1.5">
              <Compass size={15} />
            </div>
            <div className="text-xs font-semibold text-[var(--text-main)]">
              No Map Coordinates
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5 max-w-[210px] leading-relaxed">
              {locationName ? `Labeled as "${locationName}", but lacks GPS coordinates.` : "This photo does not have GPS latitude & longitude tagged in its EXIF metadata."}
            </div>
          </div>
        )}
      </div>

      {/* 5. User Details & File Metadata */}
      <div className="p-4 border-b border-[var(--glass-border)] space-y-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
          <HardDrive size={13} className="text-[var(--accent)]" />
          <span>File & User Details</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Date Taken:</span>
            <span className="font-mono text-[var(--text-main)] text-[11px] text-right">
              {capturedDate}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Date Modified:</span>
            <span className="font-mono text-[var(--text-secondary)] text-[11px] text-right">
              {modifiedDate}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-muted)]">Category:</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-[var(--surface-hover)] text-[var(--text-main)] border border-[var(--glass-border)]">
              {current.category || "General"}
            </span>
          </div>
          {quality && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">AI Quality Score:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--accent)]">{quality} / 10</span>
                <div className="w-12 h-1.5 rounded-full bg-[var(--button-hover)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, (Number(quality) / 10) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {blur && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Sharpness / Blur:</span>
              <span className="font-mono text-[var(--text-secondary)]">
                {blur}
              </span>
            </div>
          )}
          {current.dup_count != null && current.dup_count > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Duplicates:</span>
              <span className="text-amber-500 font-medium">
                {current.dup_count} near {current.dup_count === 1 ? "copy" : "copies"}
              </span>
            </div>
          )}

          {/* Storage Path on Mac with 1-click Copy */}
          {current.path && (
            <div className="pt-1.5 border-t border-[var(--glass-border)]/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Mac Storage Path
                </span>
                <button
                  onClick={handleCopyPath}
                  className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:opacity-80 transition-opacity"
                  title="Copy full file path to clipboard"
                >
                  {copiedPath ? (
                    <>
                      <Check size={11} className="text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy Path</span>
                    </>
                  )}
                </button>
              </div>
              <div
                className="p-2 rounded-lg bg-[var(--glass-card)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)] break-all select-all leading-relaxed"
                title={current.path}
              >
                {current.path}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. OCR Text (if present) */}
      {current.ocr_text && current.ocr_text.trim() && (
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
            <FileText size={13} className="text-[var(--accent)]" />
            <span>Extracted Vision OCR</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[var(--glass-card)] border border-[var(--glass-border)] text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed select-text">
            {current.ocr_text}
          </div>
        </div>
      )}
    </aside>
  );
};
