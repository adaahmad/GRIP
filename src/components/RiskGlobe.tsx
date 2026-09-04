import { useEffect, useRef } from "react";
import Globe from "react-globe.gl";

export type GlobeHotspot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tier: "critical" | "high" | "medium";
  score: number;
  tag: string;
  /** optional override color (e.g. category color) */
  color?: string;
};

const TIER_COLOR: Record<GlobeHotspot["tier"], string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#eab308",
};

const colorOf = (h: GlobeHotspot) => h.color ?? TIER_COLOR[h.tier];

export function RiskGlobe({
  hotspots,
  selectedId,
  onSelect,
  width,
  height,
  ringMode = "critical",
}: {
  hotspots: GlobeHotspot[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  width: number;
  height: number;
  /** which hotspots get animated rings — default: critical only to reduce clutter */
  ringMode?: "all" | "critical" | "none";
}) {
  const globeRef = useRef<any>(null);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.35;
    g.controls().enableZoom = true;
    g.pointOfView({ lat: 20, lng: 30, altitude: 2.2 }, 0);
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !selectedId) return;
    const h = hotspots.find((x) => x.id === selectedId);
    if (!h) return;
    g.controls().autoRotate = false;
    g.pointOfView({ lat: h.lat, lng: h.lng, altitude: 1.6 }, 1200);
  }, [selectedId, hotspots]);

  const ringSource =
    ringMode === "none"
      ? []
      : ringMode === "critical"
        ? hotspots.filter((h) => h.tier === "critical")
        : hotspots;

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
      bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.22}
      hexBinPointsData={hotspots}
      hexBinPointLat={(d: any) => (d as GlobeHotspot).lat}
      hexBinPointLng={(d: any) => (d as GlobeHotspot).lng}
      hexBinPointWeight={(d: any) => (d as GlobeHotspot).score}
      hexBinResolution={4}
      hexBinMerge={false}
      hexMargin={0.25}
      hexAltitude={(bin: any) => 0.008 + Math.min(0.04, (bin?.sumWeight ?? 0) / 4000)}
      hexTopColor={() => "#3b82f6"}
      hexSideColor={() => "#1d4ed8"}
      pointsData={hotspots}
      pointLat="lat"
      pointLng="lng"
      pointColor={(d: any) => colorOf(d as GlobeHotspot)}
      pointAltitude={() => 0.025}
      pointRadius={() => 0.6}
      pointLabel={(d: any) => {
        const h = d as GlobeHotspot;
        const c = colorOf(h);
        return `<div style="background:rgba(10,12,20,.92);border:1px solid ${c};padding:6px 10px;border-radius:6px;color:#fff;font-size:12px;font-family:system-ui">
          <div style="font-weight:600">${h.name}</div>
          <div style="color:${c};font-size:10px;letter-spacing:.05em">${h.tag} · ${h.score}</div>
        </div>`;
      }}
      onPointClick={(d: any) => onSelect?.((d as GlobeHotspot).id)}
      ringsData={ringSource}
      ringLat="lat"
      ringLng="lng"
      ringColor={(d: any) => () => colorOf(d as GlobeHotspot)}
      ringMaxRadius={(d: any) => 2 + ((d as GlobeHotspot).score / 100) * 3}
      ringPropagationSpeed={1.6}
      ringRepeatPeriod={(d: any) => {
        const t = (d as GlobeHotspot).tier;
        return t === "critical" ? 1400 : t === "high" ? 2200 : 3000;
      }}
    />
  );
}
