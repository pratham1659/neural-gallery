import React, { useState, useEffect } from "react";
import { Folder, FolderPlus, Trash2, Shield, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { FolderItem, PhotoItem, CatalogStyle } from "../../types/gallery";
import { authenticateWithTouchID, verifyPasscode } from "../../utils/auth";

interface HiddenVaultViewProps {
  isUnlocked: boolean;
  onUnlock: () => void;
  onLock: () => void;
  hiddenPhotos: PhotoItem[];
  hiddenFolders: FolderItem[];
  selectedFolderId?: number | null;
  onSelectFolder: (folderId: number | null) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (folder: FolderItem) => void;
  onSelectPhoto: (photo: PhotoItem, e: React.MouseEvent) => void;
  onEnlargePhoto: (photo: PhotoItem) => void;
  onUnhidePhoto: (id: number) => void;
  selectedPhotoIds: Set<number>;
  catalogStyle: CatalogStyle;
}

export const HiddenVaultView: React.FC<HiddenVaultViewProps> = ({
  isUnlocked,
  onUnlock,
  onLock,
  hiddenPhotos,
  hiddenFolders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onSelectPhoto,
  onEnlargePhoto,
  onUnhidePhoto,
  selectedPhotoIds,
  catalogStyle,
}) => {
  const [passcode, setPasscode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  const handleTouchID = async () => {
    setErrorMsg(null);
    setIsVerifying(true);
    const res = await authenticateWithTouchID();
    setIsVerifying(false);
    if (res.success) {
      setPasscode("");
      setErrorMsg(null);
      onUnlock();
    } else {
      setErrorMsg(res.error || "Touch ID verification failed.");
      triggerShake();
    }
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMsg("Please enter your passcode or use Touch ID.");
      triggerShake();
      return;
    }
    if (verifyPasscode(passcode)) {
      setPasscode("");
      setErrorMsg(null);
      onUnlock();
    } else {
      setErrorMsg("Incorrect passcode. Access denied.");
      triggerShake();
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreatingFolder(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create folder");
    }
  };

  // Auto-prompt Touch ID when entering locked hidden vault
  useEffect(() => {
    if (!isUnlocked) {
      const timer = setTimeout(() => {
        handleTouchID();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked]);

  // Filter photos if a specific private folder is selected
  const displayedPhotos = hiddenPhotos;

  // If locked, render the Apple-style Locked Vault Shield screen
  if (!isUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-black/20 via-transparent to-black/40 select-none">
        <div
          className={`w-full max-w-sm rounded-3xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-8 text-center flex flex-col items-center ${
            isShake ? "animate-shake border-rose-500/60 ring-2 ring-rose-500/20" : ""
          }`}
        >
          {/* 3D Locked Badge */}
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/10 border border-amber-500/30 flex items-center justify-center text-4xl shadow-inner ring-4 ring-amber-500/10">
              <img
                src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Locked%20with%20key/3D/locked_with_key_3d.png"
                alt="Locked"
                className="w-12 h-12 object-contain"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center shadow">
              🔒
            </span>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-[var(--text-main)] mb-1">
            Hidden Vault is Locked
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-5 max-w-xs leading-relaxed">
            This album is protected. Authenticate with macOS Touch ID or master passcode to view private photos and folders.
          </p>

          {errorMsg && (
            <div className="w-full mb-4 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium text-center animate-fadeIn">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Primary Touch ID Action */}
          <button
            type="button"
            onClick={handleTouchID}
            disabled={isVerifying}
            className="w-full mb-4 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-2.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-70"
          >
            {isVerifying ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Authenticating with Touch ID...</span>
              </>
            ) : (
              <>
                <span className="text-base">👆</span>
                <span>Unlock with macOS Touch ID</span>
              </>
            )}
          </button>

          <div className="w-full flex items-center gap-3 my-2 text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-semibold">
            <div className="h-px flex-1 bg-[var(--glass-border)]"></div>
            <span>or enter passcode</span>
            <div className="h-px flex-1 bg-[var(--glass-border)]"></div>
          </div>

          {/* Passcode fallback */}
          <form onSubmit={handlePasscodeSubmit} className="w-full mt-2 space-y-2.5">
            <input
              type="password"
              placeholder="Passcode (Default: 1234)"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--button-bg)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] text-center tracking-widest font-mono"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl border border-[var(--button-border)] bg-[var(--button-bg)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)] transition-all"
            >
              Unlock Vault
            </button>
          </form>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Full gallery + Private Folders
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--canvas-bg)]">
      {/* Top Banner with 3D Unlocked Badge & Actions */}
      <div className="px-5 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-card)]/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <img
              src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Unlocked/3D/unlocked_3d.png"
              alt="Unlocked"
              className="w-6 h-6 object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--text-main)]">Hidden Vault</h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                Unlocked (Biometric)
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {displayedPhotos.length} private {displayedPhotos.length === 1 ? "photo" : "photos"} · Protected from main library
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* New Private Folder Button */}
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="px-3 py-1.5 rounded-xl bg-[var(--button-bg)] border border-[var(--button-border)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-all shadow-sm"
            title="Create a private folder inside Hidden Vault"
          >
            <FolderPlus size={14} className="text-indigo-500" />
            <span>+ Private Folder</span>
          </button>

          {/* Quick Lock Action with 3D Lock */}
          <button
            onClick={onLock}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-95 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            title="Immediately lock the Hidden Vault"
          >
            <img
              src="https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Locked%20with%20key/3D/locked_with_key_3d.png"
              alt=""
              className="w-4 h-4 object-contain brightness-125"
            />
            <span>Lock Vault</span>
          </button>
        </div>
      </div>

      {/* Private Folders Bar (Inside Hidden Vault) */}
      <div className="px-5 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-sidebar)]/50 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
        <span className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Folder size={12} />
          <span>Private Folders:</span>
        </span>

        {/* All Hidden Photos Tab */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`px-3 py-1 rounded-lg font-medium transition-all shrink-0 ${
            selectedFolderId === null
              ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
              : "bg-[var(--button-bg)] text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
          }`}
        >
          All Hidden ({hiddenPhotos.length})
        </button>

        {/* Hidden Folders Tabs */}
        {hiddenFolders.map((hf) => {
          const isSelected = selectedFolderId === hf.id;
          return (
            <div
              key={hf.id}
              onClick={() => onSelectFolder(hf.id)}
              className={`group flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm font-semibold"
                  : "bg-[var(--button-bg)] text-[var(--text-secondary)] hover:bg-[var(--button-hover)]"
              }`}
            >
              <Folder size={12} className={isSelected ? "text-white" : "text-indigo-400"} />
              <span>{hf.name}</span>
              <span className="text-[10px] opacity-75 font-mono">({hf.count})</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFolder(hf);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-300 ml-1 transition-opacity"
                title="Delete private folder"
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}

        {/* Inline Create Folder Form */}
        {isCreatingFolder && (
          <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-1.5 shrink-0">
            <input
              type="text"
              autoFocus
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="px-2.5 py-0.5 rounded-lg border border-indigo-400 bg-[var(--card)] text-xs text-[var(--text-main)] outline-none"
            />
            <button
              type="submit"
              className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }}
              className="px-2 py-0.5 rounded-lg text-xs text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* Grid of Hidden Photos */}
      <div className="flex-1 overflow-y-auto p-5">
        {displayedPhotos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-muted)] space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-[var(--glass-card)] border border-[var(--glass-border)] flex items-center justify-center text-3xl shadow-inner">
              🔒
            </div>
            <div className="text-base font-bold text-[var(--text-main)]">No Hidden Photos</div>
            <p className="text-xs max-w-sm">
              Photos you hide from your main library will be safely stored here in your Hidden Vault.
              Select any photo and click <span className="font-semibold text-[var(--text-main)]">"Hide in Vault"</span>.
            </p>
          </div>
        ) : (
          <div
            className={`grid gap-3 ${
              catalogStyle === "small"
                ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                : catalogStyle === "large"
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
            }`}
          >
            {displayedPhotos.map((photo) => {
              const isSelected = selectedPhotoIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  onClick={(e) => onSelectPhoto(photo, e)}
                  onDoubleClick={() => onEnlargePhoto(photo)}
                  className={`group relative aspect-square rounded-2xl overflow-hidden bg-[var(--card)] border transition-all cursor-pointer select-none ${
                    isSelected
                      ? "ring-2 ring-indigo-500 shadow-md border-indigo-500 scale-[0.98]"
                      : "border-[var(--glass-border)] hover:border-indigo-400/50 hover:shadow"
                  }`}
                >
                  <img
                    src={`/media/${photo.id}?w=360`}
                    alt={photo.file_name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                    loading="lazy"
                  />

                  {/* Top Badges: Selection checkbox & Unhide Button */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-5 h-5 rounded-md bg-black/60 text-white flex items-center justify-center text-[11px] backdrop-blur-sm">
                      {isSelected ? "✓" : ""}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnhidePhoto(photo.id);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-sm shadow"
                      title="Unhide and restore back to main library"
                    >
                      <Eye size={11} />
                      <span>Unhide</span>
                    </button>
                  </div>

                  {/* Private badge watermark */}
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-white/90 font-mono flex items-center gap-1">
                    <span>🔒</span>
                    <span className="truncate max-w-[90px]">{photo.file_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
