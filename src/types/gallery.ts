export type ActiveView = "timeline" | "explorer" | "places" | "people";
export type TimeScale = "years" | "months" | "days" | "all";
export type ThemeMode = "light" | "dark";

export interface PhotoItem {
  id: number;
  path: string;
  file_name: string;
  original_extension?: string;
  size: number;
  mtime: number;
  width?: number;
  height?: number;
  camera_make?: string;
  camera_model?: string;
  lens_model?: string;
  focal_length_mm?: number;
  aperture_f_number?: number;
  shutter_speed_seconds?: string;
  iso_equivalent?: number;
  color_space?: string;
  captured_at?: number;
  latitude?: number;
  longitude?: number;
  altitude_meters?: number;
  location_name?: string;
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
  is_hidden: boolean;
  is_trashed: boolean;
  quality_score?: number;
  category: string;
  label?: string | null;
  thumb?: string;
  detected_faces?: FaceBox[];
  ocr_text?: string;
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
  tls_version: string;
  mesh_active: boolean;
  port: number;
  pwa_url: string;
  devices: SyncDevice[];
}
