import React, { useMemo } from "react";
import {
  Maximize2,
  Check,
  RotateCcw,
  Trash2,
  Star,
  CheckSquare,
  Square,
  MapPin,
  Camera,
  Calendar,
} from "lucide-react";
import { CatalogStyle, PhotoItem, TimeScale } from "../../types/gallery";

interface TimelineViewProps {
  photos: PhotoItem[];
  selectedPhoto: PhotoItem | null;
  selectedPhotoIds: Set<number>;
  onPhotoClick: (photo: PhotoItem, e: React.MouseEvent) => void;
  onToggleSelectPhoto: (id: number, e?: React.MouseEvent) => void;
  onEnlargePhoto: (photo: PhotoItem) => void;
  onToggleFavorite: (id: number, current: boolean) => void;
  timeScale: TimeScale;
  catalogStyle: CatalogStyle;
  sortOrder?: string;
  isTrashCategory?: boolean;
  isImportCategory?: boolean;
  onSaveImportPhoto?: (id: number) => void;
  onSaveAllImports?: () => void;
  onTrashImportPhoto?: (id: number) => void;
  onRestorePhoto?: (id: number) => void;
  onEmptyTrash?: () => void;
  onRestoreAll?: () => void;
  onSelectSectionPhotos?: (ids: number[]) => void;
  onDropOnCategorySection?: (category: string, ids: number[]) => void;
}

interface PhotoSection {
  id: string;
  title: string;
  subtitle: string;
  photos: PhotoItem[];
}

function getPhotoDate(photo: PhotoItem): Date {
  const ts = photo.captured_at || photo.created_at || photo.mtime;
  if (!ts) return new Date(0);
  const ms = ts > 10000000000 ? ts : ts * 1000;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function formatSectionDate(date: Date, scale: TimeScale): { title: string; subtitle: string; key: string } {
  const now = new Date();
  const year = date.getFullYear();

  if (year <= 1970) {
    return { title: "Undated Photos", subtitle: "No capture date recorded", key: "undated" };
  }

  if (scale === "years") {
    return {
      title: `${year}`,
      subtitle: `Year of ${year}`,
      key: `year-${year}`,
    };
  }

  if (scale === "months") {
    const monthName = date.toLocaleString("en-US", { month: "long" });
    return {
      title: `${monthName} ${year}`,
      subtitle: `${monthName}, ${year}`,
      key: `month-${year}-${date.getMonth()}`,
    };
  }

  // Days scale
  const isToday =
    now.getFullYear() === year &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === year &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  const dayFormatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (isToday) {
    return {
      title: `Today · ${dayFormatted}`,
      subtitle: "Photos taken today",
      key: `day-${year}-${date.getMonth()}-${date.getDate()}`,
    };
  }
  if (isYesterday) {
    return {
      title: `Yesterday · ${dayFormatted}`,
      subtitle: "Photos taken yesterday",
      key: `day-${year}-${date.getMonth()}-${date.getDate()}`,
    };
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return {
    title: `${weekday}, ${dayFormatted}`,
    subtitle: dayFormatted,
    key: `day-${year}-${date.getMonth()}-${date.getDate()}`,
  };
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateString(timestamp?: number) {
  if (!timestamp) return "—";
  const ms = timestamp > 10000000000 ? timestamp : timestamp * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  photos,
  selectedPhoto,
  selectedPhotoIds,
  onPhotoClick,
  onToggleSelectPhoto,
  onEnlargePhoto,
  onToggleFavorite,
  timeScale,
  catalogStyle,
  sortOrder = "date_desc",
  isTrashCategory = false,
  isImportCategory = false,
  onSaveImportPhoto,
  onSaveAllImports,
  onTrashImportPhoto,
  onRestorePhoto,
  onEmptyTrash,
  onRestoreAll,
  onSelectSectionPhotos,
  onDropOnCategorySection,
}) => {
  // Partition photos into sections (by Category if sortOrder === "category", else by TimeScale)
  const sections: PhotoSection[] = useMemo(() => {
    if (photos.length === 0) return [];

    if (sortOrder === "category") {
      const categoryMap = new Map<string, PhotoSection>();
      for (const photo of photos) {
        const cat = (photo.category || "General").toLowerCase();
        const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1);
        let sec = categoryMap.get(cat);
        if (!sec) {
          sec = {
            id: `cat-${cat}`,
            title: `${displayCat} Category`,
            subtitle: "",
            photos: [],
          };
          categoryMap.set(cat, sec);
        }
        sec.photos.push(photo);
      }
      for (const sec of categoryMap.values()) {
        sec.subtitle = `${sec.photos.length} ${sec.photos.length === 1 ? "photo" : "photos"}`;
      }
      return Array.from(categoryMap.values());
    }

    const sectionMap = new Map<string, PhotoSection>();

    for (const photo of photos) {
      const date = getPhotoDate(photo);
      const { title, key } = formatSectionDate(date, timeScale);

      let sec = sectionMap.get(key);
      if (!sec) {
        sec = {
          id: key,
          title,
          subtitle: "",
          photos: [],
        };
        sectionMap.set(key, sec);
      }
      sec.photos.push(photo);
    }

    // Build subtitle summarizing photo count and locations
    for (const sec of sectionMap.values()) {
      const countStr = `${sec.photos.length} ${sec.photos.length === 1 ? "photo" : "photos"}`;
      const locations = Array.from(
        new Set(
          sec.photos
            .map((p) => p.location_name || p.city || "")
            .filter((l) => l.trim().length > 0)
            .map((l) => l.split(",")[0].trim())
        )
      );
      if (locations.length > 0) {
        sec.subtitle = `${countStr} · ${locations.slice(0, 3).join(", ")}`;
      } else {
        sec.subtitle = countStr;
      }
    }

    return Array.from(sectionMap.values());
  }, [photos, timeScale]);

  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-3xl mb-4">
          {isTrashCategory ? "🗑️" : isImportCategory ? "📥" : "🖼️"}
        </div>
        <h3 className="text-base font-semibold text-[var(--text-main)] mb-1">
          {isTrashCategory ? "Trash is Empty" : isImportCategory ? "No Pending Imports" : "No Photos Found"}
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          {isTrashCategory
            ? "No deleted photos currently in the vault trash bin."
            : isImportCategory
            ? "All imported photos have been reviewed and sorted into their library categories."
            : "Click 'Import' above to scan any folder on your Mac or drag and drop photos here."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-4 select-none space-y-4 sm:space-y-6">
      {/* Imports Review Banner */}
      {isImportCategory && (
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg">
              📥
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--text-main)]">
                Imported Media ({photos.length} {photos.length === 1 ? "photo" : "photos"} to review)
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Select photos to keep or remove. Marking photos as "Saved" automatically sorts them into their category folder.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSaveAllImports && photos.length > 0 && (
              <button
                onClick={onSaveAllImports}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                title="Mark all imported photos as saved and sort into categories"
              >
                <Check size={13} className="stroke-[2.5]" />
                <span>Save All to Library</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trash Bin Banner */}
      {isTrashCategory && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg">
              🗑️
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--text-main)]">
                Trash Bin ({photos.length} {photos.length === 1 ? "photo" : "photos"})
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Photos here are retained locally. Put them back to restore or empty the bin to delete permanently.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRestoreAll && (
              <button
                onClick={onRestoreAll}
                className="px-3 py-1.5 rounded-xl bg-[var(--button-bg)] border border-[var(--button-border)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 shadow-sm transition-all"
                title="Restore all photos in trash back to library"
              >
                <RotateCcw size={13} className="text-emerald-500" />
                <span>Put Back All</span>
              </button>
            )}

            {onEmptyTrash && (
              <button
                onClick={onEmptyTrash}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                title="Permanently remove all items in the Trash"
              >
                <Trash2 size={13} />
                <span>Empty Bin</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sections by Year / Month / Day */}
      {sections.map((section) => {
        const allSectionSelected =
          section.photos.length > 0 &&
          section.photos.every((p) => selectedPhotoIds.has(p.id));

        const handleToggleSection = () => {
          if (onSelectSectionPhotos) {
            onSelectSectionPhotos(section.photos.map((p) => p.id));
          } else {
            section.photos.forEach((p) => onToggleSelectPhoto(p.id));
          }
        };

        return (
          <div
            key={section.id}
            onDragOver={(e) => {
              if (sortOrder === "category") e.preventDefault();
            }}
            onDrop={(e) => {
              if (sortOrder === "category" && onDropOnCategorySection) {
                e.preventDefault();
                try {
                  const data = e.dataTransfer.getData("application/json");
                  if (data) {
                    const { ids } = JSON.parse(data);
                    const targetCategory = section.id.replace("cat-", "");
                    onDropOnCategorySection(targetCategory, ids);
                  }
                } catch {}
              }
            }}
            className="space-y-3"
          >
            {/* Section Header */}
            <div className="sticky top-0 bg-[var(--canvas-bg)]/90 backdrop-blur-md z-10 py-1.5 px-1 flex items-center justify-between border-b border-[var(--glass-border)]/50">
              <div className="flex items-baseline gap-2">
                <h3 className="text-xs font-bold text-[var(--text-main)] tracking-tight">
                  {section.title}
                </h3>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {section.subtitle}
                </span>
              </div>

              {/* Quick Select All in Section button */}
              <button
                onClick={handleToggleSection}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--button-hover)] transition-all"
                title={allSectionSelected ? "Deselect Section" : "Select Section (⌘/Shift + Click)"}
              >
                {allSectionSelected ? (
                  <>
                    <CheckSquare size={13} className="text-[var(--accent)]" />
                    <span className="text-[var(--accent)] font-medium">Selected</span>
                  </>
                ) : (
                  <>
                    <Square size={13} />
                    <span>Select</span>
                  </>
                )}
              </button>
            </div>

            {/* Catalog Style: Finder List View */}
            {catalogStyle === "list" ? (
              <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)] bg-[var(--glass-card)] shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-hover)] border-b border-[var(--glass-border)] text-[var(--text-muted)] text-[11px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2 px-3 w-8"></th>
                      <th className="py-2 px-2 w-12"></th>
                      <th className="py-2 px-3">File Name</th>
                      <th className="py-2 px-3">Date Taken</th>
                      <th className="py-2 px-3">Dimensions</th>
                      <th className="py-2 px-3">Size</th>
                      <th className="py-2 px-3">Camera / Phone</th>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {section.photos.map((photo) => {
                      const isSelected = selectedPhotoIds.has(photo.id);
                      const isMultiSelected = selectedPhotoIds.has(photo.id);
                      const thumbSrc = photo.thumb || `/media/${photo.id}?w=160`;
                      const displayName = photo.file_name || photo.name || `Photo #${photo.id}`;
                      const ext =
                        photo.original_extension ||
                        (displayName.includes(".") ? displayName.split(".").pop()?.toUpperCase() : "JPG");
                      const cameraInfo = photo.camera_make
                        ? `${photo.camera_make} ${photo.camera_model || ""}`.trim()
                        : photo.camera_model || "—";
                      const locInfo = photo.location_name || photo.city || (photo.latitude ? `${photo.latitude.toFixed(2)}°, ${photo.longitude?.toFixed(2)}°` : "—");

                      return (
                        <tr
                          key={photo.id}
                          data-photo-item="true"
                          draggable={true}
                          onDragStart={(e) => {
                            const ids = selectedPhotoIds.has(photo.id)
                              ? Array.from(selectedPhotoIds)
                              : [photo.id];
                            e.dataTransfer.setData("application/json", JSON.stringify({ ids }));
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={(e) => onPhotoClick(photo, e)}
                          onDoubleClick={() => onEnlargePhoto(photo)}
                          className={`group transition-colors cursor-pointer select-none ${
                            isSelected
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "hover:bg-[var(--surface-hover)] text-[var(--text-main)]"
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => onToggleSelectPhoto(photo.id, e)}
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                              title={isMultiSelected ? "Deselect photo" : "Select photo (Shift for range)"}
                            >
                              {isMultiSelected ? (
                                <CheckSquare size={14} className="text-[var(--accent)]" />
                              ) : (
                                <Square size={14} />
                              )}
                            </button>
                          </td>

                          {/* Tiny Thumbnail */}
                          <td className="py-1 px-2">
                            <div className="w-11 h-10 flex items-center justify-center rounded-lg overflow-hidden bg-black/10 relative">
                              <img
                                src={thumbSrc}
                                alt=""
                                className={`${
                                  photo.is_portrait || (photo.width && photo.height && photo.height > photo.width)
                                    ? "h-9 w-6 object-cover rounded"
                                    : "w-10 h-7 object-cover rounded"
                                }`}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=80&auto=format&fit=crop&q=80";
                                }}
                              />
                            </div>
                          </td>

                          {/* File Name + Format Badge */}
                          <td className="py-2 px-3 font-medium">
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <span className="truncate" title={displayName}>
                                {displayName}
                              </span>
                              <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-[var(--accent-soft)] text-[var(--accent)]">
                                {ext}
                              </span>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                            {formatDateString(photo.captured_at || photo.created_at || photo.mtime)}
                          </td>

                          {/* Dimensions & Orientation */}
                          <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                            <div className="flex items-center gap-1.5">
                              <span>{photo.width && photo.height ? `${photo.width} × ${photo.height}` : "—"}</span>
                              {photo.width && photo.height && (
                                <span
                                  className={`px-1 py-0.2 rounded text-[9px] font-sans font-medium ${
                                    photo.height > photo.width || photo.is_portrait
                                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                      : photo.width > photo.height
                                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  }`}
                                >
                                  {photo.height > photo.width || photo.is_portrait
                                    ? "Portrait"
                                    : photo.width > photo.height
                                    ? "Landscape"
                                    : "Square"}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Size */}
                          <td className="py-2 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                            {formatFileSize(photo.size)}
                          </td>

                          {/* Camera / Phone */}
                          <td className="py-2 px-3 text-[11px] truncate max-w-[150px]" title={cameraInfo}>
                            {cameraInfo}
                          </td>

                          {/* Location */}
                          <td className="py-2 px-3 text-[11px] text-[var(--text-muted)] truncate max-w-[150px]" title={locInfo}>
                            {locInfo}
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => onEnlargePhoto(photo)}
                                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)]"
                                title="Enlarge photo (Space)"
                              >
                                <Maximize2 size={13} />
                              </button>

                              {isImportCategory ? (
                                <div className="flex items-center gap-1">
                                  {onSaveImportPhoto && (
                                    <button
                                      onClick={() => onSaveImportPhoto(photo.id)}
                                      className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all"
                                      title="Mark as Saved & Auto-sort"
                                    >
                                      <Check size={11} className="stroke-[2.5]" />
                                      <span>Save</span>
                                    </button>
                                  )}
                                  {onTrashImportPhoto && (
                                    <button
                                      onClick={() => onTrashImportPhoto(photo.id)}
                                      className="p-1 rounded text-rose-500 hover:bg-rose-500/15"
                                      title="Move to Trash"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              ) : isTrashCategory || photo.is_trashed ? (
                                onRestorePhoto && (
                                  <button
                                    onClick={() => onRestorePhoto(photo.id)}
                                    className="p-1 rounded text-emerald-500 hover:bg-emerald-500/15"
                                    title="Put Back"
                                  >
                                    <RotateCcw size={13} />
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={() => onToggleFavorite(photo.id, photo.is_favorite)}
                                  className={`p-1 rounded ${
                                    photo.is_favorite
                                      ? "text-amber-500"
                                      : "text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--button-hover)]"
                                  }`}
                                  title={photo.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                  <Star size={13} fill={photo.is_favorite ? "currentColor" : "none"} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid Catalog Modes: Small, Medium, Large (True Orientation: Portrait as portrait, Landscape as landscape) */
              <div
                className={`${
                  catalogStyle === "small"
                    ? "columns-2 sm:columns-3 md:columns-4 lg:columns-6 xl:columns-8 gap-2 sm:gap-2.5"
                    : catalogStyle === "large"
                    ? "columns-1 sm:columns-2 lg:columns-3 gap-3 sm:gap-5"
                    : "columns-1 xs:columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-2.5 sm:gap-3.5"
                }`}
              >
                {section.photos.map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  const isMultiSelected = selectedPhotoIds.has(photo.id);
                  const thumbSrc =
                    photo.thumb ||
                    `/media/${photo.id}?w=${catalogStyle === "large" ? 800 : catalogStyle === "small" ? 240 : 480}`;
                  const displayName = photo.file_name || photo.name || `Photo #${photo.id}`;

                  // Determine genuine orientation: portrait vs landscape vs square
                  const isPortrait =
                    photo.is_portrait ||
                    (photo.width && photo.height ? photo.height > photo.width : false);
                  const isSquare =
                    photo.width && photo.height ? photo.width === photo.height : false;

                  let aspectStyle: React.CSSProperties = {};
                  if (photo.width && photo.height && photo.width > 0 && photo.height > 0) {
                    // Clamp aspect ratio between 0.58 (phone 9:16 portrait) and 1.90 (16:9 widescreen landscape)
                    const rawRatio = photo.width / photo.height;
                    const clampedRatio = Math.max(0.58, Math.min(1.9, rawRatio));
                    aspectStyle = { aspectRatio: `${clampedRatio}` };
                  } else if (isPortrait) {
                    aspectStyle = { aspectRatio: "3 / 4" };
                  } else if (isSquare) {
                    aspectStyle = { aspectRatio: "1 / 1" };
                  } else {
                    aspectStyle = { aspectRatio: "4 / 3" };
                  }

                  return (
                    <div
                      key={photo.id}
                      data-photo-item="true"
                      draggable={true}
                      onDragStart={(e) => {
                        const ids = selectedPhotoIds.has(photo.id)
                          ? Array.from(selectedPhotoIds)
                          : [photo.id];
                        e.dataTransfer.setData("application/json", JSON.stringify({ ids }));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={(e) => onPhotoClick(photo, e)}
                      onDoubleClick={() => onEnlargePhoto(photo)}
                      className={`group relative rounded-xl overflow-hidden bg-[var(--glass-card)] border transition-all cursor-pointer shadow-sm hover:shadow-md break-inside-avoid inline-block w-full ${
                        catalogStyle === "small" ? "mb-2.5" : catalogStyle === "large" ? "mb-5" : "mb-3.5"
                      } ${
                        isSelected
                          ? "border-[var(--accent)] ring-2 ring-[var(--accent)] bg-blue-500/5 shadow-md"
                          : "border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]"
                      }`}
                    >
                      {/* Photo Image Container with Dynamic Aspect Ratio */}
                      <div
                        className="w-full overflow-hidden bg-black/5 relative rounded-t-xl"
                        style={aspectStyle}
                      >
                        <img
                          src={thumbSrc}
                          alt={displayName}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80";
                          }}
                        />

                        {/* Multi-Selection Checkbox (top-left) - Supports Shift-click */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelectPhoto(photo.id, e);
                          }}
                          className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center transition-all z-20 ${
                            isMultiSelected
                              ? "bg-blue-600 text-white shadow-md ring-2 ring-white scale-100 opacity-100"
                              : "bg-black/45 text-white/70 hover:text-white hover:bg-black/70 opacity-0 group-hover:opacity-100"
                          }`}
                          title={
                            isMultiSelected
                              ? "Deselect photo"
                              : "Select photo (Hold Shift to select range, ⌘/Ctrl to multi-select)"
                          }
                        >
                          {isMultiSelected ? (
                            <Check size={14} strokeWidth={3} />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-white/80" />
                          )}
                        </button>

                        {/* Enlarge Button (on hover) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEnlargePhoto(photo);
                          }}
                          className="absolute top-2 left-10 p-1.5 rounded-full bg-black/60 hover:bg-blue-600 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-md z-10"
                          title="Open Enlarged (Space / Double-click)"
                        >
                          <Maximize2 size={12} />
                        </button>

                        {/* Video Badge */}
                        {photo.is_video && (
                          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1">
                            <span>▶</span>
                            <span>Video</span>
                          </div>
                        )}

                        {/* Import Actions or Favorite / Put Back Button */}
                        {isImportCategory ? (
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                            {onSaveImportPhoto && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSaveImportPhoto(photo.id);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-md transition-all hover:scale-105"
                                title="Mark as Saved & Auto-sort"
                              >
                                <Check size={12} className="stroke-[2.5]" />
                                <span className="hidden sm:inline">Save</span>
                              </button>
                            )}
                            {onTrashImportPhoto && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTrashImportPhoto(photo.id);
                                }}
                                className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white shadow-md transition-all hover:scale-105"
                                title="Move to Trash"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        ) : isTrashCategory || photo.is_trashed ? (
                          onRestorePhoto && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRestorePhoto(photo.id);
                              }}
                              className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-md z-10 transition-all hover:scale-105"
                              title="Put back photo where it was deleted"
                            >
                              <RotateCcw size={12} />
                              <span className="hidden sm:inline">Put Back</span>
                            </button>
                          )
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(photo.id, photo.is_favorite);
                            }}
                            className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition-all z-10 ${
                              photo.is_favorite
                                ? "bg-amber-500 text-white shadow-sm"
                                : "bg-black/40 text-white/80 opacity-0 group-hover:opacity-100 hover:scale-110"
                            }`}
                            title={photo.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                          >
                            <Star size={13} fill={photo.is_favorite ? "currentColor" : "none"} />
                          </button>
                        )}
                      </div>

                      {/* Metadata Footer (Medium & Large) */}
                      {catalogStyle !== "small" && (
                        <div className="p-2.5 bg-[var(--glass-card)]">
                          <div className="flex items-center justify-between">
                            <div className="truncate font-medium text-xs text-[var(--text-main)]" title={displayName}>
                              {displayName}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono shrink-0 ml-1">
                              {formatFileSize(photo.size)}
                            </div>
                          </div>

                          {/* Extra info for Large mode */}
                          {catalogStyle === "large" && (
                            <div className="mt-1.5 pt-1.5 border-t border-[var(--glass-border)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                              <span className="truncate" title={photo.camera_make ? `${photo.camera_make} ${photo.camera_model || ""}` : photo.camera_model || "Digital Photo"}>
                                {photo.camera_make ? `${photo.camera_make} ${photo.camera_model || ""}` : photo.camera_model || "Digital Photo"}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {photo.width && photo.height && (
                                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                                    {photo.width}×{photo.height}
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                    isPortrait
                                      ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                      : isSquare
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                  }`}
                                >
                                  {isPortrait ? "Portrait" : isSquare ? "Square" : "Landscape"}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
