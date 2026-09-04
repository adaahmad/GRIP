import {
  HAZARD_CATEGORIES,
  METRIC_CATEGORY,
  CATEGORY_LABEL,
  COMPOUND_THRESHOLD,
  COMPOUND_MIN_CATEGORIES,
  type HazardCategory,
} from "./hazard-taxonomy";

export type Topography = "alpine" | "desert" | "coastal" | "tropical-delta" | "savanna" | "boreal";

export const TOPOGRAPHY_LABEL: Record<Topography, string> = {
  alpine: "Alpine",
  desert: "Desert",
  coastal: "Coastal",
  "tropical-delta": "Tropical Delta",
  savanna: "Savanna",
  boreal: "Boreal",
};

export const TOPOGRAPHY_COLOR: Record<Topography, string> = {
  alpine: "#7dd3fc",
  desert: "#f59e0b",
  coastal: "#22d3ee",
  "tropical-delta": "#84cc16",
  savanna: "#eab308",
  boreal: "#a78bfa",
};

export type MetricDef = {
  key: string;
  label: string;
  unit: string;
  /** higher value = worse risk */
  higherIsWorse: boolean;
  /** relative weight in composite */
  weight: number;
  /** description shown in tooltips */
  hint: string;
};

export const TOPOGRAPHY_METRICS: Record<Topography, MetricDef[]> = {
  alpine: [
    {
      key: "temp_anomaly_c",
      label: "Temperature anomaly",
      unit: "°C",
      higherIsWorse: true,
      weight: 1,
      hint: "Mean temperature change vs 1995-2014 baseline.",
    },
    {
      key: "snowfall_change_pct",
      label: "Snowfall change",
      unit: "%",
      higherIsWorse: false,
      weight: 1.2,
      hint: "Annual snowfall change — negative drives ski-season loss.",
    },
    {
      key: "ski_season_days",
      label: "Ski-season days",
      unit: "d",
      higherIsWorse: false,
      weight: 1,
      hint: "Days with reliable snow cover (>30cm).",
    },
    {
      key: "extreme_precip_days",
      label: "Extreme precip days",
      unit: "d/yr",
      higherIsWorse: true,
      weight: 0.8,
      hint: "Days >20mm — landslide / flash-flood proxy.",
    },
  ],
  desert: [
    {
      key: "extreme_heat_days",
      label: "Days ≥40 °C",
      unit: "d/yr",
      higherIsWorse: true,
      weight: 1.4,
      hint: "Annual days at or above 40 °C.",
    },
    {
      key: "temp_anomaly_c",
      label: "Temperature anomaly",
      unit: "°C",
      higherIsWorse: true,
      weight: 1,
      hint: "Mean temperature change vs baseline.",
    },
    {
      key: "soil_moisture_change_pct",
      label: "Soil moisture change",
      unit: "%",
      higherIsWorse: false,
      weight: 1.1,
      hint: "Root-zone soil moisture change.",
    },
  ],
  coastal: [
    {
      key: "sea_level_rise_m",
      label: "Sea-level rise",
      unit: "m",
      higherIsWorse: true,
      weight: 1.4,
      hint: "Projected SLR vs 2000 baseline (AR6 medium confidence).",
    },
    {
      key: "extreme_heat_days",
      label: "Days ≥35 °C",
      unit: "d/yr",
      higherIsWorse: true,
      weight: 0.9,
      hint: "Annual days at or above 35 °C.",
    },
    {
      key: "extreme_precip_days",
      label: "Extreme precip days",
      unit: "d/yr",
      higherIsWorse: true,
      weight: 1,
      hint: "Days >20mm — pluvial flood proxy.",
    },
    {
      key: "wind_max_ms",
      label: "Peak wind",
      unit: "m/s",
      higherIsWorse: true,
      weight: 0.9,
      hint: "Annual max sustained wind.",
    },
  ],
  "tropical-delta": [
    {
      key: "extreme_precip_days",
      label: "Extreme precip days",
      unit: "d/yr",
      higherIsWorse: true,
      weight: 1.3,
      hint: "Days >50mm — fluvial flood proxy.",
    },
    {
      key: "flood_return_5yr_m3s",
      label: "5-yr flood discharge",
      unit: "m³/s",
      higherIsWorse: true,
      weight: 1.2,
      hint: "Modeled 5-yr return river discharge.",
    },
    {
      key: "sea_level_rise_m",
      label: "Sea-level rise",
      unit: "m",
      higherIsWorse: true,
      weight: 1.1,
      hint: "Salinity intrusion driver.",
    },
    {
      key: "temp_anomaly_c",
      label: "Temperature anomaly",
      unit: "°C",
      higherIsWorse: true,
      weight: 0.8,
      hint: "Mean temperature change vs baseline.",
    },
  ],
  savanna: [
    {
      key: "drought_index",
      label: "Drought index",
      unit: "SPEI",
      higherIsWorse: true,
      weight: 1.3,
      hint: "Standardized precipitation-evapotranspiration deficit.",
    },
    {
      key: "extreme_heat_days",
      label: "Days ≥38 °C",
      unit: "d/yr",
      higherIsWorse: true,
      weight: 1,
      hint: "Annual days at or above 38 °C.",
    },
    {
      key: "wildfire_active_count",
      label: "Active fires (24h)",
      unit: "#",
      higherIsWorse: true,
      weight: 1.1,
      hint: "NASA FIRMS VIIRS active-fire detections.",
    },
    {
      key: "soil_moisture_change_pct",
      label: "Soil moisture change",
      unit: "%",
      higherIsWorse: false,
      weight: 1,
      hint: "Root-zone soil moisture change.",
    },
  ],
  boreal: [
    {
      key: "temp_anomaly_c",
      label: "Temperature anomaly",
      unit: "°C",
      higherIsWorse: true,
      weight: 1.3,
      hint: "Mean temperature change vs baseline (boreal amplifies).",
    },
    {
      key: "wildfire_active_count",
      label: "Active fires (24h)",
      unit: "#",
      higherIsWorse: true,
      weight: 1.2,
      hint: "NASA FIRMS VIIRS active-fire detections.",
    },
    {
      key: "permafrost_loss_pct",
      label: "Permafrost loss",
      unit: "%",
      higherIsWorse: true,
      weight: 1.4,
      hint: "Modeled near-surface permafrost extent loss.",
    },
  ],
};

/** Opportunity metrics: `higherIsWorse: false` upside indicators. Excluded
 *  from the hazard composite entirely (see hazard-taxonomy.ts) and scored
 *  separately via `opportunity()` below, so a sunny/long-season region
 *  can read as "moderate risk, high opportunity" instead of quietly
 *  reading as lower risk. */
export const TOPOGRAPHY_OPPORTUNITY_METRICS: Partial<Record<Topography, MetricDef[]>> = {
  desert: [
    {
      key: "solar_potential_kwh",
      label: "Solar potential",
      unit: "kWh/m²/d",
      higherIsWorse: false,
      weight: 1,
      hint: "GHI — adaptation upside via solar.",
    },
  ],
  boreal: [
    {
      key: "growing_season_days",
      label: "Growing season",
      unit: "d",
      higherIsWorse: false,
      weight: 1,
      hint: "Days >5 °C — agricultural upside.",
    },
  ],
};

export type MetricValue = number | null;
export type RegionMetrics = Record<string, MetricValue>;

const NORMALIZERS: Record<string, { min: number; max: number }> = {
  temp_anomaly_c: { min: 0, max: 6 },
  snowfall_change_pct: { min: -60, max: 0 }, // -60% -> worst
  ski_season_days: { min: 60, max: 180 }, // fewer is worse
  extreme_precip_days: { min: 0, max: 30 },
  extreme_heat_days: { min: 0, max: 180 },
  soil_moisture_change_pct: { min: -40, max: 0 },
  solar_potential_kwh: { min: 3, max: 8 },
  sea_level_rise_m: { min: 0, max: 1.2 },
  wind_max_ms: { min: 5, max: 35 },
  flood_return_5yr_m3s: { min: 0, max: 30000 },
  drought_index: { min: -2.5, max: 0 },
  wildfire_active_count: { min: 0, max: 200 },
  permafrost_loss_pct: { min: 0, max: 80 },
  growing_season_days: { min: 60, max: 240 },
};

function normalize(key: string, value: number, higherIsWorse: boolean) {
  const n = NORMALIZERS[key] ?? { min: 0, max: 1 };
  const clamped = Math.max(n.min, Math.min(n.max, value));
  const ratio = (clamped - n.min) / (n.max - n.min || 1);
  return higherIsWorse ? ratio : 1 - ratio;
}

export function composite(topography: Topography, metrics: RegionMetrics) {
  const defs = TOPOGRAPHY_METRICS[topography];
  let sum = 0;
  let wsum = 0;
  for (const d of defs) {
    const v = metrics[d.key];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    const n = normalize(d.key, v, d.higherIsWorse);
    sum += n * d.weight;
    wsum += d.weight;
  }
  if (wsum === 0) return 0;
  return Math.round((sum / wsum) * 100);
}

/** Opportunity score (0-100, higher = more upside) — solar/growing-season
 *  etc. Computed and shown separately from risk; never feeds composite(). */
export function opportunity(topography: Topography, metrics: RegionMetrics): number | null {
  const defs = TOPOGRAPHY_OPPORTUNITY_METRICS[topography];
  if (!defs || defs.length === 0) return null;
  let sum = 0;
  let wsum = 0;
  for (const d of defs) {
    const v = metrics[d.key];
    if (typeof v !== "number" || Number.isNaN(v)) continue;
    // higherIsWorse is false for every opportunity metric, so `normalize`
    // already returns "higher raw value -> higher score" here.
    const n = normalize(d.key, v, d.higherIsWorse);
    sum += n * d.weight;
    wsum += d.weight;
  }
  if (wsum === 0) return null;
  return Math.round((sum / wsum) * 100);
}

export type SubMetric = {
  key: string;
  label: string;
  unit: string;
  raw: number | null;
  /** 0-100, higher = worse, independent of the parent category's blended score. */
  severity: number | null;
};

export type CategoryScore = {
  /** Blended 0-100 score from this category's "primary" metrics only,
   *  or null if none of them have data for this topography/region. */
  score: number | null;
  label: string;
  /** Metrics tracked under this category but NOT blended into `score`
   *  (e.g. permafrost under heat, snowpack under drought) — shown as
   *  their own labeled severity so the signal isn't averaged away. */
  subMetrics: SubMetric[];
};

/** Per-category (Heat/Flood/Drought/Fire/Sea Level) breakdown for a region,
 *  built from the same canonical metric set as `composite()`. This is the
 *  shape /protocol and /briefing should consume once they're pointed at
 *  the real pipeline (steps 3-4) instead of their own scoring logic. */
export function hazardCategoryScores(
  topography: Topography,
  metrics: RegionMetrics,
): Record<HazardCategory, CategoryScore> {
  const defs = TOPOGRAPHY_METRICS[topography];
  const out = {} as Record<HazardCategory, CategoryScore>;
  for (const cat of HAZARD_CATEGORIES) {
    out[cat] = { score: null, label: CATEGORY_LABEL[cat], subMetrics: [] };
  }

  const sums: Record<HazardCategory, { sum: number; wsum: number }> = {
    heat: { sum: 0, wsum: 0 },
    flood: { sum: 0, wsum: 0 },
    drought: { sum: 0, wsum: 0 },
    fire: { sum: 0, wsum: 0 },
    sea_level: { sum: 0, wsum: 0 },
  };

  for (const d of defs) {
    const mapping = METRIC_CATEGORY[d.key];
    if (!mapping || mapping.category === "opportunity") continue; // shouldn't happen post-split, but stay defensive
    const category = mapping.category as HazardCategory;
    const v = metrics[d.key];
    const raw = typeof v === "number" && !Number.isNaN(v) ? v : null;
    const severity = raw != null ? Math.round(normalize(d.key, raw, d.higherIsWorse) * 100) : null;

    if (mapping.role === "sub-metric") {
      out[category].subMetrics.push({ key: d.key, label: d.label, unit: d.unit, raw, severity });
      continue;
    }
    if (raw == null) continue;
    const n = normalize(d.key, raw, d.higherIsWorse);
    sums[category].sum += n * d.weight;
    sums[category].wsum += d.weight;
  }

  for (const cat of HAZARD_CATEGORIES) {
    const { sum, wsum } = sums[cat];
    out[cat].score = wsum > 0 ? Math.round((sum / wsum) * 100) : null;
  }
  return out;
}

/** A location is compound when 2+ categories independently clear the
 *  compound threshold. Categories with no data (score === null) never count. */
export function compoundFor(categoryScores: Record<HazardCategory, CategoryScore>): {
  compound: boolean;
  categories: HazardCategory[];
} {
  const over = HAZARD_CATEGORIES.filter(
    (c) => (categoryScores[c].score ?? -1) >= COMPOUND_THRESHOLD,
  );
  return { compound: over.length >= COMPOUND_MIN_CATEGORIES, categories: over };
}

export function tier(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export const TIER_COLOR = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#eab308",
  low: "#22c55e",
} as const;
