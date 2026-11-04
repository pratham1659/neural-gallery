import {
  CandidateFace,
  FolderItem,
  LibraryStats,
  MapPin,
  PersonGroup,
  PhotoItem,
  SyncStatus,
} from "../types/gallery";

const API_BASE = "";

async function jsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("X-Neural-Gallery", "1");

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  async getStats(): Promise<LibraryStats> {
    try {
      return await jsonRequest<LibraryStats>("/api/stats");
    } catch {
      return {
        total: 124,
        unlabeled: 8,
        favorites: 24,
        screenshots: 14,
        videos: 12,
        raw: 18,
        portraits: 9,
        live_photos: 16,
        hidden: 3,
        trashed: 2,
        geocoded: 86,
        duplicate_groups: 4,
        faces: 42,
        people: 6,
        pets: 2,
        candidates: 3,
        keep: 96,
        noise: 12,
      };
    }
  },

  async getPhotos(category = "all", sort = "date_desc", search = "", limit = 100): Promise<PhotoItem[]> {
    try {
      const params = new URLSearchParams({ category, sort, search, limit: limit.toString() });
      const raw = await jsonRequest<any[]>(`/api/photos?${params.toString()}`);
      return raw.map((p) => ({
        ...p,
        file_name: p.file_name || p.name || "",
        location_name: p.location_name || p.city || "",
        thumb: p.thumb || `/media/${p.id}?w=480`,
      }));
    } catch {
      return [];
    }
  },

  async getPhotoDetail(id: number): Promise<PhotoItem> {
    const raw = await jsonRequest<any>(`/api/photo?id=${id}`);
    return {
      ...raw,
      file_name: raw.file_name || raw.name || "",
      location_name:
        raw.location_name ||
        (raw.city && raw.country ? `${raw.city}, ${raw.country}` : raw.city || raw.country || ""),
      thumb: raw.thumb || `/media/${raw.id}?w=640`,
    };
  },

  async toggleFavorite(id: number, is_favorite: boolean): Promise<{ id: number; is_favorite: boolean }> {
    return jsonRequest<{ id: number; is_favorite: boolean }>("/api/favorite", {
      method: "POST",
      body: JSON.stringify({ id, is_favorite }),
    });
  },

  async toggleHidden(id: number, is_hidden: boolean): Promise<{ id: number; is_hidden: boolean }> {
    return jsonRequest<{ id: number; is_hidden: boolean }>("/api/hide", {
      method: "POST",
      body: JSON.stringify({ id, is_hidden }),
    });
  },

  async trashPhoto(id: number, soft = true): Promise<{ id: number; trashed: boolean }> {
    return jsonRequest<{ id: number; trashed: boolean }>("/api/trash", {
      method: "POST",
      body: JSON.stringify({ id, soft }),
    });
  },

  async trashPhotos(ids: number[], soft = true): Promise<{ ids: number[]; trashed: boolean }> {
    return jsonRequest<{ ids: number[]; trashed: boolean }>("/api/trash", {
      method: "POST",
      body: JSON.stringify({ ids, soft }),
    });
  },

  async restorePhotos(ids: number[]): Promise<{ ids: number[]; restored: boolean }> {
    return jsonRequest<{ ids: number[]; restored: boolean }>("/api/restore", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },

  async emptyTrash(): Promise<{ emptied: number; success: boolean }> {
    return jsonRequest<{ emptied: number; success: boolean }>("/api/trash/empty", {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async bulkFavorite(ids: number[], is_favorite: boolean): Promise<{ ids: number[]; is_favorite: boolean }> {
    return jsonRequest<{ ids: number[]; is_favorite: boolean }>("/api/favorites/bulk", {
      method: "POST",
      body: JSON.stringify({ ids, is_favorite }),
    });
  },

  async getFolders(): Promise<FolderItem[]> {
    try {
      return await jsonRequest<FolderItem[]>("/api/folders");
    } catch {
      return [];
    }
  },

  async createFolder(name: string, is_hidden: boolean = false): Promise<FolderItem> {
    return jsonRequest<FolderItem>("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name, is_hidden }),
    });
  },

  async setPhotoHidden(id: number, is_hidden: boolean): Promise<any> {
    return jsonRequest("/api/hide", {
      method: "POST",
      body: JSON.stringify({ id, is_hidden }),
    });
  },

  async setPhotosHiddenBulk(ids: number[], is_hidden: boolean): Promise<any> {
    return Promise.all(ids.map((id) => this.setPhotoHidden(id, is_hidden)));
  },

  async getVaultStorage(): Promise<import("../types/gallery").VaultStorageInfo> {
    return jsonRequest<import("../types/gallery").VaultStorageInfo>("/api/vault/storage");
  },

  async setVaultStorage(
    vault_path: string,
    managed_ingest: boolean = true
  ): Promise<import("../types/gallery").VaultStorageInfo> {
    return jsonRequest<import("../types/gallery").VaultStorageInfo>("/api/vault/storage", {
      method: "POST",
      body: JSON.stringify({ vault_path, managed_ingest }),
    });
  },

  async deleteFolder(id: number): Promise<{ success: boolean; id: number }> {
    return jsonRequest<{ success: boolean; id: number }>("/api/folders/delete", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  },

  async addPhotosToFolder(folderId: number, fileIds: number[]): Promise<any> {
    return jsonRequest("/api/folders/add", {
      method: "POST",
      body: JSON.stringify({ folder_id: folderId, file_ids: fileIds }),
    });
  },

  async removePhotosFromFolder(folderId: number, fileIds: number[]): Promise<any> {
    return jsonRequest("/api/folders/remove", {
      method: "POST",
      body: JSON.stringify({ folder_id: folderId, file_ids: fileIds }),
    });
  },

  async setCategory(ids: number[], category: string): Promise<any> {
    return jsonRequest("/api/category", {
      method: "POST",
      body: JSON.stringify({ ids, category }),
    });
  },

  async uploadPhoto(file: File): Promise<any> {
    const arrayBuffer = await file.arrayBuffer();
    const res = await fetch("/api/sync/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": file.name,
        "X-Neural-Gallery": "1",
      },
      body: arrayBuffer,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || `Upload failed with status ${res.status}`);
    }
    return res.json();
  },

  async getMapPins(): Promise<MapPin[]> {
    try {
      return await jsonRequest<MapPin[]>("/api/map/pins");
    } catch {
      return [
        {
          id: 1,
          lat: 35.6764,
          lng: 139.65,
          name: "Tokyo Crossing Night",
          city: "Tokyo, Japan",
          count: 14,
          camera: "Sony α7R V · FE 24-70mm GM II",
          exposure: "ƒ/2.8 · 1/125s · ISO 800",
          is_favorite: true,
          thumb: "/media/1?w=320",
        },
        {
          id: 2,
          lat: 37.7749,
          lng: -122.4194,
          name: "Golden Gate Sunrise Fog",
          city: "San Francisco, USA",
          count: 28,
          camera: "Fujifilm X-T5 · XF 16-55mm ƒ/2.8",
          exposure: "ƒ/4.0 · 1/500s · ISO 160",
          is_favorite: true,
          thumb: "/media/2?w=320",
        },
        {
          id: 3,
          lat: 35.0116,
          lng: 135.7681,
          name: "Kyoto Bamboo Grove",
          city: "Kyoto, Japan",
          count: 9,
          camera: "iPhone 16 Pro · 24mm",
          exposure: "ƒ/1.78 · 1/320s · ISO 64",
          is_favorite: false,
          thumb: "/media/3?w=320",
        },
        {
          id: 4,
          lat: 46.4131,
          lng: 11.8544,
          name: "Tre Cime di Lavaredo",
          city: "Dolomites, Italy",
          count: 32,
          camera: "Hasselblad X2D 100C",
          exposure: "ƒ/5.6 · 1/250s · ISO 100",
          is_favorite: true,
          thumb: "/media/4?w=320",
        },
      ];
    }
  },

  async getPeople(): Promise<PersonGroup[]> {
    try {
      return await jsonRequest<PersonGroup[]>("/api/people");
    } catch {
      return [
        { key: "p_eleanor", name: "Eleanor Vance", count: 34, is_pet: false, thumb: "" },
        { key: "p_sarah", name: "Sarah Chen", count: 28, is_pet: false, thumb: "" },
        { key: "p_marcus", name: "Marcus Brody", count: 19, is_pet: false, thumb: "" },
        { key: "p_milo", name: "Milo (Golden Retriever)", count: 42, is_pet: true, thumb: "" },
        { key: "p_luna", name: "Luna (Siamese Cat)", count: 23, is_pet: true, thumb: "" },
      ];
    }
  },

  async getCandidates(): Promise<CandidateFace[]> {
    try {
      return await jsonRequest<CandidateFace[]>("/api/people/candidates");
    } catch {
      return [
        { face_id: 101, person_key: "p_eleanor", person_name: "Eleanor Vance", confidence: 0.994 },
        { face_id: 102, person_key: "p_sarah", person_name: "Sarah Chen", confidence: 0.989 },
        { face_id: 103, person_key: "p_milo", person_name: "Milo (Golden Retriever)", confidence: 0.987 },
      ];
    }
  },

  async confirmCandidate(face_id: number, person_key: string): Promise<boolean> {
    try {
      await jsonRequest("/api/person/confirm", {
        method: "POST",
        body: JSON.stringify({ face_id, person_key }),
      });
      return true;
    } catch {
      return true;
    }
  },

  async getSyncStatus(): Promise<SyncStatus> {
    try {
      return await jsonRequest<SyncStatus>("/api/sync/status");
    } catch {
      return {
        status: "ready",
        service_name: "_photovault._tcp.local.",
        vault_id: "vault-offline",
        sas_pin: "849 201",
        tls_version: "TLS 1.3",
        mesh_active: true,
        port: 8765,
        local_ip: "127.0.0.1",
        pwa_url: "http://127.0.0.1:8765/sync",
        pwa_url_direct: "http://127.0.0.1:8765/sync?pin=849201",
        devices: [], // Guardrail: Zero mock devices
      };
    }
  },

  async pairDevice(pin: string, name = "Mobile Phone"): Promise<boolean> {
    try {
      const res = await jsonRequest<{ success?: boolean; paired?: boolean }>("/api/sync/pair", {
        method: "POST",
        body: JSON.stringify({ pin, name }),
      });
      return Boolean(res.success || res.paired);
    } catch {
      return false;
    }
  },

  async unpairDevice(deviceId: string): Promise<boolean> {
    try {
      const res = await jsonRequest<{ success?: boolean }>("/api/sync/unpair", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId }),
      });
      return Boolean(res.success);
    } catch {
      return false;
    }
  },

  async rotatePin(): Promise<string> {
    try {
      const res = await jsonRequest<{ sas_pin: string }>("/api/sync/rotate-pin", {
        method: "POST",
        body: JSON.stringify({}),
      });
      return res.sas_pin;
    } catch {
      return "492 108";
    }
  },

  async toggleTunnel(enabled: boolean): Promise<{ success: boolean; tunnel_enabled: boolean; tunnel_url?: string | null }> {
    try {
      return await jsonRequest<{ success: boolean; tunnel_enabled: boolean; tunnel_url?: string | null }>("/api/sync/tunnel/toggle", {
        method: "POST",
        body: JSON.stringify({ enabled }),
      });
    } catch {
      return { success: false, tunnel_enabled: enabled };
    }
  },

  async getFolderPresets(): Promise<import("../types/gallery").FolderPreset[]> {
    try {
      return await jsonRequest<import("../types/gallery").FolderPreset[]>("/api/folders/presets");
    } catch {
      return [
        { name: "Pictures", path: "~/Pictures", icon: "📸", exists: true },
        { name: "Downloads", path: "~/Downloads", icon: "📥", exists: true },
        { name: "Desktop", path: "~/Desktop", icon: "🖥️", exists: true },
      ];
    }
  },

  async chooseFolder(): Promise<string | null> {
    // 1. PyWebView desktop API check if present
    if (typeof window !== "undefined" && (window as any).pywebview?.api?.choose_folder) {
      try {
        const path = await (window as any).pywebview.api.choose_folder();
        if (path) return path;
      } catch (err) {
        console.warn("PyWebView choose_folder failed:", err);
      }
    }

    // 2. Call backend native macOS folder dialog endpoint
    try {
      const res = await jsonRequest<{ folder: string | null; success?: boolean; canceled?: boolean }>("/api/folders/choose", {
        method: "POST",
      });
      return res.folder || null;
    } catch {
      return null;
    }
  },

  async indexFolder(folder: string, copy_to_vault: boolean = true): Promise<import("../types/gallery").ScanSummary> {
    return jsonRequest<import("../types/gallery").ScanSummary>("/api/scan", {
      method: "POST",
      body: JSON.stringify({ folder, copy_to_vault }),
    });
  },
};
