import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PhotoItem, TimeScale } from "../../types/gallery";

interface TimelineViewProps {
  photos: PhotoItem[];
  selectedPhoto: PhotoItem | null;
  onSelectPhoto: (photo: PhotoItem) => void;
  onToggleFavorite: (id: number, current: boolean) => void;
  timeScale: TimeScale;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  photos,
  selectedPhoto,
  onSelectPhoto,
  onToggleFavorite,
  timeScale,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Group photos by year/month if requested, or render virtualized grid
  const columnCount = timeScale === "years" ? 6 : timeScale === "months" ? 4 : 3;
  const rowCount = Math.ceil(photos.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 4,
  });

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-3xl mb-4">
          🖼️
        </div>
        <h3 className="text-base font-semibold text-[var(--text-main)] mb-1">No Photos Found</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          Click "Index Folder" above to scan any photo folder on your Mac or drag and drop photos here.
        </p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto p-4 select-none">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowPhotos = photos.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full grid gap-3"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                height: `${virtualRow.size}px`,
              }}
            >
              {rowPhotos.map((photo) => {
                const isSelected = selectedPhoto?.id === photo.id;
                const thumbSrc = photo.thumb || `/media/${photo.id}?w=480`;

                return (
                  <div
                    key={photo.id}
                    onClick={() => onSelectPhoto(photo)}
                    className={`group relative rounded-xl overflow-hidden bg-[var(--glass-card)] border transition-all cursor-pointer shadow-sm hover:shadow-md ${
                      isSelected
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                        : "border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]"
                    }`}
                  >
                    {/* Photo Image */}
                    <div className="w-full h-44 overflow-hidden bg-black/5 relative">
                      <img
                        src={thumbSrc}
                        alt={photo.file_name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback placeholder
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80";
                        }}
                      />

                      {/* Video Badge */}
                      {photo.is_video && (
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1">
                          <span>▶</span>
                          <span>Video</span>
                        </div>
                      )}

                      {/* Live Photo / Portrait Badge */}
                      {photo.is_portrait && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold">
                          Portrait
                        </div>
                      )}

                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(photo.id, photo.is_favorite);
                        }}
                        className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all ${
                          photo.is_favorite
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-black/40 text-white/80 opacity-0 group-hover:opacity-100 hover:scale-110"
                        }`}
                        title={photo.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        ★
                      </button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2 flex items-center justify-between text-[11px] bg-[var(--glass-card)]">
                      <div className="truncate font-medium text-[var(--text-main)]" title={photo.file_name}>
                        {photo.file_name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] flex-shrink-0 ml-2">
                        {photo.location_name ? photo.location_name.split(",")[0] : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
