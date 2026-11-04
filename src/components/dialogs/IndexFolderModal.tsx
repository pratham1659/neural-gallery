import React, { useEffect, useState } from "react";
import { FolderPreset, ScanSummary } from "../../types/gallery";
import { api } from "../../services/api";

interface IndexFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIndexComplete: () => void;
}

export const IndexFolderModal: React.FC<IndexFolderModalProps> = ({
  isOpen,
  onClose,
  onIndexComplete,
}) => {
  const [presets, setPresets] = useState<FolderPreset[]>([]);
  const [customPath, setCustomPath] = useState<string>("");
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [result, setResult] = useState<ScanSummary | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorText(null);
      setResult(null);
      setIsIndexing(false);
      setStatusText("");
      api
        .getFolderPresets()
        .then((items) => setPresets(items.filter((p) => p.exists)))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runIndex = async (folderPath: string) => {
    if (!folderPath.trim()) return;
    setIsIndexing(true);
    setErrorText(null);
    setResult(null);
    setStatusText(`Scanning "${folderPath}"...`);

    try {
      const summary = await api.indexFolder(folderPath);
      setResult(summary);
      setIsIndexing(false);
      onIndexComplete();
    } catch (err: any) {
      setIsIndexing(false);
      setErrorText(err.message || "Failed to index folder. Please check permissions.");
    }
  };

  const handleBrowseNative = async () => {
    try {
      setStatusText("Waiting for folder selection in macOS Finder...");
      const selected = await api.chooseFolder();
      if (selected) {
        setCustomPath(selected);
        runIndex(selected);
      } else {
        setStatusText("");
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to open folder chooser.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-6 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isIndexing}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--button-hover)] transition-colors disabled:opacity-40"
          title="Close"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl">
            📁
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-main)]">
              Index Photos &amp; Videos
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Select any local folder or external drive to index with zero cloud telemetry.
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto space-y-5 pr-1 text-xs">
          {/* Active Indexing Overlay */}
          {isIndexing && (
            <div className="p-6 rounded-xl bg-[var(--glass-sidebar)] border border-blue-500/30 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="font-semibold text-sm text-[var(--text-main)]">
                Indexing Media Library
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                {statusText || "Extracting EXIF optics, GPS geography, and perceptual dHash clustering..."}
              </p>
              <div className="text-[11px] text-blue-500 font-mono">
                Safe &amp; Non-Destructive · Files are not moved
              </div>
            </div>
          )}

          {/* Success Result View */}
          {result && !isIndexing && (
            <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <span>✓</span>
                <span>Indexing Complete!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--glass-border)]">
                  <div className="text-lg font-bold text-[var(--text-main)]">{result.seen}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Total Files
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--glass-border)]">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {result.added}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    New Photos
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--glass-border)]">
                  <div className="text-lg font-bold text-amber-500">
                    {result.duplicate_groups}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                    Dup Groups
                  </div>
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-all"
                >
                  View Library
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorText && !isIndexing && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
              <strong>Error:</strong> {errorText}
            </div>
          )}

          {!isIndexing && !result && (
            <>
              {/* Option 1: Native macOS Finder Folder Picker Button */}
              <div className="p-4 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-sm text-[var(--text-main)] mb-0.5">
                    Choose Folder in macOS Finder
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Opens the native Mac folder selector to choose any folder or external SSD.
                  </div>
                </div>
                <button
                  onClick={handleBrowseNative}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold shadow hover:opacity-95 active:scale-95 transition-all shrink-0 flex items-center gap-2"
                >
                  <span>📂</span>
                  <span>Browse on Mac...</span>
                </button>
              </div>

              {/* Option 2: Quick Presets Grid */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Or One-Click Common Folders
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.path}
                      onClick={() => runIndex(preset.path)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[var(--glass-sidebar)] border border-[var(--glass-border)] text-left hover:border-[var(--accent)]/50 hover:bg-[var(--accent-soft)] transition-all group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">
                        {preset.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[var(--text-main)] truncate">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate font-mono">
                          {preset.path}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option 3: Manual Path Input */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                  Custom Directory Path
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runIndex(customPath);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="e.g. /Volumes/ExternalSSD/Photos or ~/Pictures"
                    className="flex-1 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--glass-border)] text-xs text-[var(--text-main)] placeholder-[var(--text-faint)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    disabled={!customPath.trim()}
                    className="px-3.5 py-2 rounded-xl bg-[var(--button-bg)] border border-[var(--button-border)] text-xs font-medium text-[var(--text-main)] hover:bg-[var(--button-hover)] disabled:opacity-40 transition-all shrink-0"
                  >
                    Index
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
