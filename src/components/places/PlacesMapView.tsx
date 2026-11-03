import React, { useState } from "react";
import { MapPin } from "../../types/gallery";

interface PlacesMapViewProps {
  pins: MapPin[];
  onSelectPinPhoto?: (photoId: number) => void;
}

export const PlacesMapView: React.FC<PlacesMapViewProps> = ({ pins, onSelectPinPhoto }) => {
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(pins[0] || null);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none relative bg-[var(--canvas-bg)]">
      {/* Places Header Stats */}
      <div className="absolute top-4 left-4 z-10 p-3 rounded-xl bg-[var(--glass-card)]/90 backdrop-blur-md border border-[var(--glass-border)] shadow-md flex items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-[var(--text-main)]">Places Explorer</div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {pins.length} Geocoded Hotspots · Global GPS Pins
          </div>
        </div>
      </div>

      {/* Interactive Vector Canvas Simulation */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* World Map Grid SVG Background */}
        <svg
          className="w-full h-full opacity-20 dark:opacity-30 pointer-events-none"
          viewBox="0 0 1000 600"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {/* Stylized continent outlines */}
          <path
            d="M 150 150 Q 250 80 400 120 T 550 200 T 800 150 T 900 250 T 750 450 T 400 400 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Map Pins */}
        <div className="absolute inset-0 flex items-center justify-center">
          {pins.map((pin, idx) => {
            // Distribute sample pins visually on the canvas
            const offsets = [
              { top: "35%", left: "75%" }, // Tokyo
              { top: "38%", left: "22%" }, // San Francisco
              { top: "42%", left: "70%" }, // Kyoto
              { top: "28%", left: "52%" }, // Dolomites
            ];
            const pos = offsets[idx % offsets.length];
            const isSelected = selectedPin?.id === pin.id;

            return (
              <div
                key={pin.id}
                style={{ top: pos.top, left: pos.left }}
                onClick={() => setSelectedPin(pin)}
                className={`absolute cursor-pointer -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-all ${
                  isSelected ? "scale-125 z-20" : "hover:scale-110 z-10"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full border-2 p-0.5 shadow-lg flex items-center justify-center overflow-hidden transition-all ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)] ring-4 ring-[var(--accent-glow)]"
                      : "border-white bg-[var(--glass-card)]"
                  }`}
                >
                  <img
                    src={pin.thumb}
                    alt=""
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=80&auto=format&fit=crop&q=80";
                    }}
                  />
                </div>
                <div className="mt-1 px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight shadow">
                  {pin.city.split(",")[0]} ({pin.count})
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Pin Telemetry Card */}
      {selectedPin && (
        <div className="absolute bottom-6 left-6 right-6 max-w-lg mx-auto z-20 p-4 rounded-2xl bg-[var(--glass-card)]/95 backdrop-blur-xl border border-[var(--glass-border)] shadow-xl flex gap-4 items-center">
          <img
            src={selectedPin.thumb}
            alt={selectedPin.name}
            className="w-24 h-24 rounded-xl object-cover bg-black/10 flex-shrink-0 cursor-pointer shadow-sm hover:opacity-90"
            onClick={() => onSelectPinPhoto?.(selectedPin.id)}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=240&auto=format&fit=crop&q=80";
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--text-main)] truncate">
                {selectedPin.name}
              </h4>
              {selectedPin.is_favorite && <span className="text-amber-500 text-xs">★ Favorited</span>}
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-2">{selectedPin.city}</p>
            <div className="space-y-1 text-[11px] text-[var(--text-secondary)] font-mono">
              <div>📍 {selectedPin.lat.toFixed(4)}° N, {selectedPin.lng.toFixed(4)}° E</div>
              <div>📷 {selectedPin.camera}</div>
              <div>⚡ {selectedPin.exposure}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
