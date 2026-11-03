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

export const App: React.FC = () => {
  // Navigation & View State
  const [activeView, setActiveView] = useState<ActiveView>("timeline");
  const [currentCategory, setCurrentCategory] = useState("all");
  const [timeScale, setTimeScale] = useState<TimeScale>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("light");

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

  // Modal State
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Load Initial Data
  const refreshData = async () => {
    try {
      const [newStats, newPhotos, newPins, newPeople, newCandidates, newSync] = await Promise.all([
        api.getStats(),
        api.getPhotos(currentCategory, "date_desc", searchQuery),
        api.getMapPins(),
        api.getPeople(),
        api.getCandidates(),
        api.getSyncStatus(),
      ]);

      setStats(newStats);
      setPhotos(newPhotos);
      setMapPins(newPins);
      setPeople(newPeople);
      setCandidates(newCandidates);
      setSyncStatus(newSync);

      if (newPhotos.length > 0 && !selectedPhoto) {
        setSelectedPhoto(newPhotos[0]);
      }
    } catch (err) {
      console.error("Failed to load library data:", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentCategory, searchQuery]);

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
        setIsLocked(true);
      }
      // Rapid Triage shortcuts: K (Keep), N (Trash)
      else if (!e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement?.tagName !== "INPUT") {
        if (selectedPhoto) {
          if (e.key.toLowerCase() === "k") {
            handleKeepPhoto(selectedPhoto.id);
          } else if (e.key.toLowerCase() === "n") {
            handleTrashPhoto(selectedPhoto.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhoto]);

  // Action Handlers
  const handleToggleFavorite = async (id: number, current: boolean) => {
    await api.toggleFavorite(id, !current);
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_favorite: !current } : p))
    );
    if (selectedPhoto?.id === id) {
      setSelectedPhoto((prev) => (prev ? { ...prev, is_favorite: !current } : null));
    }
  };

  const handleKeepPhoto = async (id: number) => {
    // Advance to next photo after action
    const currentIndex = photos.findIndex((p) => p.id === id);
    if (currentIndex < photos.length - 1) {
      setSelectedPhoto(photos[currentIndex + 1]);
    }
  };

  const handleTrashPhoto = async (id: number) => {
    await api.trashPhoto(id, true);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    if (selectedPhoto?.id === id) {
      setSelectedPhoto(photos[0] || null);
    }
  };

  const handleIndexFolder = async () => {
    const folder = prompt("Enter full folder path to index on this Mac:", "~/Pictures");
    if (folder) {
      try {
        await api.indexFolder(folder);
        refreshData();
      } catch (err) {
        alert("Could not index folder: " + err);
      }
    }
  };

  const handleRotatePin = async () => {
    const newPin = await api.rotatePin();
    setSyncStatus((prev) => ({ ...prev, sas_pin: newPin }));
  };

  const handleConfirmCandidate = async (face_id: number, person_key: string) => {
    await api.confirmCandidate(face_id, person_key);
    refreshData();
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--canvas-bg)] text-[var(--text-main)]">
      {/* Top Header */}
      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        timeScale={timeScale}
        onChangeTimeScale={setTimeScale}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onIndexFolder={handleIndexFolder}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isInspectorOpen={isInspectorOpen}
        onLockVault={() => setIsLocked(true)}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      />

      {/* Main Content Area: Sidebar + Views + Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentCategory={currentCategory}
          onSelectCategory={(cat) => {
            setCurrentCategory(cat);
            if (activeView !== "timeline" && activeView !== "explorer") {
              setActiveView("timeline");
            }
          }}
          stats={stats}
          onOpenSync={() => setIsSyncOpen(true)}
        />

        {/* Center Main View */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--window-bg)]">
          {activeView === "timeline" && (
            <TimelineView
              photos={photos}
              selectedPhoto={selectedPhoto}
              onSelectPhoto={setSelectedPhoto}
              onToggleFavorite={handleToggleFavorite}
              timeScale={timeScale}
            />
          )}

          {activeView === "explorer" && (
            <ExplorerView
              photos={photos}
              selectedPhoto={selectedPhoto}
              onSelectPhoto={setSelectedPhoto}
              onKeepPhoto={handleKeepPhoto}
              onTrashPhoto={handleTrashPhoto}
              onToggleFavorite={handleToggleFavorite}
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

        {/* Right Inspector Sidebar */}
        {isInspectorOpen && (
          <InspectorSidebar
            photo={selectedPhoto}
            onClose={() => setIsInspectorOpen(false)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </div>

      {/* Modals */}
      <SyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        syncStatus={syncStatus}
        onRotatePin={handleRotatePin}
        onPairPin={(pin) => api.pairDevice(pin)}
      />

      <LockScreenModal
        isLocked={isLocked}
        onUnlock={() => setIsLocked(false)}
      />
    </div>
  );
};
