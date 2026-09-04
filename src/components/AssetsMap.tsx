import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { sectorColor, riskColor } from "@/lib/demo-data";

export type MapAsset = {
  id: string;
  name: string;
  sector: string;
  lat: number;
  lon: number;
  composite_now?: number | null;
  composite_2050?: number | null;
};

function FitBounds({ assets }: { assets: MapAsset[] }) {
  const map = useMap();
  useEffect(() => {
    if (assets.length === 0) return;
    const bounds = L.latLngBounds(assets.map((a) => [a.lat, a.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
  }, [assets, map]);
  return null;
}

export function AssetsMap({
  assets,
  colorBy = "sector",
  onSelect,
}: {
  assets: MapAsset[];
  colorBy?: "sector" | "risk_now" | "risk_2050";
  onSelect?: (id: string) => void;
}) {
  const center = useMemo<[number, number]>(() => {
    if (assets.length === 0) return [20, 0];
    const lat = assets.reduce((s, a) => s + a.lat, 0) / assets.length;
    const lon = assets.reduce((s, a) => s + a.lon, 0) / assets.length;
    return [lat, lon];
  }, [assets]);

  const mapRef = useRef<L.Map | null>(null);

  return (
    <MapContainer center={center} zoom={2} ref={mapRef} scrollWheelZoom className="rounded-lg overflow-hidden">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds assets={assets} />
      {assets.map((a) => {
        const color =
          colorBy === "sector"
            ? sectorColor(a.sector)
            : colorBy === "risk_now"
            ? riskColor(a.composite_now)
            : riskColor(a.composite_2050);
        return (
          <CircleMarker
            key={a.id}
            center={[a.lat, a.lon]}
            radius={9}
            pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.95 }}
            eventHandlers={{ click: () => onSelect?.(a.id) }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{a.name}</div>
                <div className="text-xs text-slate-600 capitalize">{a.sector}</div>
                {a.composite_now != null && (
                  <div className="text-xs mt-1">
                    Risk now: <b>{a.composite_now}</b> · 2050: <b>{a.composite_2050}</b>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
