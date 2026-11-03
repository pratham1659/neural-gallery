import React from "react";
import { PhotoItem } from "../../types/gallery";

interface ExplorerViewProps {
  photos: PhotoItem[];
  selectedPhoto: PhotoItem | null;
  onSelectPhoto: (photo: PhotoItem) => void;
  onKeepPhoto: (id: number) => void;
  onTrashPhoto: (id: number) => void;
  onToggleFavorite: (id: number, current: boolean) => void;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  photos,
  selectedPhoto,
  onSelectPhoto,
  onKeepPhoto,
  onTrashPhoto,
  onToggleFavorite,
}) => {
  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-3xl mb-4">
          🗂️
        </div>
        <h3 className="text-base font-semibold text-[var(--text-main)] mb-1">Explorer is Empty</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm">
          No photos match the selected filter or category.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Rapid Triage Action Header */}
      {selectedPhoto && (
        <div className="px-4 py-2 border-b border-[var(--glass-border)] bg-[var(--glass-card)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--text-main)]">
              Triage Mode:
            </span>
            <span className="text-xs text-[var(--text-muted)] truncate max-w-xs">
              {selectedPhoto.file_name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onKeepPhoto(selectedPhoto.id)}
              className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 flex items-center gap-1.5 transition-all"
              title="Keep photo (K)"
            >
              <span>✓ Keep</span>
              <span className="text-[10px] opacity-75 font-mono">K</span>
            </button>

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
            >
              <span>★ {selectedPhoto.is_favorite ? "Favorited" : "Favorite"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Finder Multi-Column Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-[var(--glass-panel)] backdrop-blur-md border-b border-[var(--glass-border)] z-10 text-[var(--text-muted)] font-semibold">
            <tr>
              <th className="py-2 px-3 w-10"></th>
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Optics & Camera</th>
              <th className="py-2 px-3">Location</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Size</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {photos.map((photo) => {
              const isSelected = selectedPhoto?.id === photo.id;
              const thumbSrc = photo.thumb || `/media/${photo.id}?w=120`;

              return (
                <tr
                  key={photo.id}
                  onClick={() => onSelectPhoto(photo)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[var(--accent-soft)] text-[var(--text-main)] font-medium"
                      : "hover:bg-[var(--button-hover)] text-[var(--text-secondary)]"
                  }`}
                >
                  <td className="py-1.5 px-3">
                    <img
                      src={thumbSrc}
                      alt=""
                      className="w-7 h-7 rounded object-cover bg-black/5"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=80&auto=format&fit=crop&q=80";
                      }}
                    />
                  </td>
                  <td className="py-1.5 px-3 font-medium text-[var(--text-main)] truncate max-w-[200px]">
                    {photo.file_name}
                  </td>
                  <td className="py-1.5 px-3 truncate max-w-[220px]">
                    {photo.camera_model ? (
                      <span>
                        {photo.camera_model} · {photo.aperture_f_number ? `ƒ/${photo.aperture_f_number}` : ""} · ISO {photo.iso_equivalent || ""}
                      </span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 truncate max-w-[160px]">
                    {photo.location_name ? (
                      photo.location_name
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 capitalize">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--button-bg)] border border-[var(--button-border)]">
                      {photo.category}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-[var(--text-muted)] font-mono">
                    {(photo.size / (1024 * 1024)).toFixed(1)} MB
                  </td>
                  <td className="py-1.5 px-3">
                    {photo.is_favorite && <span className="text-amber-500 mr-1.5">★</span>}
                    {photo.is_trashed && <span className="text-rose-500 font-semibold">Trashed</span>}
                    {!photo.is_trashed && !photo.is_favorite && <span className="text-[var(--text-faint)]">Indexed</span>}
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
