import React, { useState } from "react";
import { LibraryStats } from "../../types/gallery";

interface SidebarProps {
  currentCategory: string;
  onSelectCategory: (category: string) => void;
  stats: LibraryStats;
  onOpenSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onSelectCategory,
  stats,
  onOpenSync,
}) => {
  const [videosExpanded, setVideosExpanded] = useState(false);

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col justify-between border-r border-[var(--glass-border)] bg-[var(--glass-sidebar)] backdrop-blur-xl h-full select-none">
      {/* Top: Branding & Library Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-2">
          <img
            src="/icon.png"
            alt="App Icon"
            className="w-8 h-8 rounded-lg shadow-sm object-cover"
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
              <span className="text-[11px] text-[var(--text-muted)]">3</span>
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
              <span className="text-[11px] text-[var(--text-muted)]">8</span>
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
              <span className="text-[10px] text-[var(--accent)] font-semibold">Active</span>
            </button>
          </div>
        </div>

        {/* Section 3: People, Pets & Travel */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider px-2 mb-1.5">
            People, Pets & Travel
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => onSelectCategory("people")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "people"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Busts%20in%20silhouette/3D/busts_in_silhouette_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>People</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.people}</span>
            </button>

            <button
              onClick={() => onSelectCategory("pets")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "pets"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Dog%20face/3D/dog_face_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Pets</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.pets}</span>
            </button>

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
              <span className="text-[11px] text-[var(--text-muted)]">5 trips</span>
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
                    <span className="text-[10px] text-[var(--text-muted)]">3</span>
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
                    <span className="text-[10px] text-[var(--text-muted)]">2</span>
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
                    <span className="text-[10px] text-[var(--text-muted)]">4</span>
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
                    <span className="text-[10px] text-[var(--text-muted)]">3</span>
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
              <span className="text-[11px] text-[var(--text-muted)]">6</span>
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
              <span className="text-[11px] text-[var(--text-muted)]">11</span>
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
              onClick={() => onSelectCategory("inbox")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "inbox"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Inbox%20tray/3D/inbox_tray_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>To sort</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.unlabeled}</span>
            </button>

            <button
              onClick={() => onSelectCategory("hidden")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                currentCategory === "hidden"
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <img
                  src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Locked%20with%20key/3D/locked_with_key_3d.png"
                  alt=""
                  className="w-4 h-4 object-contain"
                />
                <span>Hidden Vault</span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">{stats.hidden}</span>
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
              <span className="text-[11px] text-[var(--text-muted)]">12</span>
            </button>
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
