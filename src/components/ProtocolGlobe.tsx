import { useEffect, useMemo, useRef } from "react";
import Globe from "react-globe.gl";
import type { Hotspot, Arc } from "../routes/protocol";

const COLOR: Record<Hotspot["kind"], string> = {
  flood: "#38bdf8",
  heat: "#f97316",
  fire: "#ef4444",
  drought: "#eab308",
  sea_level: "#a78bfa",
  compound: "#ec4899",
};

const KIND_LABEL: Record<Hotspot["kind"], string> = {
  flood: "Flood",
  heat: "Heat",
  fire: "Fire",
  drought: "Drought",
  sea_level: "Sea Level",
  compound: "Compound",
};

const KIND_KEYS: Hotspot["kind"][] = ["heat", "flood", "fire", "drought", "sea_level", "compound"];

export type GlobeTexture = "terrain" | "satellite";

const TEXTURES: Record<GlobeTexture, string> = {
  terrain: "https://unpkg.com/three-globe/example/img/earth-day.jpg",
  satellite: "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
};

export function ProtocolGlobe({
  hotspots, arcs, selectedId, onSelect, width, height, offsetX, altitude, texture = "satellite",
}: {
  hotspots: Hotspot[];
  arcs: Arc[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  width: number;
  height: number;
  offsetX: number;
  altitude: number;
  texture?: GlobeTexture;
}) {
  const ref = useRef<any>(null);

  useEffect(() => {
    const g = ref.current; if (!g) return;
    g.controls().autoRotate = true;
    g.controls().autoRotateSpeed = 0.28;
    g.controls().enableZoom = true;
    g.pointOfView({ lat: 20, lng: 20, altitude }, 800);
  }, [altitude]);

  useEffect(() => {
    const g = ref.current; if (!g || !selectedId) return;
    const h = hotspots.find((x) => x.id === selectedId);
    if (!h) return;
    g.controls().autoRotate = false;
    g.pointOfView({ lat: h.lat, lng: h.lng, altitude: 1.6 }, 1200);
  }, [selectedId, hotspots]);

  const hexData = useMemo(
    () => hotspots.map((h) => ({ lat: h.lat, lng: h.lng, weight: h.score, kind: h.kind })),
    [hotspots]
  );
  // Pulsing rings on the top-severity physical risk signals.
  const rings = useMemo(
    () => hotspots.filter((h) => h.score >= 85),
    [hotspots]
  );
  const points = useMemo(() => hotspots, [hotspots]);

  const binKind = (bin: any): Hotspot["kind"] => {
    const pts: any[] = bin?.points ?? [];
    const tally: Record<Hotspot["kind"], number> = {
      heat: 0, flood: 0, fire: 0, drought: 0, sea_level: 0, compound: 0,
    };
    for (const p of pts) tally[p.kind as Hotspot["kind"]] = (tally[p.kind as Hotspot["kind"]] ?? 0) + 1;
    return (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] as Hotspot["kind"]) ?? "heat";
  };

  return (
    <div style={{ transform: `translateX(${offsetX}px)`, transition: "transform 600ms cubic-bezier(.22,.61,.36,1)" }}>
      <Globe
        ref={ref}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={TEXTURES[texture]}
        bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#5eead4"
        atmosphereAltitude={0.22}
        showGraticules={true}

        hexBinPointsData={hexData}
        hexBinPointLat={(d: any) => d.lat}
        hexBinPointLng={(d: any) => d.lng}
        hexBinPointWeight={(d: any) => d.weight}
        hexBinResolution={4}
        hexBinMerge={false}
        hexMargin={0.25}
        hexAltitude={0.01}
        hexTopColor={(bin: any) => COLOR[binKind(bin)]}
        hexSideColor={(bin: any) => COLOR[binKind(bin)]}
        hexLabel={(bin: any) => {
          const pts: any[] = bin?.points ?? [];
          const tally: Record<Hotspot["kind"], number> = {
            heat: 0, flood: 0, fire: 0, drought: 0, sea_level: 0, compound: 0,
          };
          for (const p of pts) tally[p.kind as Hotspot["kind"]] = (tally[p.kind as Hotspot["kind"]] ?? 0) + 1;
          const dom = binKind(bin);
          const total = pts.reduce((s, p) => s + (p.weight ?? 0), 0);
          const rows = KIND_KEYS
            .filter((k) => tally[k] > 0)
            .map((k) => `<span style="color:${COLOR[k]}">● ${KIND_LABEL[k]}</span><span style="text-align:right">${tally[k]}</span>`)
            .join("");
          return `<div style="background:rgba(10,15,13,.95);border:1px solid ${COLOR[dom]};padding:8px 10px;border-radius:4px;color:#d6e4dd;font:11px ui-monospace,Menlo,monospace;letter-spacing:.04em">
            <div style="color:${COLOR[dom]};font-weight:700;text-transform:uppercase;font-size:10px">${KIND_LABEL[dom]} cluster</div>
            <div style="margin-top:4px;color:#9aa6a0;font-size:10px">${pts.length} signal${pts.length === 1 ? "" : "s"} · Σ score ${total}</div>
            <div style="margin-top:6px;display:grid;grid-template-columns:auto auto;gap:2px 10px;font-size:10px">${rows}</div>
          </div>`;
        }}

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(d: any) => COLOR[(d as Hotspot).kind]}
        pointAltitude={() => 0.025}
        pointRadius={() => 0.6}
        pointLabel={(d: any) => {
          const h = d as Hotspot;
          return `<div style="background:rgba(10,15,13,.95);border:1px solid ${COLOR[h.kind]};padding:6px 10px;color:#d6e4dd;font:11px ui-monospace,Menlo,monospace;letter-spacing:.05em;text-transform:uppercase">
            <div style="font-weight:700">${h.name}</div>
            <div style="color:${COLOR[h.kind]};font-size:9px;margin-top:2px">${h.tag} · ${h.score}</div>
          </div>`;
        }}
        onPointClick={(d: any) => onSelect?.((d as Hotspot).id)}

        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={(d: any) => {
          const c = COLOR[(d as Hotspot).kind];
          return (t: number) => c + Math.floor((1 - t) * 255).toString(16).padStart(2, "0");
        }}
        ringMaxRadius={6}
        ringPropagationSpeed={2.5}
        ringRepeatPeriod={1600}
        ringAltitude={0.005}

        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ["rgba(96,165,250,0.05)", "rgba(96,165,250,0.95)", "rgba(96,165,250,0.05)"]}
        arcStroke={0.4}
        arcDashLength={0.45}
        arcDashGap={2.2}
        arcDashAnimateTime={3200}
        arcAltitudeAutoScale={0.45}
      />
    </div>
  );
}
