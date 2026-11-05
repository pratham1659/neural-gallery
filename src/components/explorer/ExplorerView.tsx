import React from "react";
import { Maximize2, RotateCcw, Trash2, Check, Star, CheckSquare, Square } from "lucide-react";
import { CatalogStyle, PhotoItem } from "../../types/gallery";

interface ExplorerViewProps {
  photos: PhotoItem[];
  selectedPhoto: PhotoItem | null;
  selectedPhotoIds: Set<number>;
  onPhotoClick: (photo: PhotoItem, e: React.MouseEvent) => void;
  onToggleSelectPhoto: (id: number, e?: React.MouseEvent) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onEnlargePhoto: (photo: PhotoItem) => void;
  onKeepPhoto: (id: number) => void;
  onTrashPhoto: (id: number) => void;
  onToggleFavorite: (id: number, current: boolean) => void;
  isTrashCategory?: boolean;
  onRestorePhoto?: (id: number) => void;
  onEmptyTrash?: () => void;
  onRestoreAll?: () => void;
  catalogStyle?: CatalogStyle;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  photos,
  selectedPhoto,
  selectedPhotoIds,
  onPhotoClick,
  onToggleSelectPhoto,
  onSelectAll,
  onClearSelection,
  onEnlargePhoto,
  onKeepPhoto,
  onTrashPhoto,
  onToggleFavorite,
  isTrashCategory = false,
  onRestorePhoto,
  onEmptyTrash,
  onRestoreAll,
  catalogStyle = "list",
}) => {
  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-3xl mb-4">
          {isTrashCategory ? "🗑️" : "🗂️"}
        </div>
        <h3 className="text-base font-semibold text-[var(--text-main)] mb-1">
          {isTrashCategory ? "Trash is Empty" : "Explorer is Empty"}
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          {isTrashCategory
            ? "No deleted items currently in the trash bin."
            : "No photos match the selected filter or category."}
        </p>
      </div>
    );
  }

  const allSelected = photos.length > 0 && photos.every((p) => selectedPhotoIds.has(p.id));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Trash Bin Header Banner (when in Trash category) */}
      {isTrashCategory && (
        <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🗑️</span>
            <div>
              <span className="text-xs font-bold text-[var(--text-main)]">
                Trash Bin ({photos.length} items)
              </span>
              <span className="text-[11px] text-[var(--text-muted)] ml-2">
                Put back photos to return them to your gallery or empty the bin.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRestoreAll && (
              <button
                onClick={onRestoreAll}
                className="px-3 py-1 rounded-lg bg-[var(--button-bg)] border border-[var(--button-border)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 shadow-sm transition-all"
              >
                <RotateCcw size={13} className="text-emerald-500" />
                <span>Put Back All</span>
              </button>
            )}

            {onEmptyTrash && (
              <button
                onClick={onEmptyTrash}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Trash2 size={13} />
                <span>Empty Bin</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Rapid Triage Action Header */}
      {selectedPhoto && (
        <div className="px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-card)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--text-main)]">
              {isTrashCategory ? "Selected in Trash:" : "Active Photo:"}
            </span>
            <span className="text-xs text-[var(--text-muted)] truncate max-w-xs font-mono">
              {selectedPhoto.file_name || selectedPhoto.name}
            </span>
            {selectedPhotoIds.size > 1 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold">
                +{selectedPhotoIds.size - 1} more selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* If in Trash: Show Put Back button */}
            {isTrashCategory || selectedPhoto.is_trashed ? (
              onRestorePhoto && (
                <button
                  onClick={() => onRestorePhoto(selectedPhoto.id)}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 flex items-center gap-1.5 transition-all"
                  title="Put back this photo where it was deleted"
                >
                  <RotateCcw size={13} />
                  <span>Put Back</span>
                </button>
              )
            ) : (
              <>
                {selectedPhoto.is_imported && (
                  <button
                    onClick={() => onKeepPhoto(selectedPhoto.id)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 flex items-center gap-1.5 transition-all"
                    title="Save to Library (K)"
                  >
                    <span>✓ Save to Library</span>
                    <span className="text-[10px] opacity-75 font-mono">K</span>
                  </button>
                )}

                <button
                  onClick={() => onTrashPhoto(selectedPhoto.id)}
                  className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold shadow-sm hover:bg-rose-700 flex items-center gap-1.5 transition-all"
                  title="Move to Finder Trash (N)"
                >
                  <span>✕ Trash</span>
                  <span className="text-[10px] opacity-75 font-mono">N</span>
                </button>

                <button
                  onClick={() => onToggleFavorite(selectedPhoto.id, selectedPhoto.is_favorite)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                    selectedPhoto.is_favorite
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      : "border-[var(--glass-border)] text-[var(--text-main)] hover:bg-[var(--button-hover)]"
                  }`}
                  title={selectedPhoto.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={13} className={selectedPhoto.is_favorite ? "fill-amber-500 text-amber-500" : ""} />
                  <span>{selectedPhoto.is_favorite ? "Favorited" : "Favorite"}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Finder Multi-Column Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-[var(--glass-panel)] backdrop-blur-md border-b border-[var(--glass-border)] z-10 text-[var(--text-muted)] font-semibold">
            <tr>
              {/* Checkbox column */}
              <th className="py-2 px-3 w-8 text-center">
                <button
                  onClick={() => {
                    if (allSelected && onClearSelection) {
                      onClearSelection();
                    } else if (onSelectAll) {
                      onSelectAll();
                    }
                  }}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-blue-500 transition-colors"
                  title={allSelected ? "Deselect All" : "Select All"}
                >
                  {allSelected ? (
                    <CheckSquare size={14} className="text-blue-500" />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
              </th>
              <th className="py-2 px-2 w-10"></th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3 w-16 text-center">Favorite</th>
              <th className="py-2 px-3">Optics & Camera</th>
              <th className="py-2 px-3">Location</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Size</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3 w-24 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {photos.map((photo) => {
              const isSelected = selectedPhotoIds.has(photo.id);
              const isMultiSelected = selectedPhotoIds.has(photo.id);
              const thumbSrc = photo.thumb || `/media/${photo.id}?w=120`;
              const displayName = photo.file_name || photo.name || `Photo #${photo.id}`;

              return (
                <tr
                  key={photo.id}
                  data-photo-item="true"
                  onClick={(e) => onPhotoClick(photo, e)}
                  onDoubleClick={() => onEnlargePhoto(photo)}
                  className={`group cursor-pointer transition-colors ${
                    isMultiSelected || isSelected
                      ? "bg-blue-500/15 text-[var(--text-main)] font-medium"
                      : "hover:bg-[var(--button-hover)] text-[var(--text-secondary)]"
                  }`}
                >
                  {/* Checkbox Column */}
                  <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelectPhoto(photo.id, e);
                      }}
                      className="p-0.5 rounded text-[var(--text-muted)] hover:text-blue-500 transition-colors"
                      title={isMultiSelected ? "Deselect photo" : "Select photo (Hold Shift for range)"}
                    >
                      {isMultiSelected ? (
                        <CheckSquare size={14} className="text-blue-500" />
                      ) : (
                        <Square size={14} className="opacity-40 group-hover:opacity-100" />
                      )}
                    </button>
                  </td>

                  {/* Thumbnail */}
                  <td className="py-1.5 px-2">
                    <div className="w-9 h-8 flex items-center justify-center rounded bg-black/5 overflow-hidden">
                      <img
                        src={thumbSrc}
                        alt=""
                        className={`${
                          photo.is_portrait || (photo.width && photo.height && photo.height > photo.width)
                            ? "h-7 w-5 object-cover rounded"
                            : "w-8 h-6 object-cover rounded"
                        }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=80&auto=format&fit=crop&q=80";
                        }}
                      />
                    </div>
                  </td>

                  {/* File Name */}
                  <td className="py-1.5 px-3 font-medium text-[var(--text-main)] truncate max-w-[200px]" title={displayName}>
                    {displayName}
                  </td>

                  {/* Interactive Favorite Column */}
                  <td className="py-1.5 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(photo.id, photo.is_favorite);
                      }}
                      className={`p-1 rounded-md transition-all ${
                        photo.is_favorite
                          ? "text-amber-500 hover:scale-110"
                          : "text-[var(--text-faint)] opacity-30 group-hover:opacity-100 hover:text-amber-500"
                      }`}
                      title={photo.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Star size={13} className={photo.is_favorite ? "fill-amber-500 text-amber-500" : ""} />
                    </button>
                  </td>

                  {/* Optics */}
                  <td className="py-1.5 px-3 truncate max-w-[220px]">
                    {photo.camera_model ? (
                      <span>
                        {photo.camera_model} · {photo.f_number || (photo.aperture_f_number ? `ƒ/${photo.aperture_f_number}` : "")} · {photo.iso ? `ISO ${photo.iso}` : (photo.iso_equivalent ? `ISO ${photo.iso_equivalent}` : "")}
                      </span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </td>

                  {/* Location */}
                  <td className="py-1.5 px-3 truncate max-w-[160px]">
                    {photo.location_name ? (
                      photo.location_name
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-1.5 px-3 capitalize">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--button-bg)] border border-[var(--button-border)]">
                      {photo.category}
                    </span>
                  </td>

                  {/* Size */}
                  <td className="py-1.5 px-3 text-[var(--text-muted)] font-mono">
                    {(photo.size / (1024 * 1024)).toFixed(1)} MB
                  </td>

                  {/* Status */}
                  <td className="py-1.5 px-3">
                    {photo.is_trashed ? (
                      <span className="text-rose-500 font-semibold">In Trash</span>
                    ) : photo.is_favorite ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Favorite</span>
                    ) : (
                      <span className="text-[var(--text-faint)]">Active</span>
                    )}
                  </td>

                  {/* Action Column */}
                  <td className="py-1.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {isTrashCategory || photo.is_trashed ? (
                        onRestorePhoto && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestorePhoto(photo.id);
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm"
                            title="Put back this photo"
                          >
                            <RotateCcw size={10} />
                            <span>Put Back</span>
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEnlargePhoto(photo);
                            }}
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Enlarge (Space)"
                            aria-label="Enlarge photo"
                          >
                            <Maximize2 size={13} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrashPhoto(photo.id);
                            }}
                            className="p-1 rounded hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Move to Trash"
                            aria-label="Trash photo"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
