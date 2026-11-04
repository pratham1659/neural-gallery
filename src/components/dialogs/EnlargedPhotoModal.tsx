import React, { useEffect, useRef, useState } from "react";
import { PhotoItem } from "../../types/gallery";
import { Info3DIcon } from "../common/Info3DIcon";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Star,
  Check,
  Trash2,
  Maximize,
  Minimize,
  Camera,
  Info,
  RotateCcw,
  RotateCw,
  Smartphone,
} from "lucide-react";

interface EnlargedPhotoModalProps {
  isOpen: boolean;
  photo: PhotoItem | null;
  photos: PhotoItem[];
  onClose: () => void;
  onSelectPhoto: (photo: PhotoItem) => void;
  onToggleFavorite: (id: number, current: boolean) => void;
  onKeepPhoto?: (id: number) => void;
  onTrashPhoto?: (id: number) => void;
  onRestorePhoto?: (id: number) => void;
}

export const EnlargedPhotoModal: React.FC<EnlargedPhotoModalProps> = ({
  isOpen,
  photo,
  photos,
  onClose,
  onSelectPhoto,
  onToggleFavorite,
  onKeepPhoto,
  onTrashPhoto,
  onRestorePhoto,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [rotation, setRotation] = useState<number>(0);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  // Reset image view and show naturally: portrait as portrait, landscape as landscape
  useEffect(() => {
    setImageLoaded(false);
    setIsZoomed(false);
    // Keep true orientation by default: landscape as landscape, portrait as portrait
    setRotation(0);
  }, [photo?.id]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleAutoRotate = () => {
    // Toggle 90° rotation if user wishes to rotate between orientations
    setRotation((prev) => (prev === 0 ? 90 : 0));
  };

  // Current index in photos array
  const currentIndex = photo ? photos.findIndex((p) => p.id === photo.id) : -1;
  const hasPhotos = photos.length > 0;
  const canGoPrev = hasPhotos && (photos.length > 1);
  const canGoNext = hasPhotos && (photos.length > 1);

  // Navigation handlers
  const handlePrev = () => {
    if (!hasPhotos || currentIndex === -1) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    setImageLoaded(false);
    setIsZoomed(false);
    onSelectPhoto(photos[prevIndex]);
  };

  const handleNext = () => {
    if (!hasPhotos || currentIndex === -1) return;
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    setImageLoaded(false);
    setIsZoomed(false);
    onSelectPhoto(photos[nextIndex]);
  };

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when editing text inputs
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key.toLowerCase() === "f" && photo) {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(photo.id, photo.is_favorite);
      } else if (e.key.toLowerCase() === "k" && photo && onKeepPhoto) {
        e.preventDefault();
        e.stopPropagation();
        onKeepPhoto(photo.id);
        handleNext();
      } else if (e.key.toLowerCase() === "n" && photo && onTrashPhoto) {
        e.preventDefault();
        e.stopPropagation();
        onTrashPhoto(photo.id);
      } else if (e.key === " " && photo) {
        e.preventDefault();
        e.stopPropagation();
        setIsZoomed((prev) => !prev);
      } else if (e.key.toLowerCase() === "r" && photo) {
        e.preventDefault();
        e.stopPropagation();
        handleRotate();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, photo, currentIndex, photos]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbnailStripRef.current && currentIndex >= 0) {
      const activeThumb = thumbnailStripRef.current.children[currentIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [currentIndex]);

  if (!isOpen || !photo) return null;

  const fileName = photo.file_name || photo.name || `Photo #${photo.id}`;
  const fullImageSrc = `/media/${photo.id}?w=1600`;
  const fallbackSrc = photo.thumb || fullImageSrc;

  // Format camera specs
  const opticsParts = [
    photo.camera_model,
    photo.f_number || (photo.aperture_f_number ? `ƒ/${photo.aperture_f_number}` : ""),
    photo.exposure_time || photo.shutter_speed_seconds,
    photo.iso ? `ISO ${photo.iso}` : (photo.iso_equivalent ? `ISO ${photo.iso_equivalent}` : ""),
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-2xl text-white select-none transition-all duration-200"
      onClick={() => setIsZoomed(false)}
    >
      {/* Top Header Bar */}
      <div
        className="w-full h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md z-30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Index Counter & File Name */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono font-medium text-white/90 shrink-0">
            {currentIndex + 1} of {photos.length}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white/95 truncate max-w-xs md:max-w-md">
              {fileName}
            </span>
            <span className="text-[10px] text-white/60 font-mono">
              {photo.width && photo.height ? `${photo.width} × ${photo.height} · ` : ""}
              {(photo.size / (1024 * 1024)).toFixed(2)} MB
              {photo.location_name ? ` · ${photo.location_name}` : ""}
            </span>
          </div>
        </div>

        {/* Right: Actions & Close */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Optics Info */}
          {opticsParts.length > 0 && (
            <div className="hidden lg:flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/80 mr-2 font-mono">
              <Camera size={13} className="text-blue-400" />
              <span>{opticsParts.join(" · ")}</span>
            </div>
          )}

          {/* Rotate 90° Clockwise */}
          <button
            onClick={handleRotate}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all flex items-center gap-1"
            title="Rotate 90° Clockwise (R)"
          >
            <RotateCw size={16} />
            {rotation !== 0 && (
              <span className="text-[10px] font-mono hidden sm:inline">{rotation}°</span>
            )}
          </button>

          {/* Auto Rotate button (Portrait default) */}
          <button
            onClick={handleAutoRotate}
            className={`p-2 rounded-lg transition-all flex items-center gap-1 ${
              rotation !== 0
                ? "bg-amber-600/80 text-white"
                : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
            }`}
            title="Auto-Rotate / Toggle Portrait & Landscape"
          >
            <Smartphone size={16} className={rotation % 180 !== 0 ? "rotate-90" : ""} />
            <span className="text-[10px] hidden md:inline">
              {rotation % 180 !== 0 ? "Portrait" : "Original"}
            </span>
          </button>

          {/* Toggle Info Sheet */}
          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`p-1.5 rounded-lg transition-all flex items-center justify-center hover:scale-105 active:scale-95 ${
              showInfo
                ? "bg-blue-600/40 ring-2 ring-blue-500 shadow-md shadow-blue-500/30"
                : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
            }`}
            title="Toggle Photo Information"
          >
            <Info3DIcon size={18} />
          </button>

          {/* Zoom Toggle */}
          <button
            onClick={() => setIsZoomed((prev) => !prev)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all"
            title={isZoomed ? "Actual Size (Space)" : "Zoom In (Space)"}
          >
            {isZoomed ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>

          {/* Keep Action (K) */}
          {onKeepPhoto && (
            <button
              onClick={() => {
                onKeepPhoto(photo.id);
                handleNext();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-medium flex items-center gap-1 transition-all"
              title="Keep photo (K)"
            >
              <Check size={14} />
              <span className="hidden sm:inline">Keep</span>
              <span className="text-[10px] opacity-75 font-mono">K</span>
            </button>
          )}

          {/* Put Back / Restore Action (if in Trash) */}
          {photo.is_trashed ? (
            onRestorePhoto && (
              <button
                onClick={() => {
                  onRestorePhoto(photo.id);
                  handleNext();
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-md"
                title="Put back photo where it was deleted"
              >
                <RotateCcw size={14} />
                <span>Put Back</span>
              </button>
            )
          ) : (
            onTrashPhoto && (
              <button
                onClick={() => onTrashPhoto(photo.id)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium flex items-center gap-1 transition-all"
                title="Move to Trash (N)"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Trash</span>
                <span className="text-[10px] opacity-75 font-mono">N</span>
              </button>
            )
          )}

          {/* Favorite Action (F) */}
          <button
            onClick={() => onToggleFavorite(photo.id, photo.is_favorite)}
            className={`p-2 rounded-lg transition-all ${
              photo.is_favorite
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white"
            }`}
            title={photo.is_favorite ? "Remove from Favorites (F)" : "Add to Favorites (F)"}
          >
            <Star size={16} fill={photo.is_favorite ? "currentColor" : "none"} />
          </button>

          <div className="h-5 w-[1px] bg-white/15 mx-1" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-rose-600 text-white transition-all flex items-center gap-1"
            title="Close Enlarged View (Esc)"
          >
            <X size={17} />
            <span className="text-[11px] font-mono opacity-80 hidden md:inline">ESC</span>
          </button>
        </div>
      </div>

      {/* Main Photo Viewing Canvas with Left & Right Nav Buttons */}
      <div className="relative flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden">
        {/* Clickable Left (Previous) Navigation Button */}
        {canGoPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-30 p-3 md:p-4 rounded-full bg-black/60 hover:bg-blue-600 active:scale-95 text-white/90 hover:text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all duration-150 hover:scale-110 cursor-pointer group"
            title="Previous photo (Left Arrow ←)"
            aria-label="Previous image"
          >
            <ChevronLeft size={28} className="transition-transform group-hover:-translate-x-0.5" />
          </button>
        )}

        {/* Center Image Container */}
        <div
          className={`relative flex items-center justify-center max-w-full max-h-full transition-transform duration-200 ${
            isZoomed ? "scale-125 cursor-zoom-out" : "cursor-zoom-in"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setIsZoomed((prev) => !prev);
          }}
        >
          {/* Subtle loading spinner while high-res loads */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          <img
            src={fullImageSrc}
            alt={fileName}
            style={{ transform: `rotate(${rotation}deg)` }}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              // Fallback to thumbnail or placeholder if 1600px fails
              const target = e.target as HTMLImageElement;
              if (target.src !== fallbackSrc) {
                target.src = fallbackSrc;
              } else {
                target.src =
                  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80";
              }
              setImageLoaded(true);
            }}
            className={`max-w-[88vw] max-h-[72vh] md:max-h-[76vh] object-contain rounded-lg shadow-2xl transition-all duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-40"
            }`}
          />

          {/* Video Indicator Overlay */}
          {photo.is_video && (
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-2 border border-white/20">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Video File</span>
            </div>
          )}
        </div>

        {/* Clickable Right (Next) Navigation Button */}
        {canGoNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-30 p-3 md:p-4 rounded-full bg-black/60 hover:bg-blue-600 active:scale-95 text-white/90 hover:text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all duration-150 hover:scale-110 cursor-pointer group"
            title="Next photo (Right Arrow →)"
            aria-label="Next image"
          >
            <ChevronRight size={28} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* Floating Photo Information Drawer (if toggled on) */}
        {showInfo && (
          <div
            className="absolute top-4 right-4 z-40 w-80 max-h-[80vh] overflow-y-auto rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 p-4 shadow-2xl space-y-3 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Info3DIcon size={15} />
                <span>Photo Information</span>
              </span>
              <button
                onClick={() => setShowInfo(false)}
                className="text-white/60 hover:text-white transition-colors"
                title="Close Information"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {/* File Name */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Image Name:</span>
                <span className="font-mono text-white text-right truncate max-w-[170px]" title={photo.file_name || photo.name}>
                  {photo.file_name || photo.name || "Photo"}
                </span>
              </div>

              {/* Brand & Camera Phone */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Brand / Device:</span>
                <span className="font-medium text-white text-right truncate max-w-[170px]">
                  {photo.camera_make
                    ? `${photo.camera_make.charAt(0).toUpperCase() + photo.camera_make.slice(1)} ${photo.camera_model || ""}`.trim()
                    : photo.camera_model || "Digital Image"}
                </span>
              </div>

              {photo.lens_model && (
                <div className="flex justify-between items-start">
                  <span className="text-white/60 shrink-0">Lens:</span>
                  <span className="text-white text-right truncate max-w-[170px]" title={photo.lens_model}>
                    {photo.lens_model}
                  </span>
                </div>
              )}

              {/* Aperture */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Aperture:</span>
                <span className="font-mono text-white">
                  {photo.f_number || (photo.aperture_f_number ? `ƒ/${photo.aperture_f_number}` : "—")}
                </span>
              </div>

              {/* Shutter Speed */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Shutter Speed:</span>
                <span className="font-mono text-white">
                  {photo.exposure_time || photo.shutter_speed_seconds || "—"}
                </span>
              </div>

              {/* ISO */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">ISO Sensitivity:</span>
                <span className="font-mono text-white">
                  {photo.iso ? (photo.iso.startsWith("ISO") ? photo.iso : `ISO ${photo.iso}`) : (photo.iso_equivalent ? `ISO ${photo.iso_equivalent}` : "—")}
                </span>
              </div>

              {/* Resolution & MP */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Dimensions:</span>
                <span className="font-mono text-white">
                  {photo.width && photo.height
                    ? `${photo.width} × ${photo.height} (${((photo.width * photo.height) / 1000000).toFixed(1)} MP)`
                    : "—"}
                </span>
              </div>

              {/* File Size */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">File Size:</span>
                <span className="font-mono text-white">
                  {photo.size
                    ? `${(photo.size / (1024 * 1024)).toFixed(2)} MB (${photo.size.toLocaleString()} B)`
                    : "—"}
                </span>
              </div>

              {/* Location */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Location:</span>
                <span className="text-right truncate max-w-[170px] text-white" title={photo.location_name || photo.city || "No GPS tagged"}>
                  {photo.location_name || photo.city || (photo.latitude ? `${photo.latitude.toFixed(4)}°, ${photo.longitude?.toFixed(4)}°` : "No GPS tagged")}
                </span>
              </div>

              {/* Category */}
              <div className="flex justify-between items-center">
                <span className="text-white/60">Category:</span>
                <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white font-medium">
                  {photo.category}
                </span>
              </div>

              {/* Date */}
              {(photo.captured_at || photo.created_at || photo.mtime) && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Date:</span>
                  <span className="font-mono text-white/90 text-[11px] text-right">
                    {new Date(
                      ((photo.captured_at || photo.created_at || photo.mtime || 0) > 10000000000
                        ? (photo.captured_at || photo.created_at || photo.mtime || 0)
                        : (photo.captured_at || photo.created_at || photo.mtime || 0) * 1000)
                    ).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Filmstrip Carousel */}
      <div
        className="w-full h-20 px-4 py-2 border-t border-white/10 bg-black/50 backdrop-blur-md flex items-center gap-3 z-30"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-mono text-white/50 shrink-0 hidden sm:inline">
          Navigation:
        </span>

        {/* Scrollable Filmstrip */}
        <div
          ref={thumbnailStripRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
        >
          {photos.map((item, idx) => {
            const isCurrent = item.id === photo.id;
            const thumbSrc = item.thumb || `/media/${item.id}?w=120`;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setImageLoaded(false);
                  setIsZoomed(false);
                  onSelectPhoto(item);
                }}
                className={`relative shrink-0 h-14 w-14 rounded-lg overflow-hidden border transition-all duration-150 cursor-pointer ${
                  isCurrent
                    ? "border-blue-500 ring-2 ring-blue-500 scale-105 shadow-lg shadow-blue-500/40"
                    : "border-white/15 opacity-60 hover:opacity-100 hover:border-white/40"
                }`}
                title={`${item.file_name || item.name} (${idx + 1} of ${photos.length})`}
              >
                <img
                  src={thumbSrc}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=80&auto=format&fit=crop&q=80";
                  }}
                />
                {item.is_favorite && (
                  <div className="absolute top-0.5 right-0.5 text-[8px] text-amber-400">
                    ★
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Keyboard Hints Pill */}
        <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-white/50 shrink-0 px-2 py-1 rounded bg-white/5 border border-white/10">
          <span>← / → : Navigate</span>
          <span>·</span>
          <span>Space : Zoom</span>
          <span>·</span>
          <span>F : Fav</span>
        </div>
      </div>
    </div>
  );
};
