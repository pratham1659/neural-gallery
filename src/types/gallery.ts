export type ActiveView = "timeline" | "explorer" | "places" | "people";
export type TimeScale = "years" | "months" | "days";
export type CatalogStyle = "list" | "small" | "medium" | "large";
export type ThemeMode = "light" | "dark";

export interface FolderItem {
  id: number;
  name: string;
  count: number;
  created_at: number;
  is_hidden?: boolean;
}

export interface VaultStorageInfo {
  vault_path: string;
  managed_ingest: boolean;
  is_external: boolean;
  is_ssd: boolean;
  free_bytes: number;
  total_bytes: number;
  free_formatted: string;
  total_formatted: string;
  file_count: number;
  total_size_bytes: number;
  total_size_formatted: string;
}

export interface PhotoItem {
  id: number;
  path: string;
  file_name: string;
  name?: string;
  original_extension?: string;
  size: number;
  mtime: number;
  width?: number;
  height?: number;
  camera_make?: string;
  camera_model?: string;
  lens_model?: string;
  focal_length_mm?: number;
  focal_length?: string;
  aperture_f_number?: number;
  f_number?: string;
  shutter_speed_seconds?: string;
  exposure_time?: string;
  iso_equivalent?: number;
  iso?: string;
  color_space?: string;
  captured_at?: number;
  created_at?: number;
  latitude?: number;
  longitude?: number;
  altitude_meters?: number;
  altitude?: number;
  location_name?: string;
  city?: string;
  country?: string;
  is_favorite: boolean;
  is_screenshot: boolean;
  is_video: boolean;
  duration_ms?: number;
  is_live_photo: boolean;
  is_portrait: boolean;
  is_raw: boolean;
  is_panorama: boolean;
  is_selfie: boolean;
  is_document: boolean;
  is_imported?: boolean;
  is_hidden: boolean;
  is_trashed: boolean;
  quality_score?: number;
  blur_score?: number;
  category: string;
  label?: string | null;
  thumb?: string;
  detected_faces?: FaceBox[];
  faces?: any[];
  ocr_text?: string;
  dup_count?: number;
  face_count?: number;
  person_names?: string;
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  confidence?: number;
}

export interface PersonGroup {
  key: string;
  name: string;
  count: number;
  is_pet: boolean;
  thumb?: string;
}

export interface CandidateFace {
  face_id: number;
  person_key: string;
  person_name: string;
  confidence: number;
  thumb?: string;
}

export interface MapPin {
  id: number;
  lat: number;
  lng: number;
  name: string;
  city: string;
  count: number;
  camera: string;
  exposure: string;
  is_favorite: boolean;
  thumb: string;
}

export interface LibraryStats {
  total: number;
  unlabeled: number;
  favorites: number;
  screenshots: number;
  videos: number;
  raw: number;
  portraits: number;
  live_photos: number;
  hidden: number;
  trashed: number;
  geocoded: number;
  duplicate_groups: number;
  faces: number;
  people: number;
  pets: number;
  candidates: number;
  keep: number;
  noise: number;
  panoramas?: number;
  documents?: number;
  shared_albums?: number;
  shared_with_you?: number;
  partner_sharing?: number;
  travel?: number;
  imports?: number;
  prores?: number;
  slomo?: number;
  timelapse?: number;
  screen_recordings?: number;
}

export interface SyncDevice {
  id: string;
  name: string;
  model: string;
  state: "nearby" | "pairing_requested" | "paired";
  last_sync: string;
  ip?: string;
}

export interface SyncStatus {
  status: string;
  service_name: string;
  vault_id: string;
  sas_pin: string;
  pin_expires_in?: number | null;
  pin_ttl?: number;
  tls_version: string;
  mesh_active: boolean;
  port: number;
  local_ip?: string;
  hostname?: string;
  tunnel_enabled?: boolean;
  tunnel_url?: string | null;
  pwa_url: string;
  pwa_url_direct?: string;
  pwa_url_hostname?: string;
  pwa_url_tunnel?: string | null;
  devices: SyncDevice[];
  last_sync?: {
    batch_id: string;
    count: number;
    timestamp: number;
    files: string[];
    total_synced: number;
  } | null;
}

export interface FolderPreset {
  name: string;
  path: string;
  icon: string;
  exists: boolean;
}

export interface ScanSummary {
  seen: number;
  added: number;
  updated: number;
  unchanged: number;
  unreadable: number;
  duplicate_groups: number;
}
