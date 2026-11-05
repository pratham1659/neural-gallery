import React, { useState } from "react";
import { Folder, FolderPlus, Trash2 } from "lucide-react";
import { ActiveView, FolderItem, LibraryStats } from "../../types/gallery";

interface SidebarProps {
  currentCategory: string;
  onSelectCategory: (category: string) => void;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  stats: LibraryStats;
  onOpenSync: () => void;
  folders?: FolderItem[];
  onCreateFolder?: (name: string, storageMode?: "virtual" | "physical") => Promise<void>;
  onDeleteFolder?: (folder: FolderItem) => void;
  onDropOnFolder?: (folderId: number, photoIds: number[]) => Promise<void>;
  onDropOnCategory?: (category: string, photoIds: number[]) => Promise<void>;
  isHiddenVaultUnlocked?: boolean;
  onUnlockHiddenVault?: () => void;
  onLockHiddenVault?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onSelectCategory,
  activeView,
  onChangeView,
  stats,
  onOpenSync,
  folders = [],
  onCreateFolder,
  onDeleteFolder,
  onDropOnFolder,
  onDropOnCategory,
  isHiddenVaultUnlocked = false,
  onUnlockHiddenVault,
  onLockHiddenVault,
}) => {
  const [videosExpanded, setVideosExpanded] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [storageMode, setStorageMode] = useState<"virtual" | "physical">("virtual");
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const regularFolders = folders.filter((f) => !f.is_hidden);
  const hiddenFolders = folders.filter((f) => !!f.is_hidden);

  const handleCreateFolderSubmit = async () => {
    if (!newFolderName.trim() || !onCreateFolder) return;
    try {
      await onCreateFolder(newFolderName.trim(), storageMode);
      setNewFolderName("");
      setStorageMode("virtual");
      setIsCreatingFolder(false);
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const handleDropOnItem = async (
    targetKey: string,
    e: React.DragEvent,
    folderId?: number
  ) => {
    e.preventDefault();
    setDropTarget(null);
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      const parsed = JSON.parse(data);
      const photoIds = parsed.ids as number[];
      if (!photoIds || photoIds.length === 0) return;

      if (folderId != null && onDropOnFolder) {
        await onDropOnFolder(folderId, photoIds);
      } else if (onDropOnCategory) {
        await onDropOnCategory(targetKey, photoIds);
      }
    } catch (err) {
      console.warn("Could not handle drop on item:", err);
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col justify-between border-r border-[var(--glass-border)] bg-[var(--glass-sidebar)] backdrop-blur-xl h-full select-none">
      {/* Top: Branding & Library Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-2">
          <img
            src="/icon.png"
            alt="App Icon"
            className="w-8 h-8 object-contain drop-shadow-sm select-none transition-transform hover:scale-105 active:scale-95"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Framed%20picture/3D/framed_picture_3d.png";
            }}
          />
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
              Neural Gallery
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">Encrypted AI Vault</p>
          </div>
        </div>

        {/* Section 0: Views Catalog */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
            <span>Catalog Views</span>
          </div>
          <div className="space-y-0.5">
            {/* Timeline View */}
            <button
              onClick={() => {
                onSelectCategory("all");
                onChangeView("timeline");
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                activeView === "timeline"
                  ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title="Timeline Gallery Grid"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Framed%20picture/3D/framed_picture_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Timeline</span>
              </div>
              <span
                className={`text-[11px] font-mono ${
                  activeView === "timeline"
                    ? "text-white/80"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {stats.total}
              </span>
            </button>

            {/* Explorer View */}
            <button
              onClick={() => onChangeView("explorer")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                activeView === "explorer"
                  ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title="Explorer & Triage Table"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Card%20file%20box/3D/card_file_box_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Explorer</span>
              </div>
              <span
                className={`text-[11px] font-mono ${
                  activeView === "explorer" ? "text-white/80" : "text-[var(--text-muted)]"
                }`}
              >
                {stats.total}
              </span>
            </button>

            {/* Places View */}
            <button
              onClick={() => onChangeView("places")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                activeView === "places"
                  ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title="Places & Geography Map"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/World%20map/3D/world_map_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Places</span>
              </div>
              <span
                className={`text-[11px] font-mono ${
                  activeView === "places" ? "text-white/80" : "text-[var(--text-muted)]"
                }`}
              >
                {stats.geocoded}
              </span>
            </button>

            {/* People View */}
            <button
              onClick={() => onChangeView("people")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                activeView === "people"
                  ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title="People Recognition"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Busts%20in%20silhouette/3D/busts_in_silhouette_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>People</span>
              </div>
              <span
                className={`text-[11px] font-mono ${
                  activeView === "people" ? "text-white/80" : "text-[var(--text-muted)]"
                }`}
              >
                {stats.people}
              </span>
            </button>

            {/* Pets View */}
            <button
              onClick={() => onChangeView("pets")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                activeView === "pets"
                  ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title="Pets Detection"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Dog%20face/3D/dog_face_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Pets</span>
              </div>
              <span
                className={`text-[11px] font-mono ${
                  activeView === "pets" ? "text-white/80" : "text-[var(--text-muted)]"
                }`}
              >
                {stats.pets}
              </span>
            </button>
          </div>
        </div>

        {/* Section 1: Library */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5">
            Library
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectCategory("all")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "all"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Framed%20picture/3D/framed_picture_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>All Photos</span>
              </div>
              <span className={`text-[11px] ${currentCategory === "all" ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                {stats.total}
              </span>
            </button>

            <button
              onClick={() => onSelectCategory("favorites")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "favorites"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Star/3D/star_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Favorites</span>
              </div>
              <span className={`text-[11px] ${currentCategory === "favorites" ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                {stats.favorites}
              </span>
            </button>

            <button
              onClick={() => onSelectCategory("recents")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "recents"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Stopwatch/3D/stopwatch_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Recents</span>
              </div>
              <span className={`text-[11px] ${currentCategory === "recents" ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                {Math.min(stats.total, 50)}
              </span>
            </button>
          </div>
        </div>

        {/* Section 1.5: Separate Folders (Keep photos unmixed) */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
            <span>Folders</span>
            {onCreateFolder && (
              <button
                onClick={() => setIsCreatingFolder((prev) => !prev)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--button-hover)] transition-all"
                title="Create Folder (Keep photos unmixed)"
              >
                <FolderPlus size={13} />
              </button>
            )}
          </div>

          {/* Inline Folder Creation Form */}
          {isCreatingFolder && (
            <div className="p-2.5 mb-2 rounded-xl bg-[var(--surface-hover)] border border-[var(--glass-border)] shadow-sm space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="Folder name (e.g. Vacation 2026)"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolderSubmit();
                  if (e.key === "Escape") {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                    setStorageMode("virtual");
                  }
                }}
                className="w-full px-2 py-1 rounded-md text-xs bg-[var(--button-bg)] border border-[var(--button-border)] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />

              {/* Storage Mode Choice */}
              <div className="space-y-1 pt-1 border-t border-[var(--glass-border)]/60">
                <div className="text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Organization Type
                </div>

                <label className="flex items-start gap-1.5 p-1 rounded-md hover:bg-[var(--button-hover)] cursor-pointer select-none">
                  <input
                    type="radio"
                    name="folder-mode"
                    checked={storageMode === "virtual"}
                    onChange={() => setStorageMode("virtual")}
                    className="mt-0.5 accent-blue-600 cursor-pointer"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-medium text-[var(--text-main)] block">See all category photos</span>
                    <span className="text-[9.5px] text-[var(--text-muted)] block">Keeps photos in original categories and references them here.</span>
                  </div>
                </label>

                <label className="flex items-start gap-1.5 p-1 rounded-md hover:bg-[var(--button-hover)] cursor-pointer select-none">
                  <input
                    type="radio"
                    name="folder-mode"
                    checked={storageMode === "physical"}
                    onChange={() => setStorageMode("physical")}
                    className="mt-0.5 accent-blue-600 cursor-pointer"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-medium text-[var(--text-main)] block">Store photos separately</span>
                    <span className="text-[9.5px] text-[var(--text-muted)] block">Creates a dedicated folder on disk to store files separately.</span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                <button
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName("");
                    setStorageMode("virtual");
                  }}
                  className="px-2 py-0.5 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolderSubmit}
                  className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[var(--accent)] text-white shadow-sm"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* Folder items list */}
          <div className="space-y-0.5">
            {regularFolders.map((folder) => {
              const isCurrent = currentCategory === `folder:${folder.id}`;
              const isDropTarget = dropTarget === `folder:${folder.id}`;

              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(`folder:${folder.id}`);
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDropOnItem(`folder:${folder.id}`, e, folder.id)}
                  onClick={() => onSelectCategory(`folder:${folder.id}`)}
                  className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                    isDropTarget
                      ? "ring-2 ring-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold"
                      : isCurrent
                      ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                      : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
                  }`}
                  title={`Folder: ${folder.name} (${folder.count} photos)`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder size={14} className={isCurrent ? "text-white" : "text-amber-500"} />
                    <span className="truncate">{folder.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span
                      className={`text-[11px] font-mono ${
                        isCurrent ? "text-white/80" : "text-[var(--text-muted)]"
                      }`}
                    >
                      {folder.count}
                    </span>
                    {onDeleteFolder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteFolder(folder);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-rose-500 transition-opacity"
                        title={`Delete folder "${folder.name}"`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {regularFolders.length === 0 && !isCreatingFolder && (
              <div
                onClick={() => setIsCreatingFolder(true)}
                className="px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--glass-border)] text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--accent)] transition-all cursor-pointer flex items-center gap-1.5"
                title="Create a folder to keep someone's photos separate"
              >
                <FolderPlus size={13} />
                <span>+ New Folder</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Sharing */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5">
            Sharing
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectCategory("shared_albums")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "shared_albums"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Open%20file%20folder/3D/open_file_folder_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Shared Albums</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                {stats.shared_albums ?? folders.length}
              </span>
            </button>

            <button
              onClick={() => onSelectCategory("shared_with_you")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "shared_with_you"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Incoming%20envelope/3D/incoming_envelope_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Shared with You</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                {stats.shared_with_you ?? 0}
              </span>
            </button>

            <button
              onClick={() => onSelectCategory("partner_sharing")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "partner_sharing"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Handshake/3D/handshake_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Partner Sharing</span>
              </div>
              <span className={`text-[10px] font-semibold ${stats.partner_sharing && stats.partner_sharing > 0 ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                {stats.partner_sharing && stats.partner_sharing > 0 ? "Active" : "Off"}
              </span>
            </button>
          </div>
        </div>

        {/* Section 3: Trips & Travel */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5">
            Trips & Travel
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectCategory("travel")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "travel"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Airplane/3D/airplane_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Travel</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                {stats.travel ? `${stats.travel} ${stats.travel === 1 ? "trip" : "trips"}` : "0 trips"}
              </span>
            </button>
          </div>
        </div>

        {/* Section 4: Media Types */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5">
            Media Types
          </div>
          <div className="space-y-0.5">
            {/* Videos with collapsible toggle */}
            <div>
              <div
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all ${
                  currentCategory === "videos"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
                }`}
                onClick={() => onSelectCategory("videos")}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Film%20projector/3D/film_projector_3d.png"
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                  <span>Videos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] ${currentCategory === "videos" ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                    {stats.videos}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideosExpanded(!videosExpanded);
                    }}
                    className="p-0.5 rounded hover:bg-black/10 text-[10px]"
                  >
                    {videosExpanded ? "▼" : "▶"}
                  </button>
                </div>
              </div>

              {/* Collapsible video sub-categories */}
              {videosExpanded && (
                <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-[var(--glass-border)] ml-4 mt-1">
                  <button
                    onClick={() => onSelectCategory("prores")}
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-[12px] text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Movie%20camera/3D/movie_camera_3d.png"
                        alt=""
                        className="w-3.5 h-3.5"
                      />
                      <span>ProRes 4K</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{stats.prores ?? 0}</span>
                  </button>
                  <button
                    onClick={() => onSelectCategory("slomo")}
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-[12px] text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Snail/3D/snail_3d.png"
                        alt=""
                        className="w-3.5 h-3.5"
                      />
                      <span>Slo-mo 240fps</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{stats.slomo ?? 0}</span>
                  </button>
                  <button
                    onClick={() => onSelectCategory("timelapse")}
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-[12px] text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Hourglass%20done/3D/hourglass_done_3d.png"
                        alt=""
                        className="w-3.5 h-3.5"
                      />
                      <span>Time-lapse</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{stats.timelapse ?? 0}</span>
                  </button>
                  <button
                    onClick={() => onSelectCategory("screen_recordings")}
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-[12px] text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Television/3D/television_3d.png"
                        alt=""
                        className="w-3.5 h-3.5"
                      />
                      <span>Screen Rec</span>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)]">{stats.screen_recordings ?? 0}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => onSelectCategory("screenshots")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "screenshots"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Mobile%20phone/3D/mobile_phone_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Screenshots</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.screenshots}</span>
            </button>

            <button
              onClick={() => onSelectCategory("portraits")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "portraits"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Sparkles/3D/sparkles_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Portraits (Depth)</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.portraits}</span>
            </button>

            <button
              onClick={() => onSelectCategory("live_photos")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "live_photos"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Dizzy/3D/dizzy_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Live Photos</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.live_photos}</span>
            </button>

            <button
              onClick={() => onSelectCategory("raw")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "raw"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Gem%20stone/3D/gem_stone_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Apple ProRAW</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.raw}</span>
            </button>

            <button
              onClick={() => onSelectCategory("panoramas")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "panoramas"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Sunrise/3D/sunrise_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Panoramas</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.panoramas ?? 0}</span>
            </button>

            <button
              onClick={() => onSelectCategory("documents")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "documents"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Page%20facing%20up/3D/page_facing_up_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Receipts & Docs (OCR)</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.documents ?? 0}</span>
            </button>
          </div>
        </div>

        {/* Section 5: Utilities */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5">
            Utilities
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectCategory("duplicates")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "duplicates"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Recycling%20symbol/3D/recycling_symbol_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Duplicates</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                {stats.duplicate_groups}
              </span>
            </button>

            <button
              onClick={() => onSelectCategory("imports")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "imports"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Card%20index%20dividers/3D/card_index_dividers_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Imports</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(stats.imports ?? 0) > 0 ? (
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold">
                    {stats.imports}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">0</span>
                )}
              </div>
            </button>

            <button
              onClick={() => onSelectCategory("noise")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "noise"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title="Photos with high noise or blur detected"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Dotted%20line%20face/3D/dotted_line_face_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Noise & Blur</span>
              </div>
              <div className="flex items-center gap-1.5">
                {(stats.noise ?? 0) > 0 ? (
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold">
                    {stats.noise}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">0</span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Section 6: Security & Privacy (Hidden Vault) */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
            <span>Security & Privacy</span>
            {isHiddenVaultUnlocked && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                Unlocked
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            <div>
              <div
                onClick={() => onSelectCategory("hidden")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                  currentCategory === "hidden"
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={
                      isHiddenVaultUnlocked
                        ? "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Unlocked/3D/unlocked_3d.png"
                        : "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Locked%20with%20key/3D/locked_with_key_3d.png"
                    }
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                  <span>Hidden Vault</span>
                </div>
                {/* Zero-knowledge: No count or number shown for Hidden Vault */}
                <div className="flex items-center gap-1.5">
                  {isHiddenVaultUnlocked && onLockHiddenVault && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLockHiddenVault();
                      }}
                      className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[11px] transition-all"
                      title="Lock Hidden Vault"
                    >
                      🔒 Lock
                    </button>
                  )}
                </div>
              </div>

              {/* Nested Private Folders when Hidden Vault is unlocked */}
              {isHiddenVaultUnlocked && hiddenFolders.length > 0 && (
                <div className="pl-6 pr-1 py-1 space-y-0.5 border-l-2 border-indigo-500/30 ml-4 mt-1">
                  {hiddenFolders.map((hf) => {
                    const isSelected = currentCategory === `folder:${hf.id}`;
                    return (
                      <div
                        key={hf.id}
                        onClick={() => onSelectCategory(`folder:${hf.id}`)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-[12px] transition-all cursor-pointer ${
                          isSelected
                            ? "bg-indigo-600 text-white font-medium"
                            : "text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder size={12} className={isSelected ? "text-white" : "text-indigo-400"} />
                          <span className="truncate">{hf.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Wi-Fi Sync (Positioned Above Trash as requested) & Trash */}
      <div className="p-3 border-t border-[var(--glass-border)] bg-[var(--glass-card)]/50 space-y-1">
        {/* P2P Wi-Fi Sync Drawer Item */}
        <button
          onClick={onOpenSync}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/80 text-[var(--accent)] transition-all cursor-pointer border border-[var(--accent)]/20"
        >
          <div className="flex items-center gap-2.5">
            <img
              src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Antenna%20bars/3D/antenna_bars_3d.png"
              alt="Wi-Fi"
              className="w-4 h-4 object-contain"
            />
            <div className="text-left">
              <div className="text-[12px] font-semibold tracking-tight">P2P Wi-Fi Sync</div>
              <div className="text-[10px] text-[var(--text-muted)] opacity-90">Local Mesh Active</div>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </button>

        {/* Trash */}
        <button
          onClick={() => onSelectCategory("trash")}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
            currentCategory === "trash"
              ? "bg-[var(--accent)] text-white shadow-sm"
              : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <img
              src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Wastebasket/3D/wastebasket_3d.png"
              alt=""
              className="w-4 h-4 object-contain"
            />
            <span>Trash</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{stats.trashed}</span>
        </button>
      </div>
    </aside>
  );
};
