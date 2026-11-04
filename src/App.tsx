import React, { useEffect, useState } from "react";
import { api } from "./services/api";
import {
  ActiveView,
  CandidateFace,
  LibraryStats,
  MapPin,
  PersonGroup,
  PhotoItem,
  SyncStatus,
  ThemeMode,
  TimeScale,
  CatalogStyle,
  FolderItem,
} from "./types/gallery";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { TimelineView } from "./components/timeline/TimelineView";
import { ExplorerView } from "./components/explorer/ExplorerView";
import { PlacesMapView } from "./components/places/PlacesMapView";
import { PeopleView } from "./components/people/PeopleView";
import { InspectorSidebar } from "./components/inspector/InspectorSidebar";
import { SyncModal } from "./components/sync/SyncModal";
import { LockScreenModal } from "./components/auth/LockScreenModal";
import { IndexFolderModal } from "./components/dialogs/IndexFolderModal";
import { EnlargedPhotoModal } from "./components/dialogs/EnlargedPhotoModal";

export const App: React.FC = () => {
  // Navigation & View State
  const [activeView, setActiveView] = useState<ActiveView>("timeline");
  const [currentCategory, setCurrentCategory] = useState("all");
  const [timeScale, setTimeScale] = useState<TimeScale>("days");
  const [catalogStyle, setCatalogStyle] = useState<CatalogStyle>("medium");
  const [sortOrder, setSortOrder] = useState<string>("date_desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [anchorPhotoId, setAnchorPhotoId] = useState<number | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Data State
  const [stats, setStats] = useState<LibraryStats>({
    total: 0,
    unlabeled: 0,
    favorites: 0,
    screenshots: 0,
    videos: 0,
    raw: 0,
    portraits: 0,
    live_photos: 0,
    hidden: 0,
    trashed: 0,
    geocoded: 0,
    duplicate_groups: 0,
    faces: 0,
    people: 0,
    pets: 0,
    candidates: 0,
    keep: 0,
    noise: 0,
    panoramas: 0,
    documents: 0,
    shared_albums: 0,
    shared_with_you: 0,
    partner_sharing: 0,
    travel: 0,
    imports: 0,
    prores: 0,
    slomo: 0,
    timelapse: 0,
    screen_recordings: 0,
  });
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [people, setPeople] = useState<PersonGroup[]>([]);
  const [candidates, setCandidates] = useState<CandidateFace[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: "ready",
    service_name: "_photovault._tcp.local.",
    vault_id: "",
    sas_pin: "849 201",
    tls_version: "TLS 1.3",
    mesh_active: true,
    port: 8765,
    pwa_url: "http://127.0.0.1:8765/sync",
    devices: [],
  });

  // Modal & Responsive State
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return typeof window !== "undefined" && sessionStorage.getItem("neural_vault_locked") === "true";
  });

  const handleLockVault = () => {
    setIsLocked(true);
    sessionStorage.setItem("neural_vault_locked", "true");
  };

  const handleUnlockVault = () => {
    setIsLocked(false);
    sessionStorage.removeItem("neural_vault_locked");
  };

  const [isIndexFolderOpen, setIsIndexFolderOpen] = useState(false);
  const [isEnlargedOpen, setIsEnlargedOpen] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());
  const [undoToast, setUndoToast] = useState<{ message: string; ids: number[] } | null>(null);
  const [isEmptyTrashConfirmOpen, setIsEmptyTrashConfirmOpen] = useState(false);

  // Load Initial Data
  const refreshData = async () => {
    try {
      const [newStats, newPhotos, newPins, newPeople, newCandidates, newSync, newFolders] =
        await Promise.all([
          api.getStats(),
          api.getPhotos(currentCategory, sortOrder, searchQuery),
          api.getMapPins(),
          api.getPeople(),
          api.getCandidates(),
          api.getSyncStatus(),
          api.getFolders(),
        ]);

      setStats(newStats);
      setPhotos(newPhotos);
      setMapPins(newPins);
      setPeople(newPeople);
      setCandidates(newCandidates);
      setSyncStatus(newSync);
      setFolders(newFolders);

      if (newPhotos.length > 0 && !selectedPhoto) {
        setSelectedPhoto(newPhotos[0]);
      }
    } catch (err) {
      console.error("Failed to load library data:", err);
    }
  };

  useEffect(() => {
    setSelectedPhotoIds(new Set());
    refreshData();
  }, [currentCategory, sortOrder, searchQuery]);

  // Auto-dismiss undo toast after 8 seconds
  useEffect(() => {
    if (!undoToast) return;
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  // Sync theme to root class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.remove("theme-light");
      root.classList.add("theme-dark");
    } else {
      root.classList.remove("theme-dark");
      root.classList.add("theme-light");
    }
  }, [theme]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘1: Timeline
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        setActiveView("timeline");
      }
      // ⌘2: Explorer
      else if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        setActiveView("explorer");
      }
      // ⌘3: Places
      else if ((e.metaKey || e.ctrlKey) && e.key === "3") {
        e.preventDefault();
        setActiveView("places");
      }
      // ⌘4: People & Pets
      else if ((e.metaKey || e.ctrlKey) && e.key === "4") {
        e.preventDefault();
        setActiveView("people");
      }
      // ⌘I: Inspector
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      }
      // ⌘L: Instant Panic Lockdown
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        handleLockVault();
      }
      // Navigation & Triage shortcuts when not typing in search or inputs
      else if (
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !isEnlargedOpen &&
        !isIndexFolderOpen &&
        !isSyncOpen &&
        !isLocked
      ) {
        if (photos.length > 0) {
          const currentIdx = selectedPhoto
            ? photos.findIndex((p) => p.id === selectedPhoto.id)
            : -1;
          const colStep =
            activeView === "timeline"
              ? timeScale === "years"
                ? 6
                : timeScale === "months"
                ? 4
                : 3
              : 1;

          // Arrow Right: Next photo
          if (e.key === "ArrowRight") {
            e.preventDefault();
            const nextIdx = currentIdx < photos.length - 1 ? currentIdx + 1 : 0;
            setSelectedPhoto(photos[nextIdx]);
          }
          // Arrow Left: Previous photo
          else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const prevIdx = currentIdx > 0 ? currentIdx - 1 : photos.length - 1;
            setSelectedPhoto(photos[prevIdx]);
          }
          // Arrow Down: Next row or item
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            const nextIdx = Math.min(photos.length - 1, currentIdx + colStep);
            setSelectedPhoto(photos[nextIdx]);
          }
          // Arrow Up: Previous row or item
          else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prevIdx = Math.max(0, currentIdx - colStep);
            setSelectedPhoto(photos[prevIdx]);
          }
          // Space or Enter: Open enlarged view
          else if (e.key === " " || e.key === "Enter") {
            if (selectedPhoto) {
              e.preventDefault();
              setIsEnlargedOpen(true);
            }
          }
          // Rapid Triage shortcuts: K (Keep), N (Trash)
          else if (selectedPhoto) {
            if (e.key.toLowerCase() === "k") {
              e.preventDefault();
              handleKeepPhoto(selectedPhoto.id);
            } else if (e.key.toLowerCase() === "n") {
              e.preventDefault();
              handleTrashPhoto(selectedPhoto.id);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedPhoto,
    photos,
    activeView,
    timeScale,
    isEnlargedOpen,
    isIndexFolderOpen,
    isSyncOpen,
    isLocked,
  ]);

  // Selection Handlers (Command/Ctrl + Click, Shift + Click for range, Single Click)
  const handlePhotoClick = (photo: PhotoItem, e: React.MouseEvent) => {
    setSelectedPhoto(photo);

    if (e.shiftKey) {
      // Range selection with Shift (like Google Photos / Apple Photos)
      const anchorId = anchorPhotoId ?? selectedPhoto?.id;
      const fromIdx = anchorId ? photos.findIndex((p) => p.id === anchorId) : -1;
      const toIdx = photos.findIndex((p) => p.id === photo.id);

      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        const rangeIds = photos.slice(start, end + 1).map((p) => p.id);

        if (e.metaKey || e.ctrlKey) {
          // If Cmd/Ctrl + Shift: add range to existing selection
          setSelectedPhotoIds((prev) => {
            const next = new Set(prev);
            rangeIds.forEach((id) => next.add(id));
            return next;
          });
        } else {
          // Pure Shift: replace with range
          setSelectedPhotoIds(new Set(rangeIds));
        }
      } else {
        setSelectedPhotoIds(new Set([photo.id]));
        setAnchorPhotoId(photo.id);
      }
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle individual selection with Command / Ctrl
      setAnchorPhotoId(photo.id);
      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) {
          next.delete(photo.id);
        } else {
          next.add(photo.id);
        }
        return next;
      });
    } else {
      // Standard single selection
      setAnchorPhotoId(photo.id);
      setSelectedPhotoIds(new Set([photo.id]));
    }
  };

  const handleToggleSelectPhoto = (id: number, e?: React.MouseEvent) => {
    if (e && e.shiftKey) {
      const anchorId = anchorPhotoId ?? selectedPhoto?.id;
      const fromIdx = anchorId ? photos.findIndex((p) => p.id === anchorId) : -1;
      const toIdx = photos.findIndex((p) => p.id === id);

      if (fromIdx !== -1 && toIdx !== -1) {
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        const rangeIds = photos.slice(start, end + 1).map((p) => p.id);
        setSelectedPhotoIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
        return;
      }
    }

    setAnchorPhotoId(id);
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectSectionPhotos = (sectionIds: number[]) => {
    setSelectedPhotoIds((prev) => {
      const allSelected = sectionIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        sectionIds.forEach((id) => next.delete(id));
      } else {
        sectionIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedPhotoIds(new Set(photos.map((p) => p.id)));
  };

  const handleClearSelection = () => {
    setSelectedPhotoIds(new Set());
  };

  // Real-time Favorite Toggle
  const handleToggleFavorite = async (id: number, current: boolean) => {
    const nextVal = !current;
    await api.toggleFavorite(id, nextVal);
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_favorite: nextVal } : p))
    );
    if (selectedPhoto?.id === id) {
      setSelectedPhoto((prev) => (prev ? { ...prev, is_favorite: nextVal } : null));
    }
    // Update favorite column number in real time
    setStats((prev) => ({
      ...prev,
      favorites: nextVal ? prev.favorites + 1 : Math.max(0, prev.favorites - 1),
    }));
    if (currentCategory === "favorites" && !nextVal) {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Bulk Favorite Toggle for all selected photos
  const handleBulkFavorite = async () => {
    if (selectedPhotoIds.size === 0) return;
    const ids = Array.from(selectedPhotoIds);
    const allFav = ids.every((id) => photos.find((p) => p.id === id)?.is_favorite);
    const targetVal = !allFav;

    await api.bulkFavorite(ids, targetVal);
    setPhotos((prev) =>
      prev.map((p) => (selectedPhotoIds.has(p.id) ? { ...p, is_favorite: targetVal } : p))
    );

    let diff = 0;
    ids.forEach((id) => {
      const p = photos.find((item) => item.id === id);
      if (p) {
        if (targetVal && !p.is_favorite) diff += 1;
        if (!targetVal && p.is_favorite) diff -= 1;
      }
    });

    setStats((prev) => ({
      ...prev,
      favorites: Math.max(0, prev.favorites + diff),
    }));
  };

  // Remove Favorites for selected photos (requested by user)
  const handleRemoveFavoritesSelected = async () => {
    if (selectedPhotoIds.size === 0) return;
    const favoriteIds = photos
      .filter((p) => selectedPhotoIds.has(p.id) && p.is_favorite)
      .map((p) => p.id);
    if (favoriteIds.length === 0) return;

    await api.bulkFavorite(favoriteIds, false);
    setPhotos((prev) =>
      prev.map((p) => (favoriteIds.includes(p.id) ? { ...p, is_favorite: false } : p))
    );
    if (selectedPhoto && favoriteIds.includes(selectedPhoto.id)) {
      setSelectedPhoto((prev) => (prev ? { ...prev, is_favorite: false } : null));
    }
    setStats((prev) => ({
      ...prev,
      favorites: Math.max(0, prev.favorites - favoriteIds.length),
    }));
    if (currentCategory === "favorites") {
      setPhotos((prev) => prev.filter((p) => !favoriteIds.includes(p.id)));
      setSelectedPhotoIds(new Set());
    }
  };

  // Folder Handlers (keep photos separate)
  const handleCreateFolder = async (name: string) => {
    const created = await api.createFolder(name);
    setFolders((prev) => [...prev, created]);
    setCurrentCategory(`folder:${created.id}`);
  };

  const handleDeleteFolder = async (id: number) => {
    await api.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (currentCategory === `folder:${id}`) {
      setCurrentCategory("all");
    }
  };

  const handleDropOnFolder = async (folderId: number, photoIds: number[]) => {
    await api.addPhotosToFolder(folderId, photoIds);
    const updatedFolders = await api.getFolders();
    setFolders(updatedFolders);
    if (currentCategory === `folder:${folderId}`) {
      const refreshed = await api.getPhotos(currentCategory, sortOrder, searchQuery);
      setPhotos(refreshed);
    }
  };

  const handleDropOnCategory = async (targetCategory: string, photoIds: number[]) => {
    if (targetCategory === "favorites") {
      await api.bulkFavorite(photoIds, true);
    } else if (targetCategory === "trash") {
      await api.trashPhotos(photoIds, true);
    } else {
      await api.setCategory(photoIds, targetCategory);
    }
    const [refreshedPhotos, refreshedStats] = await Promise.all([
      api.getPhotos(currentCategory, sortOrder, searchQuery),
      api.getStats(),
    ]);
    setPhotos(refreshedPhotos);
    setStats(refreshedStats);
  };

  // Drag & Drop File Upload Handler (Drop any photo from Mac into catalog)
  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type.startsWith("video/") ||
        /\.(jpg|jpeg|png|heic|webp|gif|mp4|mov)$/i.test(f.name)
    );

    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      const uploadedFileIds: number[] = [];
      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length });
        const res = await api.uploadPhoto(files[i]);
        if (res?.file_id) {
          uploadedFileIds.push(res.file_id);
        }
      }

      // If dropped inside a folder, also assign to that folder
      if (currentCategory.startsWith("folder:") && uploadedFileIds.length > 0) {
        const folderId = parseInt(currentCategory.split("folder:")[1], 10);
        if (!isNaN(folderId)) {
          await api.addPhotosToFolder(folderId, uploadedFileIds);
        }
      }

      await refreshData();
    } catch (err) {
      console.error("Failed to import dropped photos:", err);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleKeepPhoto = async (id: number) => {
    // Advance to next photo after action
    const currentIndex = photos.findIndex((p) => p.id === id);
    if (currentIndex < photos.length - 1) {
      setSelectedPhoto(photos[currentIndex + 1]);
    }
  };

  // Delete single photo to Trash
  const handleTrashPhoto = async (id: number) => {
    await api.trashPhoto(id, true);
    const currentIndex = photos.findIndex((p) => p.id === id);
    const updated = photos.filter((p) => p.id !== id);
    setPhotos(updated);
    setStats((prev) => ({
      ...prev,
      trashed: prev.trashed + 1,
      total: Math.max(0, prev.total - 1),
    }));
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedPhoto?.id === id) {
      const nextPhoto = updated[currentIndex] || updated[currentIndex - 1] || null;
      setSelectedPhoto(nextPhoto);
      if (!nextPhoto) {
        setIsEnlargedOpen(false);
      }
    }
    setUndoToast({
      message: "1 photo moved to Trash",
      ids: [id],
    });
  };

  // Delete all selected photos to Trash
  const handleDeleteSelected = async () => {
    if (selectedPhotoIds.size === 0) return;
    const ids = Array.from(selectedPhotoIds);
    await api.trashPhotos(ids, true);
    setPhotos((prev) => prev.filter((p) => !selectedPhotoIds.has(p.id)));
    setStats((prev) => ({
      ...prev,
      trashed: prev.trashed + ids.length,
      total: Math.max(0, prev.total - ids.length),
    }));
    setSelectedPhotoIds(new Set());
    if (selectedPhoto && selectedPhotoIds.has(selectedPhoto.id)) {
      const remaining = photos.filter((p) => !selectedPhotoIds.has(p.id));
      setSelectedPhoto(remaining[0] || null);
    }
    setUndoToast({
      message: `${ids.length} ${ids.length === 1 ? "photo" : "photos"} moved to Trash`,
      ids,
    });
  };

  // Put Back / Restore photos where they were deleted
  const handleRestorePhotos = async (ids: number[]) => {
    if (ids.length === 0) return;
    await api.restorePhotos(ids);
    setStats((prev) => ({
      ...prev,
      trashed: Math.max(0, prev.trashed - ids.length),
      total: prev.total + ids.length,
    }));
    if (currentCategory === "trash") {
      setPhotos((prev) => prev.filter((p) => !ids.includes(p.id)));
    } else {
      refreshData();
    }
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setUndoToast(null);
  };

  // Restore all items in Trash
  const handleRestoreAllTrash = async () => {
    const allIds = photos.map((p) => p.id);
    if (allIds.length === 0) return;
    await api.restorePhotos(allIds);
    setPhotos([]);
    setStats((prev) => ({
      ...prev,
      trashed: 0,
      total: prev.total + allIds.length,
    }));
    setSelectedPhotoIds(new Set());
  };

  // Empty Bin Permanently
  const handleEmptyTrash = async () => {
    await api.emptyTrash();
    setPhotos([]);
    setStats((prev) => ({
      ...prev,
      trashed: 0,
    }));
    setIsEmptyTrashConfirmOpen(false);
    setSelectedPhotoIds(new Set());
  };

  const handleIndexFolder = () => {
    setIsIndexFolderOpen(true);
  };

  const handleRotatePin = async () => {
    await api.rotatePin();
    const newStatus = await api.getSyncStatus();
    setSyncStatus(newStatus);
  };

  const handleToggleTunnel = async (enabled: boolean) => {
    await api.toggleTunnel(enabled);
    const newStatus = await api.getSyncStatus();
    setSyncStatus(newStatus);
  };

  const handleUnpairDevice = async (deviceId: string) => {
    await api.unpairDevice(deviceId);
    const newSync = await api.getSyncStatus();
    setSyncStatus(newSync);
  };

  // Live polling for newly connected mobile devices when sync modal is open
  useEffect(() => {
    if (!isSyncOpen) return;
    // Initial refresh on open
    api.getSyncStatus().then(setSyncStatus).catch(() => {});
    const interval = setInterval(async () => {
      try {
        const newSync = await api.getSyncStatus();
        setSyncStatus(newSync);
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isSyncOpen]);

  const handleConfirmCandidate = async (face_id: number, person_key: string) => {
    await api.confirmCandidate(face_id, person_key);
    refreshData();
  };

  const hasSelectedFavorites = photos.some((p) => selectedPhotoIds.has(p.id) && p.is_favorite);

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) {
          setIsDraggingFiles(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) {
          setIsDraggingFiles(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget === e.target) {
          setIsDraggingFiles(false);
        }
      }}
      onDrop={handleDropFiles}
      className="relative flex flex-col h-screen w-screen overflow-hidden bg-[var(--canvas-bg)] text-[var(--text-main)]"
    >
      {/* Drag & Drop File Upload Overlay */}
      {isDraggingFiles && (
        <div className="absolute inset-0 z-50 bg-blue-600/20 backdrop-blur-md border-4 border-dashed border-blue-500 rounded-3xl m-4 flex flex-col items-center justify-center text-center p-8 pointer-events-none animate-fadeIn">
          <div className="w-20 h-20 rounded-3xl bg-blue-500/30 text-blue-500 flex items-center justify-center text-4xl mb-4 shadow-xl">
            📥
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Drop Photos to Save in Photo Catalog
          </h2>
          <p className="text-sm text-white/80 max-w-md">
            Photos will be saved directly into your local library catalog, categorized, and analyzed with AI.
          </p>
        </div>
      )}

      {/* Uploading Progress Toast */}
      {isUploading && uploadProgress && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 text-white shadow-2xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <div className="text-xs">
            <span className="font-semibold">Importing to catalog:</span>{" "}
            <span>{uploadProgress.current} of {uploadProgress.total}</span>
          </div>
        </div>
      )}

      {/* App Body (Obscured & Locked when Vault is Locked) */}
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isLocked ? "filter blur-3xl opacity-0 pointer-events-none select-none" : ""
        }`}
        aria-hidden={isLocked}
      >
        {/* Top Header */}
        <Header
        activeView={activeView}
        onChangeView={setActiveView}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        timeScale={timeScale}
        onChangeTimeScale={setTimeScale}
        catalogStyle={catalogStyle}
        onChangeCatalogStyle={setCatalogStyle}
        sortOrder={sortOrder}
        onChangeSortOrder={setSortOrder}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onIndexFolder={handleIndexFolder}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isInspectorOpen={isInspectorOpen}
        onLockVault={handleLockVault}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
        hasSelectedPhoto={!!selectedPhoto}
        selectedCount={selectedPhotoIds.size}
        totalCount={photos.length}
        hasSelectedFavorites={hasSelectedFavorites}
        onClearSelection={handleClearSelection}
        onSelectAll={handleSelectAll}
        onDeleteSelected={handleDeleteSelected}
        onFavoriteSelected={handleBulkFavorite}
        onRemoveFavoriteSelected={handleRemoveFavoritesSelected}
        onRestoreSelected={() => handleRestorePhotos(Array.from(selectedPhotoIds))}
        isTrashCategory={currentCategory === "trash"}
      />

      {/* Main Content Area: Sidebar + Views + Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-fadeIn"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar (responsive slide-over on mobile, normal static column on md+) */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 transform md:relative md:translate-x-0 md:z-0 h-full ${
            isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar
            currentCategory={currentCategory}
            onSelectCategory={(cat) => {
              setCurrentCategory(cat);
              setSelectedPhotoIds(new Set());
              setIsSidebarOpen(false);
              if (activeView !== "timeline" && activeView !== "explorer") {
                setActiveView("timeline");
              }
            }}
            activeView={activeView}
            onChangeView={(view) => {
              setActiveView(view);
              setIsSidebarOpen(false);
            }}
            stats={stats}
            onOpenSync={() => {
              setIsSyncOpen(true);
              setIsSidebarOpen(false);
            }}
            folders={folders}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onDropOnFolder={handleDropOnFolder}
            onDropOnCategory={handleDropOnCategory}
          />
        </div>

        {/* Center Main View */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--window-bg)] min-w-0">
          {activeView === "timeline" && (
            <TimelineView
              photos={photos}
              selectedPhoto={selectedPhoto}
              selectedPhotoIds={selectedPhotoIds}
              onPhotoClick={handlePhotoClick}
              onToggleSelectPhoto={handleToggleSelectPhoto}
              onEnlargePhoto={(p) => {
                setSelectedPhoto(p);
                setIsEnlargedOpen(true);
              }}
              onToggleFavorite={handleToggleFavorite}
              timeScale={timeScale}
              catalogStyle={catalogStyle}
              sortOrder={sortOrder}
              isTrashCategory={currentCategory === "trash"}
              onRestorePhoto={(id) => handleRestorePhotos([id])}
              onEmptyTrash={() => setIsEmptyTrashConfirmOpen(true)}
              onRestoreAll={handleRestoreAllTrash}
              onSelectSectionPhotos={handleSelectSectionPhotos}
              onDropOnCategorySection={handleDropOnCategory}
            />
          )}

          {activeView === "explorer" && (
            <ExplorerView
              photos={photos}
              selectedPhoto={selectedPhoto}
              selectedPhotoIds={selectedPhotoIds}
              onPhotoClick={handlePhotoClick}
              onToggleSelectPhoto={handleToggleSelectPhoto}
              onSelectAll={handleSelectAll}
              onClearSelection={handleClearSelection}
              onEnlargePhoto={(p) => {
                setSelectedPhoto(p);
                setIsEnlargedOpen(true);
              }}
              onKeepPhoto={handleKeepPhoto}
              onTrashPhoto={handleTrashPhoto}
              onToggleFavorite={handleToggleFavorite}
              catalogStyle={catalogStyle}
              isTrashCategory={currentCategory === "trash"}
              onRestorePhoto={(id) => handleRestorePhotos([id])}
              onEmptyTrash={() => setIsEmptyTrashConfirmOpen(true)}
              onRestoreAll={handleRestoreAllTrash}
            />
          )}

          {activeView === "places" && (
            <PlacesMapView
              pins={mapPins}
              onSelectPinPhoto={(photoId) => {
                const found = photos.find((p) => p.id === photoId);
                if (found) setSelectedPhoto(found);
              }}
            />
          )}

          {activeView === "people" && (
            <PeopleView
              people={people}
              candidates={candidates}
              onConfirmCandidate={handleConfirmCandidate}
            />
          )}
        </main>

        {/* Right Inspector Sidebar (slide-over drawer on < lg screens, column on >= lg) */}
        {isInspectorOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] lg:hidden animate-fadeIn"
              onClick={() => setIsInspectorOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-40 lg:relative lg:z-0 h-full shadow-2xl lg:shadow-none animate-slideLeft shrink-0">
              <InspectorSidebar
                photo={selectedPhoto}
                onClose={() => setIsInspectorOpen(false)}
                onToggleFavorite={handleToggleFavorite}
                onEnlargePhoto={(p) => {
                  setSelectedPhoto(p);
                  setIsEnlargedOpen(true);
                }}
              />
            </div>
          </>
        )}
      </div>
      </div>

      {/* Modals */}
      <EnlargedPhotoModal
        isOpen={isEnlargedOpen}
        photo={selectedPhoto}
        photos={photos}
        onClose={() => setIsEnlargedOpen(false)}
        onSelectPhoto={(photo) => setSelectedPhoto(photo)}
        onToggleFavorite={handleToggleFavorite}
        onKeepPhoto={handleKeepPhoto}
        onTrashPhoto={handleTrashPhoto}
        onRestorePhoto={(id) => handleRestorePhotos([id])}
      />

      <IndexFolderModal
        isOpen={isIndexFolderOpen}
        onClose={() => setIsIndexFolderOpen(false)}
        onIndexComplete={refreshData}
      />

      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        syncStatus={syncStatus}
        onRotatePin={handleRotatePin}
        onPairPin={(pin) => api.pairDevice(pin)}
        onUnpairDevice={handleUnpairDevice}
        onToggleTunnel={handleToggleTunnel}
      />

      <LockScreenModal
        isLocked={isLocked}
        onUnlock={handleUnlockVault}
      />

      {/* Empty Trash Confirmation Modal */}
      {isEmptyTrashConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--glass-card)] border border-[var(--glass-border)] shadow-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl mx-auto">
              🗑️
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">
                Empty Trash Bin?
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Are you sure you want to permanently delete all {stats.trashed || photos.length} items from the trash bin? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsEmptyTrashConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--button-bg)] border border-[var(--button-border)] hover:bg-[var(--button-hover)] text-xs font-semibold text-[var(--text-main)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyTrash}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-md transition-all"
              >
                Empty Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast Notification (when photos are moved to trash) */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/90 dark:bg-zinc-800 text-white backdrop-blur-xl border border-white/20 shadow-2xl animate-bounce-once">
          <span className="text-base">🗑️</span>
          <span className="text-xs font-medium">{undoToast.message}</span>
          <button
            onClick={() => handleRestorePhotos(undoToast.ids)}
            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
          >
            <span>↩</span>
            <span>Put Back</span>
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="text-white/60 hover:text-white text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
