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
  ZoomIn,
  ZoomOut,
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
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [rotation, setRotation] = useState<number>(0);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);

  // Check if current item is a video file
  const isVideo = Boolean(
    photo?.is_video ||
    (photo?.original_extension && ["mp4", "mov", "m4v", "webm", "mkv", "avi"].includes(photo.original_extension.toLowerCase())) ||
    (photo?.file_name && /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(photo.file_name))
  );

  // Reset image view and zoom whenever photo changes
  useEffect(() => {
    setImageLoaded(false);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    setRotation(0);
  }, [photo?.id]);

  // Non-passive wheel event listener to capture trackpad pinch-in/pinch-out gestures
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Pinch gesture on macOS trackpads emits ctrlKey: true
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const zoomFactor = Math.exp(-e.deltaY * 0.015);
        setZoomScale((prev) => {
          const next = Math.min(5.0, Math.max(0.6, prev * zoomFactor));
          if (next <= 1.05 && prev > 1.05) {
            setPanOffset({ x: 0, y: 0 });
          }
          return Number(next.toFixed(3));
        });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [photo?.id]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleAutoRotate = () => {
    setRotation((prev) => (prev === 0 ? 90 : 0));
  };

  const handleToggleZoom = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (zoomScale > 1.1) {
      setZoomScale(1.0);
      setPanOffset({ x: 0, y: 0 });
    } else {
      setZoomScale(2.5);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1.05) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...panOffset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1.05) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Current index in photos array
  const currentIndex = photo ? photos.findIndex((p) => p.id === photo.id) : -1;
  const hasPhotos = photos.length > 0;
  const canGoPrev = hasPhotos && photos.length > 1;
  const canGoNext = hasPhotos && photos.length > 1;

  // Navigation handlers
  const handlePrev = () => {
    if (!hasPhotos || currentIndex === -1) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : photos.length - 1;
    setImageLoaded(false);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    onSelectPhoto(photos[prevIndex]);
  };

  const handleNext = () => {
    if (!hasPhotos || currentIndex === -1) return;
    const nextIndex = currentIndex < photos.length - 1 ? currentIndex + 1 : 0;
    setImageLoaded(false);
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
    onSelectPhoto(photos[nextIndex]);
  };

  // Keyboard navigation inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
      } else if (e.key.toLowerCase() === "k" && photo && photo.is_imported && onKeepPhoto) {
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
        handleToggleZoom();
      } else if (e.key.toLowerCase() === "r" && photo) {
        e.preventDefault();
        e.stopPropagation();
        handleRotate();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, photo, currentIndex, photos, zoomScale]);

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
      onClick={() => {
        setZoomScale(1.0);
        setPanOffset({ x: 0, y: 0 });
      }}
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
              {isVideo ? " · Video" : ""}
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

          {/* Zoom Controls Bar */}
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/10 border border-white/10 mr-1">
            <button
              onClick={() => {
                setZoomScale((prev) => Math.max(0.6, Number((prev - 0.25).toFixed(2))));
              }}
              className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-all"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => {
                setZoomScale(1.0);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-white/20 text-white/90"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              onClick={() => {
                setZoomScale((prev) => Math.min(5.0, Number((prev + 0.25).toFixed(2))));
              }}
              className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-all"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>

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

          {/* Auto Rotate button */}
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

          {/* Save to Library Action (ONLY shown when photo is an uncommitted import!) */}
          {photo.is_imported && onKeepPhoto && (
            <button
              onClick={() => {
                onKeepPhoto(photo.id);
                handleNext();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
              title="Save to Library (K)"
            >
              <Check size={14} className="stroke-[2.5]" />
              <span className="hidden sm:inline">Save to Library</span>
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

      {/* Main Media Viewing Canvas with Left & Right Nav Buttons */}
      <div
        ref={canvasContainerRef}
        className="relative flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
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

        {/* Center Media Container */}
        <div
          className={`relative flex items-center justify-center max-w-full max-h-full select-none ${
            zoomScale > 1.05
              ? isDragging
                ? "cursor-grabbing"
                : "cursor-grab"
              : "cursor-zoom-in"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle loading spinner while high-res loads */}
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* VIDEO PLAYER */}
          {isVideo ? (
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              className="relative flex items-center justify-center"
            >
              <video
                ref={videoRef}
                src={`/media/raw/${photo.id}`}
                poster={`/media/${photo.id}?w=1600`}
                controls
                autoPlay
                playsInline
                onLoadedData={() => setImageLoaded(true)}
                onDoubleClick={handleToggleZoom}
                className="max-w-[88vw] max-h-[72vh] md:max-h-[76vh] object-contain rounded-lg shadow-2xl bg-black"
              />
            </div>
          ) : (
            /* IMAGE VIEWER */
            <img
              src={fullImageSrc}
              alt={fileName}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
              onLoad={() => setImageLoaded(true)}
              onDoubleClick={handleToggleZoom}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== fallbackSrc) {
                  target.src = fallbackSrc;
                } else {
                  target.src =
                    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80";
                }
                setImageLoaded(true);
              }}
              className={`max-w-[88vw] max-h-[72vh] md:max-h-[76vh] object-contain rounded-lg shadow-2xl ${
                imageLoaded ? "opacity-100" : "opacity-40"
              }`}
            />
          )}

          {/* Video Indicator Overlay */}
          {isVideo && (
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-2 border border-white/20 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Video Playback</span>
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
                    : photo.camera_model || (isVideo ? "Video Clip" : "Digital Image")}
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
                  setZoomScale(1.0);
                  setPanOffset({ x: 0, y: 0 });
                  setShowInfo(false);
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
                {item.is_video && (
                  <div className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[8px] font-mono text-white">
                    ▶
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
          <span>Trackpad Pinch / Space : Zoom</span>
          <span>·</span>
          <span>F : Fav</span>
        </div>
      </div>
    </div>
  );
};
