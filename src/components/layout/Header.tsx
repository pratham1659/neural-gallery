import React from "react";
import { ActiveView, ThemeMode, TimeScale } from "../../types/gallery";

interface HeaderProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  timeScale: TimeScale;
  onChangeTimeScale: (scale: TimeScale) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onIndexFolder: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
  onLockVault: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  timeScale,
  onChangeTimeScale,
  searchQuery,
  onSearchChange,
  onIndexFolder,
  onToggleInspector,
  isInspectorOpen,
  onLockVault,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="h-14 border-b border-[var(--glass-border)] bg-[var(--glass-panel)] backdrop-blur-xl flex items-center justify-between px-4 z-20 select-none">
      {/* Left: macOS Window Traffic Lights Placeholder & View Switcher */}
      <div className="flex items-center gap-4">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-2 pr-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]"></div>
          <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24]"></div>
          <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]"></div>
        </div>

        {/* View Switcher: Segments */}
        <div className="flex items-center bg-[var(--button-bg)] border border-[var(--button-border)] p-0.5 rounded-lg shadow-sm">
          <button
            onClick={() => onChangeView("timeline")}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              activeView === "timeline"
                ? "bg-[var(--glass-card)] text-[var(--text-main)] shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            }`}
            title="Timeline View (⌘1)"
          >
            Timeline
          </button>
          <button
            onClick={() => onChangeView("explorer")}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              activeView === "explorer"
                ? "bg-[var(--glass-card)] text-[var(--text-main)] shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            }`}
            title="Explorer & Triage View (⌘2)"
          >
            Explorer
          </button>
          <button
            onClick={() => onChangeView("places")}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              activeView === "places"
                ? "bg-[var(--glass-card)] text-[var(--text-main)] shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            }`}
            title="Places & Geography Map (⌘3)"
          >
            Places
          </button>
          <button
            onClick={() => onChangeView("people")}
            className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
              activeView === "people"
                ? "bg-[var(--glass-card)] text-[var(--text-main)] shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            }`}
            title="People & Pets (⌘4)"
          >
            People & Pets
          </button>
        </div>

        {/* Time Scale selector (Only shown in Timeline mode) */}
        {activeView === "timeline" && (
          <div className="flex items-center bg-[var(--button-bg)] border border-[var(--button-border)] p-0.5 rounded-lg shadow-sm ml-2">
            {(["years", "months", "days", "all"] as TimeScale[]).map((scale) => (
              <button
                key={scale}
                onClick={() => onChangeTimeScale(scale)}
                className={`px-2.5 py-1 rounded-md text-[11px] capitalize transition-all ${
                  timeScale === scale
                    ? "bg-[var(--accent)] text-white font-semibold shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                }`}
              >
                {scale}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Middle: Natural Language Search Input */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search with MobileCLIP (e.g. 'golden retriever playing in snow', 'tokyo night street')..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-12 py-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-card)] text-[var(--text-main)] placeholder-[var(--text-muted)] text-[12px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all"
          />
          <div className="absolute left-2.5 top-2 text-[var(--text-muted)] text-[12px]">
            🔍
          </div>
          <div className="absolute right-2.5 top-1.5 text-[10px] bg-[var(--button-bg)] border border-[var(--button-border)] text-[var(--text-muted)] px-1.5 py-0.5 rounded font-mono">
            ⌘F
          </div>
        </div>
      </div>

      {/* Right: Actions (Index Folder, Inspector, Theme, Lock) */}
      <div className="flex items-center gap-2">
        <button
          onClick={onIndexFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium shadow-sm hover:opacity-90 active:scale-95 transition-all"
          title="Index a folder on this Mac"
        >
          <span>+</span>
          <span>Index Folder</span>
        </button>

        <button
          onClick={onToggleInspector}
          className={`p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] text-[13px] hover:bg-[var(--button-hover)] transition-all ${
            isInspectorOpen ? "ring-2 ring-[var(--accent)] text-[var(--accent)]" : ""
          }`}
          title="Toggle EXIF & Optical Telemetry Inspector (⌘I)"
        >
          ℹ️
        </button>

        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] text-[13px] hover:bg-[var(--button-hover)] transition-all"
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        <button
          onClick={onLockVault}
          className="p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] text-[13px] hover:bg-[var(--button-hover)] transition-all"
          title="Instant Panic Lockdown (⌘L)"
        >
          🔒
        </button>
      </div>
    </header>
  );
};
