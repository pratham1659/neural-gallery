import React from "react";
import {
  Maximize2,
  Trash2,
  RotateCcw,
  X,
  CheckSquare,
  List,
  LayoutGrid,
  Grid2X2,
  Square,
  ArrowUpDown,
  Menu,
  Lock,
  Eye,
} from "lucide-react";
import { Info3DIcon } from "../common/Info3DIcon";
import { ActiveView, CatalogStyle, ThemeMode, TimeScale } from "../../types/gallery";

interface HeaderProps {
  activeView: ActiveView;
  onChangeView?: (view: ActiveView) => void;
  onToggleSidebar?: () => void;
  timeScale: TimeScale;
  onChangeTimeScale: (scale: TimeScale) => void;
  catalogStyle: CatalogStyle;
  onChangeCatalogStyle: (style: CatalogStyle) => void;
  sortOrder?: string;
  onChangeSortOrder?: (sort: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onIndexFolder: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
  onLockVault: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  hasSelectedPhoto?: boolean;
  selectedCount?: number;
  totalCount?: number;
  hasSelectedFavorites?: boolean;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onDeleteSelected?: () => void;
  onFavoriteSelected?: () => void;
  onRemoveFavoriteSelected?: () => void;
  onRestoreSelected?: () => void;
  onHideSelected?: () => void;
  onUnhideSelected?: () => void;
  isTrashCategory?: boolean;
  isHiddenCategory?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onChangeView,
  onToggleSidebar,
  timeScale,
  onChangeTimeScale,
  catalogStyle,
  onChangeCatalogStyle,
  sortOrder = "date_desc",
  onChangeSortOrder,
  searchQuery,
  onSearchChange,
  onIndexFolder,
  onToggleInspector,
  isInspectorOpen,
  onLockVault,
  theme,
  onToggleTheme,
  hasSelectedPhoto,
  selectedCount = 0,
  totalCount = 0,
  hasSelectedFavorites = false,
  onClearSelection,
  onSelectAll,
  onDeleteSelected,
  onFavoriteSelected,
  onRemoveFavoriteSelected,
  onRestoreSelected,
  onHideSelected,
  onUnhideSelected,
  isTrashCategory = false,
  isHiddenCategory = false,
}) => {
  return (
    <header className="h-14 border-b border-[var(--glass-border)] bg-[var(--glass-panel)] backdrop-blur-xl flex items-center justify-between px-2.5 sm:px-4 z-20 select-none gap-2 min-w-0 w-full overflow-hidden">
      {/* Left: Sidebar Toggle (Mobile) + Traffic Lights + Search Bar + Optional View Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink min-w-0">
        {/* Mobile/Tablet Sidebar Toggle Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] hover:bg-[var(--button-hover)] md:hidden shrink-0 transition-colors"
            title="Toggle Sidebar Navigation"
            aria-label="Toggle Navigation"
          >
            <Menu size={16} />
          </button>
        )}

        {/* macOS Traffic Lights */}
        <div className="hidden sm:flex items-center gap-1.5 pr-0.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]" />
        </div>

        <div className="hidden sm:block h-4 w-[1px] bg-[var(--glass-border)] shrink-0 mx-0.5" />

        {/* Responsive Search Bar */}
        <div className="relative w-28 sm:w-36 md:w-44 lg:w-52 shrink min-w-[90px] transition-all">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-6 sm:pl-7 pr-6 py-1 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-card)] text-[var(--text-main)] placeholder-[var(--text-muted)] text-[11px] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-glow)] transition-all shadow-sm"
          />
          <div className="absolute left-2 top-1.5 text-[var(--text-muted)] text-[10px] sm:text-[11px]">
            🔍
          </div>

          {/* Compact Clear Filter or ⌘F */}
          {searchQuery ? (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 top-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 rounded transition-colors"
              title="Clear search filter"
            >
              <X size={12} />
            </button>
          ) : (
            <div className="hidden lg:block absolute right-1.5 top-1 text-[9px] bg-[var(--button-bg)] border border-[var(--button-border)] text-[var(--text-muted)] px-1 py-0.5 rounded font-mono">
              ⌘F
            </div>
          )}
        </div>

        {/* Time Scale selector (Years, Months, Days) - hides when selection bar is active on smaller screens */}
        {activeView === "timeline" && (
          <div
            className={`items-center bg-[var(--button-bg)] border border-[var(--button-border)] p-0.5 rounded-lg shadow-sm shrink-0 ${
              selectedCount > 0 ? "hidden xl:flex" : "hidden md:flex"
            }`}
          >
            {(["years", "months", "days"] as TimeScale[]).map((scale) => (
              <button
                key={scale}
                onClick={() => onChangeTimeScale(scale)}
                className={`px-2 lg:px-2.5 py-0.5 rounded-md text-[10px] capitalize transition-all ${
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

        {/* Finder Catalog Style (List | Small | Medium | Large) */}
        {(activeView === "timeline" || activeView === "explorer") && (
          <div
            className={`items-center bg-[var(--button-bg)] border border-[var(--button-border)] p-0.5 rounded-lg shadow-sm shrink-0 ${
              selectedCount > 0 ? "hidden 2xl:flex" : "hidden sm:flex"
            }`}
          >
            <button
              onClick={() => onChangeCatalogStyle("list")}
              className={`flex items-center gap-1 px-1.5 lg:px-2 py-0.5 rounded-md text-[10px] transition-all ${
                catalogStyle === "list"
                  ? "bg-[var(--accent)] text-white font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              }`}
              title="Finder List View"
            >
              <List size={12} />
              <span className="hidden xl:inline">List</span>
            </button>
            <button
              onClick={() => onChangeCatalogStyle("small")}
              className={`flex items-center gap-1 px-1.5 lg:px-2 py-0.5 rounded-md text-[10px] transition-all ${
                catalogStyle === "small"
                  ? "bg-[var(--accent)] text-white font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              }`}
              title="Small Grid"
            >
              <LayoutGrid size={11} />
              <span className="hidden xl:inline">Small</span>
            </button>
            <button
              onClick={() => onChangeCatalogStyle("medium")}
              className={`flex items-center gap-1 px-1.5 lg:px-2 py-0.5 rounded-md text-[10px] transition-all ${
                catalogStyle === "medium"
                  ? "bg-[var(--accent)] text-white font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              }`}
              title="Medium Grid"
            >
              <Grid2X2 size={12} />
              <span className="hidden xl:inline">Medium</span>
            </button>
            <button
              onClick={() => onChangeCatalogStyle("large")}
              className={`flex items-center gap-1 px-1.5 lg:px-2 py-0.5 rounded-md text-[10px] transition-all ${
                catalogStyle === "large"
                  ? "bg-[var(--accent)] text-white font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
              }`}
              title="Large Cards"
            >
              <Square size={12} />
              <span className="hidden xl:inline">Large</span>
            </button>
          </div>
        )}

        {/* Sort to Category Button */}
        {onChangeSortOrder && (
          <div
            className={`items-center bg-[var(--button-bg)] border border-[var(--button-border)] p-0.5 rounded-lg shadow-sm shrink-0 ${
              selectedCount > 0 ? "hidden 2xl:flex" : "hidden md:flex"
            }`}
          >
            <button
              onClick={() => onChangeSortOrder(sortOrder === "category" ? "date_desc" : "category")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                sortOrder === "category"
                  ? "bg-purple-600 text-white font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)]"
              }`}
              title={
                sortOrder === "category"
                  ? "Active: Grouped by Category (Click to sort by date)"
                  : "Sort to Category"
              }
              aria-label="Sort to Category"
              data-placeholder="Sort to Category"
            >
              <ArrowUpDown
                size={12}
                className={sortOrder === "category" ? "text-white" : "text-purple-500"}
              />
              <span className="whitespace-nowrap font-medium">Sort to Category</span>
              {sortOrder === "category" && (
                <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5 animate-pulse" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Middle: Selection Status & Actions (Responsive & Fits Gracefully) */}
      {selectedCount > 0 ? (
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-medium animate-fadeIn shrink min-w-0">
          <div className="flex items-center gap-1 font-semibold shrink-0">
            <CheckSquare size={13} className="text-blue-500 shrink-0" />
            <span className="whitespace-nowrap font-bold text-[11px] sm:text-xs">
              {selectedCount} <span className="hidden sm:inline">Selected</span>
            </span>
          </div>

          <div className="h-3.5 w-[1px] bg-blue-500/25 shrink-0 hidden sm:block" />

          {/* Select All */}
          {onSelectAll && totalCount > selectedCount && (
            <button
              onClick={onSelectAll}
              className="hidden sm:inline-block px-1.5 py-0.5 rounded hover:bg-blue-500/15 text-[11px] font-semibold transition-all shrink-0 whitespace-nowrap"
              title="Select all photos in current view"
            >
              All
            </button>
          )}

          {/* Delete or Put Back Action */}
          {isTrashCategory && onRestoreSelected ? (
            <button
              onClick={onRestoreSelected}
              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all shrink-0 whitespace-nowrap"
              title="Put back selected photos where they were deleted"
            >
              <RotateCcw size={11} />
              <span>Put Back</span>
            </button>
          ) : onDeleteSelected ? (
            <button
              onClick={onDeleteSelected}
              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all shrink-0 whitespace-nowrap"
              title="Move selected photos to Trash"
            >
              <Trash2 size={11} />
              <span className="hidden sm:inline">Delete</span>
            </button>
          ) : null}

          {/* Hide in Vault / Unhide from Vault Action */}
          {isHiddenCategory && onUnhideSelected ? (
            <button
              onClick={onUnhideSelected}
              className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all shrink-0 whitespace-nowrap"
              title="Unhide selected photos back to main library"
            >
              <Eye size={11} />
              <span>Unhide</span>
            </button>
          ) : onHideSelected && !isTrashCategory ? (
            <button
              onClick={onHideSelected}
              className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold flex items-center gap-1 shadow-sm transition-all shrink-0 whitespace-nowrap"
              title="Hide selected photos in the secure Hidden Vault"
            >
              <Lock size={11} />
              <span className="hidden sm:inline">Hide in Vault</span>
            </button>
          ) : null}

          {/* Clear Selection */}
          {onClearSelection && (
            <button
              onClick={onClearSelection}
              className="px-1.5 py-0.5 rounded hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 text-[11px] font-semibold flex items-center gap-0.5 transition-all shrink-0 whitespace-nowrap"
              title="Deselect all photos"
            >
              <X size={12} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-[4px]" />
      )}

      {/* Right: Actions (Import, Inspector 3D, Theme, Panic Lock) - Always visible, never clipped */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 shrink-0 ml-auto">
        <button
          onClick={onIndexFolder}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[11px] sm:text-[12px] font-medium shadow-sm hover:opacity-90 active:scale-95 transition-all shrink-0"
          title="Import photos or index a folder on this Mac"
        >
          <span className="font-bold">+</span>
          <span className="hidden xs:inline sm:inline">Import</span>
        </button>

        <button
          onClick={onToggleInspector}
          className={`p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] hover:bg-[var(--button-hover)] transition-all flex items-center justify-center hover:scale-105 active:scale-95 shrink-0 ${
            isInspectorOpen ? "ring-2 ring-[var(--accent)] bg-blue-500/10 shadow-sm" : ""
          }`}
          title="Toggle Photo Information (⌘I)"
          aria-label="Toggle Photo Information"
        >
          <Info3DIcon size={18} />
        </button>

        <button
          onClick={onToggleTheme}
          className="p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] text-[12px] sm:text-[13px] hover:bg-[var(--button-hover)] transition-all shrink-0"
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>

        <button
          onClick={onLockVault}
          className="p-1.5 rounded-lg border border-[var(--button-border)] bg-[var(--button-bg)] text-[var(--text-main)] text-[12px] sm:text-[13px] hover:bg-[var(--button-hover)] transition-all shrink-0"
          title="Instant Panic Lockdown (⌘L)"
        >
          🔒
        </button>
      </div>
    </header>
  );
};
