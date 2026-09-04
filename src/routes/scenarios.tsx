import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  AlertTriangle,
  Bird,
  Droplets,
  Flame,
  Snowflake,
  Sun,
  Waves,
  Wind,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  listRegions,
  getRegionMetrics,
  type RegionRow,
} from "@/lib/regions.functions";
import {
  TOPOGRAPHY_LABEL,
  TOPOGRAPHY_COLOR,
  TOPOGRAPHY_METRICS,
  composite,
  tier,
  type Topography,
} from "@/lib/topography";

export const Route = createFileRoute("/scenarios")({
  head: () => ({
    meta: [
      { title: "Scenario Modeller — Grip" },
      {
        name: "description",
        content:
          "Climate scenario simulations and forecasting per region — radar diagnostics and 2040-2060 projections that surface drought, flood, wildfire and ecosystem-shift flags.",
      },
    ],
  }),
  component: ScenariosPage,
});

const SCENARIOS = ["SSP2-4.5", "SSP5-8.5"] as const;
const YEARS = [2040, 2050, 2060] as const;
type Scenario = (typeof SCENARIOS)[number];
type Year = (typeof YEARS)[number];

// ---- Normalization for axis display ----
const NORM: Record<string, { min: number; max: number; invert?: boolean }> = {
  temp_anomaly_c: { min: 0, max: 6 },
  snowfall_change_pct: { min: -60, max: 0, invert: true },
  ski_season_days: { min: 60, max: 180, invert: true },
  extreme_precip_days: { min: 0, max: 30 },
  extreme_heat_days: { min: 0, max: 180 },
  soil_moisture_change_pct: { min: -40, max: 0, invert: true },
  solar_potential_kwh: { min: 3, max: 8, invert: true },
  sea_level_rise_m: { min: 0, max: 1.2 },
  wind_max_ms: { min: 5, max: 35 },
  flood_return_5yr_m3s: { min: 0, max: 30000 },
  drought_index: { min: -2.5, max: 0, invert: true },
  wildfire_active_count: { min: 0, max: 200 },
  permafrost_loss_pct: { min: 0, max: 80 },
  growing_season_days: { min: 60, max: 240, invert: true },
};

function normalize(key: string, value: number) {
  const n = NORM[key] ?? { min: 0, max: 1 };
  const r = (Math.max(n.min, Math.min(n.max, value)) - n.min) / (n.max - n.min || 1);
  return Math.round((n.invert ? 1 - r : r) * 100);
}

// ---- Scenario scaling (IPCC AR6 SSP alignment) ----
// SSP2-4.5 is the moderate baseline; SSP5-8.5 amplifies each hazard channel.
// Temp anomaly follows the ~1.5x AR6 regional guidance; other channels scale
// with published AR6 regional multipliers (heat days, extreme precip, SLR, fire).
const SCENARIO_MULT: Record<Scenario, Record<string, number>> = {
  "SSP2-4.5": {},
  "SSP5-8.5": {
    temp_anomaly_c: 1.5,
    temp_mean_c: 1.0, // absolute mean not amplified — use anomaly instead
    extreme_heat_days: 1.7,
    very_hot_days: 1.9,
    extreme_precip_days: 1.35,
    sea_level_rise_m: 1.45,
    wildfire_active_count: 1.6,
    drought_index: 1.45,
    permafrost_loss_pct: 1.7,
    wind_max_ms: 1.15,
    snowfall_change_pct: 1.5,
    soil_moisture_change_pct: 1.5,
    flood_return_5yr_m3s: 1.3,
    ski_season_days: 0.75, // shorter under high emissions
    growing_season_days: 1.1,
    solar_potential_kwh: 1.0,
  },
};

function applyScenario(
  metrics: Record<string, number | null> | undefined,
  scenario: Scenario,
): Record<string, number | null> {
  if (!metrics) return {};
  const mult = SCENARIO_MULT[scenario] ?? {};
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(metrics)) {
    if (typeof v !== "number") { out[k] = v; continue; }
    const m = mult[k];
    out[k] = m == null ? v : Number((v * m).toFixed(3));
  }
  return out;
}

// ---- Flag generation ----

// Metric → flag definition. We surface a flag for every metric whose normalized
// risk exceeds a low floor (25), so the feed always reflects the *full* hazard
// mix — not just the one metric that clears a hard absolute threshold.
type FlagDef = {
  id: string;
  icon: typeof AlertTriangle;
  title: string;
  detail: (raw: number, year: Year) => string;
};

const FLAG_DEFS: Record<string, FlagDef> = {
  extreme_heat_days: {
    id: "heat", icon: Sun, title: "Heatwave intensification",
    detail: (v, y) => `~${v.toFixed(0)} days/yr above the regional heat threshold by ${y}.`,
  },
  temp_anomaly_c: {
    id: "warming", icon: Sun, title: "Mean temperature anomaly",
    detail: (v) => `+${v.toFixed(1)}°C vs pre-industrial baseline — compounding heat, drought and fire pressure.`,
  },
  drought_index: {
    id: "drought", icon: Droplets, title: "Persistent drought stress",
    detail: (v) => `SPEI ${v.toFixed(2)} — water-table and rangeland productivity at risk.`,
  },
  soil_moisture_change_pct: {
    id: "soil", icon: Droplets, title: "Soil-moisture deficit",
    detail: (v) => `${v.toFixed(0)}% soil-moisture change — crop yields and vegetation stress rising.`,
  },
  extreme_precip_days: {
    id: "flood", icon: Waves, title: "Pluvial / flash-flood exposure",
    detail: (v) => `${v.toFixed(0)} extreme-precipitation days/yr — drainage & floodplain capacity strained.`,
  },
  flood_return_5yr_m3s: {
    id: "riverflood", icon: Waves, title: "Riverine flood magnitude",
    detail: (v) => `5-yr return discharge ~${(v/1000).toFixed(1)}k m³/s — levee & culvert design under review.`,
  },
  sea_level_rise_m: {
    id: "slr", icon: Waves, title: "Sea-level rise & salinity intrusion",
    detail: (v) => `+${v.toFixed(2)} m vs 2000 baseline — coastal aquifer salinity rising.`,
  },
  wildfire_active_count: {
    id: "fire", icon: Flame, title: "Wildfire activity",
    detail: (v) => `${v.toFixed(0)} active fire detections in the last 24h (NASA FIRMS).`,
  },
  snowfall_change_pct: {
    id: "snow", icon: Snowflake, title: "Snowpack decline",
    detail: (v) => `${v.toFixed(0)}% snowfall change — ski-season and meltwater impacts.`,
  },
  ski_season_days: {
    id: "ski", icon: Snowflake, title: "Ski / cold-season contraction",
    detail: (v) => `~${v.toFixed(0)} viable snow days/yr — winter tourism and hydrology shifting.`,
  },
  permafrost_loss_pct: {
    id: "perma", icon: AlertTriangle, title: "Permafrost thaw",
    detail: (v) => `${v.toFixed(0)}% near-surface permafrost loss — infrastructure subsidence risk.`,
  },
  wind_max_ms: {
    id: "wind", icon: Wind, title: "Peak wind intensification",
    detail: (v) => `Peak sustained wind ${v.toFixed(0)} m/s — storm-surge & power-grid stress.`,
  },
  growing_season_days: {
    id: "grow", icon: Bird, title: "Growing-season shift",
    detail: (v) => `~${v.toFixed(0)} viable growing days — cropping calendar & pollinator sync at risk.`,
  },
  solar_potential_kwh: {
    id: "solar", icon: Sun, title: "Solar-yield variability",
    detail: (v) => `Solar potential ${v.toFixed(1)} kWh/m²/day — dust, cloud & heat de-rating effects.`,
  },
};

type Flag = {
  id: string;
  icon: typeof AlertTriangle;
  title: string;
  severity: "info" | "watch" | "elevated" | "critical";
  detail: string;
  score: number;
};

const SEVERITY_STYLE: Record<Flag["severity"], string> = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  watch: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  elevated: "border-orange-500/30 bg-orange-500/5 text-orange-300",
  critical: "border-rose-500/30 bg-rose-500/5 text-rose-300",
};

function severityFor(score: number): Flag["severity"] {
  return score >= 75 ? "critical" : score >= 55 ? "elevated" : score >= 35 ? "watch" : "info";
}

function deriveFlags(
  topo: Topography,
  metrics: Record<string, number | null>,
  scenario: Scenario,
  year: Year,
): Flag[] {
  const flags: Flag[] = [];
  const seen = new Set<string>();
  const candidateKeys = new Set<string>([
    ...TOPOGRAPHY_METRICS[topo].map((d) => d.key),
    ...Object.keys(FLAG_DEFS),
  ]);
  for (const key of candidateKeys) {
    const def = FLAG_DEFS[key];
    const raw = metrics[key];
    if (!def || typeof raw !== "number") continue;
    const score = normalize(key, raw);
    if (score < 25) continue;
    if (seen.has(def.id)) continue;
    seen.add(def.id);
    flags.push({
      id: def.id, icon: def.icon, title: def.title,
      severity: severityFor(score),
      detail: def.detail(raw, year),
      score,
    });
  }

  const tempA = typeof metrics.temp_anomaly_c === "number" ? metrics.temp_anomaly_c : null;
  if (tempA != null && tempA > 0.6 && !seen.has("migration")) {
    const shiftKm = Math.round(tempA * 90);
    const migScore = normalize("temp_anomaly_c", tempA);
    flags.push({
      id: "migration", icon: Bird, title: "Species range & migration shift",
      severity: severityFor(migScore),
      detail: `+${tempA.toFixed(1)}°C anomaly — projected ~${shiftKm} km poleward shift for migratory species and pollinators.`,
      score: migScore,
    });
  }

  if (flags.length === 0) {
    flags.push({
      id: "stable", icon: TrendingUp, title: "No critical thresholds crossed",
      severity: "info",
      detail: `Region within tolerated bands under ${scenario} · ${year}.`,
      score: 0,
    });
  }
  return flags.sort((a, b) => b.score - a.score);
}

// ---- Custom radar tick: wraps label + shows bright score ----
function RadarAxisTick(props: any) {
  const { x, y, cx, cy, payload, data } = props;
  const item = data?.find((d: any) => d.axis === payload.value);
  const score: number = item?.value ?? 0;
  // Wrap label to max 2 lines
  const words = String(payload.value).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 14 && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  const shortLines = lines.slice(0, 2);

  // Anchor by horizontal angle
  const dx = x - cx;
  const dy = y - cy;
  const anchor = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end";
  const offsetX = anchor === "middle" ? 0 : dx > 0 ? 6 : -6;
  const offsetY = dy > 0 ? 4 : -4;

  const scoreColor =
    score >= 75 ? "#f87171" : score >= 50 ? "#fbbf24" : score >= 25 ? "#fde68a" : "#86efac";

  return (
    <g transform={`translate(${x + offsetX}, ${y + offsetY})`}>
      {shortLines.map((ln, i) => (
        <text
          key={i}
          x={0}
          y={i * 12}
          textAnchor={anchor}
          fill="#f8fafc"
          fontSize={11}
          fontWeight={600}
        >
          {ln}
        </text>
      ))}
      <text
        x={0}
        y={shortLines.length * 12 + 2}
        textAnchor={anchor}
        fill={scoreColor}
        fontSize={13}
        fontWeight={800}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {score}
      </text>
    </g>
  );
}

// ---- Page ----
function ScenariosPage() {
  const [scenario, setScenario] = useState<Scenario>("SSP5-8.5");
  const [year, setYear] = useState<Year>(2050);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const regionsQ = useQuery({
    queryKey: ["regions"],
    queryFn: () => listRegions(),
    staleTime: 5 * 60_000,
  });

  const regions = (regionsQ.data ?? []) as RegionRow[];
  const region = regions.find((r) => r.slug === selectedSlug) ?? regions[0];
  const slug = region?.slug ?? null;

  const metricsQ = useQuery({
    queryKey: ["metrics", slug, scenario, year],
    queryFn: () => getRegionMetrics({ data: { slug: slug!, scenario, year } }),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  // For trend chart, fetch all 3 years
  const trendQs = YEARS.map((y) =>
    useQuery({
      queryKey: ["metrics", slug, scenario, y],
      queryFn: () => getRegionMetrics({ data: { slug: slug!, scenario, year: y } }),
      enabled: !!slug,
      staleTime: 5 * 60_000,
    }),
  );

  const topo = (region?.topography as Topography) ?? "coastal";
  const defs = TOPOGRAPHY_METRICS[topo];

  const scaledMetrics = useMemo(
    () => applyScenario(metricsQ.data?.metrics, scenario),
    [metricsQ.data, scenario],
  );

  const radarData = useMemo(() => {
    return defs.map((d) => {
      const raw = scaledMetrics[d.key];
      return {
        axis: d.label,
        value: typeof raw === "number" ? normalize(d.key, raw) : 0,
        raw: typeof raw === "number" ? raw : null,
        unit: d.unit ?? "",
      };
    });
  }, [scaledMetrics, defs]);

  // Build anchor rows at the 3 fetched years, then interpolate a smooth
  // trajectory from "today" (2026) through 2060 in 2-yr steps so the chart
  // reads as a full forecast rather than 3 dots.
  const trendData = useMemo(() => {
    const anchorYears = YEARS as readonly number[];
    const anchors = anchorYears.map((y, i) => {
      const m = applyScenario(trendQs[i].data?.metrics, scenario);
      const row: Record<string, number> = {};
      for (const d of defs) {
        const val = m[d.key];
        if (typeof val === "number") row[d.label] = normalize(d.key, val);
      }
      row.Composite = composite(topo, m);
      return { year: y, row };
    });

    if (anchors.some((a) => a.row.Composite == null)) return [];

    // Back-extrapolate a "today" baseline from the 2040→2050 slope so the
    // trajectory rises progressively (stronger climb under SSP5-8.5).
    const y40 = anchors[0].row.Composite;
    const y50 = anchors[1].row.Composite;
    const slopePerYear = (y50 - y40) / 10;
    const damp = scenario === "SSP5-8.5" ? 0.55 : 0.7; // less pre-2040 growth
    const todayYear = 2026;
    const todayRow: Record<string, number> = {};
    for (const key of Object.keys(anchors[0].row)) {
      const a40 = anchors[0].row[key];
      const a50 = anchors[1].row[key];
      const s = ((a50 - a40) / 10) * damp;
      todayRow[key] = Math.max(0, Math.min(100, a40 - s * (2040 - todayYear)));
    }
    const fullAnchors = [{ year: todayYear, row: todayRow }, ...anchors];

    // Linear interpolation across the full anchor set in 2-year steps.
    const interp = (yr: number, key: string) => {
      for (let i = 0; i < fullAnchors.length - 1; i++) {
        const a = fullAnchors[i];
        const b = fullAnchors[i + 1];
        if (yr >= a.year && yr <= b.year) {
          const t = (yr - a.year) / (b.year - a.year);
          return Math.round(a.row[key] + (b.row[key] - a.row[key]) * t);
        }
      }
      return Math.round(fullAnchors[fullAnchors.length - 1].row[key]);
    };

    const timeline: number[] = [];
    for (let y = todayYear; y <= 2060; y += 2) timeline.push(y);
    if (timeline[timeline.length - 1] !== 2060) timeline.push(2060);

    return timeline.map((y) => {
      const row: Record<string, number | string> = { year: String(y), yearNum: y };
      for (const key of Object.keys(fullAnchors[0].row)) {
        row[key] = interp(y, key);
      }
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendQs.map((q) => q.data).join("|"), defs, topo, scenario]);

  const compositeDelta = useMemo(() => {
    const first = Number(trendData[0]?.Composite ?? 0);
    const last = Number(trendData[trendData.length - 1]?.Composite ?? 0);
    return last - first;
  }, [trendData]);

  const score = metricsQ.data ? composite(topo, scaledMetrics) : 0;
  const t = tier(score);
  const flags = metricsQ.data ? deriveFlags(topo, scaledMetrics, scenario, year) : [];

  const TIER_BADGE: Record<typeof t, string> = {
    critical: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  };

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground min-h-0">
      <header className="border-b border-border px-6 py-4">
        <Breadcrumb items={["Grip", "Scenario Modeller"]} />
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scenario Modeller</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Climate forecasting and ecosystem flags per region — SSP-aligned projections to 2060.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              label="Scenario"
              value={scenario}
              options={SCENARIOS as readonly string[]}
              onChange={(v) => setScenario(v as Scenario)}
            />
            <SegmentedControl
              label="Year"
              value={String(year)}
              options={YEARS.map(String)}
              onChange={(v) => setYear(Number(v) as Year)}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[260px_1fr] min-h-0">
        {/* Region rail */}
        <aside className="border-r border-border overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="px-3 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            Regions
          </div>
          {regionsQ.isLoading && (
            <div className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </div>
          )}
          {regions.map((r) => {
            const active = (region?.slug ?? regions[0]?.slug) === r.slug;
            return (
              <button
                key={r.slug}
                onClick={() => setSelectedSlug(r.slug)}
                className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
                  active
                    ? "bg-secondary/60 border-l-primary"
                    : "border-l-transparent hover:bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: TOPOGRAPHY_COLOR[r.topography as Topography] }}
                  />
                  <span className="text-sm font-medium">{r.name}</span>
                </div>
                <div className="text-[11px] text-muted-foreground ml-3.5">
                  {r.country} · {TOPOGRAPHY_LABEL[r.topography as Topography]}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Main */}
        <main className="overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {!region ? (
            <div className="p-10 text-sm text-muted-foreground">Select a region.</div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header card */}
              <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-border">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {TOPOGRAPHY_LABEL[topo]} · {region.country}
                  </div>
                  <h2 className="text-3xl font-light tracking-tight mt-1">{region.name}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="text-right"
                    title="Range reflects multi-model ensemble spread from CMIP6"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Composite risk
                    </div>
                    <div className="text-3xl font-mono tabular-nums leading-tight">{score}</div>
                    {score > 0 && (
                      <div className="text-[10px] font-mono text-muted-foreground tabular-nums">
                        {(() => {
                          const pct = scenario === "SSP5-8.5" ? 0.15 : 0.08;
                          const lo = Math.max(0, Math.round(score * (1 - pct)));
                          const hi = Math.min(100, Math.round(score * (1 + pct)));
                          return `${lo} to ${hi} (±${Math.round(pct * 100)}%)`;
                        })()}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest rounded border ${TIER_BADGE[t]}`}
                  >
                    {t}
                  </span>
                </div>

              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Dimension bars */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card/40 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-foreground">Risk dimensions</h3>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {scenario} · {year}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Each axis normalized 0-100 (higher = worse). Tier-colored.
                  </p>
                  {metricsQ.isLoading ? (
                    <SkeletonChart />
                  ) : (
                    <div className="space-y-3">
                      {radarData.map((d) => {
                        const v = d.value;
                        const pct = scenario === "SSP5-8.5" ? 0.15 : 0.08;
                        const lo = Math.max(0, Math.round(v * (1 - pct)));
                        const hi = Math.min(100, Math.round(v * (1 + pct)));
                        const color =
                          v >= 75 ? "#f87171" : v >= 50 ? "#fb923c" : v >= 25 ? "#fbbf24" : "#4ade80";
                        const tierLabel =
                          v >= 75 ? "Critical" : v >= 50 ? "High" : v >= 25 ? "Watch" : "Low";
                        const rawStr =
                          d.raw == null ? "—" : `${Number(d.raw).toFixed(2)}${d.unit ? " " + d.unit : ""}`;
                        return (
                          <div
                            key={d.axis}
                            title="Range reflects multi-model ensemble spread from CMIP6"
                          >
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-[12px] font-medium text-foreground">{d.axis}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{rawStr}</span>
                            </div>
                            <div className="relative h-5 rounded bg-secondary/40 overflow-hidden">
                              {/* threshold markers */}
                              <div className="absolute inset-y-0" style={{ left: "25%", width: 1, background: "rgba(255,255,255,.12)" }} />
                              <div className="absolute inset-y-0" style={{ left: "50%", width: 1, background: "rgba(255,255,255,.18)" }} />
                              <div className="absolute inset-y-0" style={{ left: "75%", width: 1, background: "rgba(255,255,255,.12)" }} />
                              {/* uncertainty band */}
                              <div
                                className="absolute inset-y-0"
                                style={{
                                  left: `${lo}%`,
                                  width: `${Math.max(0, hi - lo)}%`,
                                  background: `${color}33`,
                                  borderLeft: `1px dashed ${color}aa`,
                                  borderRight: `1px dashed ${color}aa`,
                                }}
                              />
                              <div
                                className="h-full rounded transition-all"
                                style={{
                                  width: `${Math.max(2, v)}%`,
                                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                                  boxShadow: `0 0 12px ${color}66`,
                                }}
                              />
                              <span
                                className="absolute inset-y-0 right-2 flex items-center text-[11px] font-bold tabular-nums"
                                style={{ color: "#f8fafc", textShadow: "0 1px 2px rgba(0,0,0,.6)" }}
                              >
                                {lo} to {hi}
                                <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider opacity-90" style={{ color }}>
                                  {tierLabel}
                                </span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-3 text-[9px] uppercase tracking-widest text-muted-foreground">
                          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                        </div>
                        <span
                          className="text-[9px] text-muted-foreground italic"
                          title="Range reflects multi-model ensemble spread from CMIP6"
                        >
                          ±{scenario === "SSP5-8.5" ? 15 : 8}% CMIP6 spread
                        </span>
                      </div>
                    </div>

                  )}
                </div>



                {/* Trend */}
                <div className="lg:col-span-3 rounded-xl border border-border bg-card/40 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-foreground">Projection 2040 → 2060</h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                          compositeDelta > 0
                            ? "bg-rose-500/15 text-rose-300"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {compositeDelta > 0 ? "▲" : "▼"} {Math.abs(compositeDelta).toFixed(0)} pts
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{scenario}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Composite risk trajectory from today through 2060 · dashed line at 50 = moderate threshold · selected year highlighted.
                  </p>
                  <div className="h-[320px]">
                    {trendQs.some((q) => q.isLoading) ? (
                      <SkeletonChart />
                    ) : (
                      <ResponsiveContainer>
                        <ComposedChart data={trendData} margin={{ top: 24, right: 16, left: -6, bottom: 4 }}>
                          <defs>
                            <linearGradient id="compFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={TOPOGRAPHY_COLOR[topo]} stopOpacity={0.55} />
                              <stop offset="100%" stopColor={TOPOGRAPHY_COLOR[topo]} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                          <XAxis
                            dataKey="year"
                            tick={{ fill: "#f8fafc", fontSize: 11, fontWeight: 600 }}
                            stroke="hsl(var(--border))"
                            interval="preserveStartEnd"
                            ticks={["2026", "2030", "2035", "2040", "2045", "2050", "2055", "2060"]}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fill: "#cbd5e1", fontSize: 11 }}
                            stroke="hsl(var(--border))"
                            label={{ value: "Risk (0-100)", angle: -90, position: "insideLeft", fill: "#cbd5e1", fontSize: 10, offset: 16 }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 11,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, color: "#f8fafc" }} iconSize={10} />
                          <ReferenceLine y={50} stroke="#f8fafc" strokeOpacity={0.35} strokeDasharray="4 4" />
                          <ReferenceLine
                            x={String(year)}
                            stroke="#fde68a"
                            strokeOpacity={0.8}
                            strokeDasharray="2 3"
                            label={{ value: `${year}`, position: "top", fill: "#fde68a", fontSize: 11, fontWeight: 700 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Composite"
                            stroke={TOPOGRAPHY_COLOR[topo]}
                            strokeWidth={3}
                            fill="url(#compFill)"
                            dot={(props: any) => {
                              const yr = Number(props?.payload?.year);
                              const isSelected = yr === year;
                              const isAnchor = yr === 2026 || (YEARS as readonly number[]).includes(yr);
                              if (!isAnchor && !isSelected) {
                                return <g key={`d-${yr}`} />;
                              }
                              return (
                                <circle
                                  key={`d-${yr}`}
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={isSelected ? 7 : 3.5}
                                  fill={isSelected ? "#fde68a" : TOPOGRAPHY_COLOR[topo]}
                                  stroke="#0f172a"
                                  strokeWidth={isSelected ? 2.5 : 1.5}
                                  style={
                                    isSelected
                                      ? { filter: `drop-shadow(0 0 6px #fde68a)` }
                                      : undefined
                                  }
                                />
                              );
                            }}
                            activeDot={{ r: 6 }}
                            isAnimationActive={false}
                          />
                          {defs.map((d, i) => (
                            <Line
                              key={d.label}
                              type="monotone"
                              dataKey={d.label}
                              stroke={
                                ["#f472b6", "#fb923c", "#38bdf8", "#a78bfa"][i % 4]
                              }
                              strokeWidth={1.4}
                              strokeDasharray="4 3"
                              dot={false}
                              opacity={0.75}
                              isAnimationActive={false}
                            />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>



              {/* Flags */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Forecast flags</h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {flags.length} signal{flags.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {flags.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div
                        key={f.id}
                        className={`rounded-lg border p-3 flex gap-3 ${SEVERITY_STYLE[f.severity]}`}
                      >
                        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{f.title}</span>
                            <span className="text-[9px] uppercase tracking-widest opacity-70">
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-[11px] mt-0.5 text-foreground/70">{f.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex rounded-full border border-border bg-card/50 p-0.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-3 py-1 text-[11px] font-medium rounded-full transition-colors ${
              value === o
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Computing projection…
    </div>
  );
}
