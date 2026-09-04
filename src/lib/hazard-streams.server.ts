// Multi-stream physical hazard assessment. Server-only.
//
// Streams:
//  - NASA FIRMS (area/csv)            → active wildfire thermal anomalies (daily)
//  - Copernicus EMS GloFAS            → river discharge / flood signal (via Open-Meteo flood API)
//  - Open-Meteo forecast (+past 60d)  → heat, precipitation excess, drought deficit,
//                                       fire-weather variables, cyclone-force winds
//  - NASA POWER climatology           → 60-day precipitation normal (drought baseline)
//
// Every stream degrades gracefully: a failed fetch yields null, never 0.

import type { ForecastFlag, FlagLevel, HazardKey } from "./forecast-flags";

const FIRMS_AREA = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const OM_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OM_FLOOD = "https://flood-api.open-meteo.com/v1/flood";
const POWER_CLIM = "https://power.larc.nasa.gov/api/temporal/climatology/point";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] as const;

async function getJson<T>(url: string, ms = 12000): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function getText(url: string, ms = 12000): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const nums = (xs: unknown[]) => (xs ?? []).filter((x): x is number => typeof x === "number" && !Number.isNaN(x));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- streams

export type ForecastStream = {
  past60Precip: number | null;
  next7MaxTemp: number | null;
  next7Precip: number | null;
  next7MaxWindKmh: number | null;
  next7MinRh: number | null;
  hotDays7: number;
  recentMaxTemp: number | null;
};

export async function fetchForecastStream(lat: number, lon: number): Promise<ForecastStream | null> {
  const url =
    `${OM_FORECAST}?latitude=${lat}&longitude=${lon}&timezone=UTC&past_days=60&forecast_days=7` +
    `&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_min`;
  const j = await getJson<any>(url);
  const d = j?.daily;
  if (!d?.time) return null;
  const n: number = d.time.length;
  const fc = 7;
  const pastIdx = Math.max(0, n - fc);

  const precipAll: number[] = d.precipitation_sum ?? [];
  const tmaxAll: number[] = d.temperature_2m_max ?? [];
  const windAll: number[] = d.wind_speed_10m_max ?? [];
  const rhAll: number[] = d.relative_humidity_2m_min ?? [];

  const past60 = nums(precipAll.slice(0, pastIdx));
  const fcTemps = nums(tmaxAll.slice(pastIdx));
  const fcPrecip = nums(precipAll.slice(pastIdx));
  const fcWind = nums(windAll.slice(pastIdx));
  const fcRh = nums(rhAll.slice(pastIdx));
  const recentTemps = nums(tmaxAll.slice(0, pastIdx));

  return {
    past60Precip: past60.length ? Number(sum(past60).toFixed(1)) : null,
    next7MaxTemp: fcTemps.length ? Math.max(...fcTemps) : null,
    next7Precip: fcPrecip.length ? Number(sum(fcPrecip).toFixed(1)) : null,
    next7MaxWindKmh: fcWind.length ? Math.max(...fcWind) : null,
    next7MinRh: fcRh.length ? Math.min(...fcRh) : null,
    hotDays7: fcTemps.filter((t) => t >= 35).length,
    recentMaxTemp: recentTemps.length ? Math.max(...recentTemps) : null,
  };
}

/** Copernicus EMS / GloFAS river discharge, served through Open-Meteo's flood API. */
export async function fetchGlofas(lat: number, lon: number) {
  const url = `${OM_FLOOD}?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_max&past_days=60&forecast_days=7`;
  const j = await getJson<any>(url);
  const d = j?.daily;
  if (!d) return null;
  const cur = nums(d.river_discharge ?? []);
  const hist = nums(d.river_discharge_mean ?? d.river_discharge ?? []);
  if (!cur.length || !hist.length) return null;
  const peak = Math.max(...cur);
  const sorted = [...hist].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  return {
    peak_discharge_m3s: Number(peak.toFixed(1)),
    median_discharge_m3s: Number(median.toFixed(1)),
    /** >1 means the river is running above its own 60-day median. */
    exceedance: median > 0 ? Number((peak / median).toFixed(2)) : null,
  };
}

/** NASA FIRMS VIIRS active-fire detections in a box around the point. */
export async function fetchFirmsCount(lat: number, lon: number, deg = 1.5, days = 1) {
  const key = process.env.FIRMS_API_KEY;
  if (!key) return null;
  const area = `${(lon - deg).toFixed(2)},${(lat - deg).toFixed(2)},${(lon + deg).toFixed(2)},${(lat + deg).toFixed(2)}`;
  const text = await getText(`${FIRMS_AREA}/${key}/VIIRS_SNPP_NRT/${area}/${days}`);
  if (!text || text.trim().startsWith("Invalid")) return null;
  const lines = text.trim().split("\n").filter(Boolean);
  return Math.max(0, lines.length - 1);
}

/** 60-day precipitation normal from NASA POWER monthly climatology. */
export async function fetchPrecipNormal60d(lat: number, lon: number, now = new Date()) {
  const j = await getJson<any>(
    `${POWER_CLIM}?parameters=PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`,
    15000,
  );
  const p = j?.properties?.parameter?.PRECTOTCORR;
  if (!p) return null;
  const m = now.getUTCMonth();
  const prev = (m + 11) % 12;
  const a = p[MONTHS[m]];
  const b = p[MONTHS[prev]];
  if (typeof a !== "number" || typeof b !== "number") return null;
  const perDay = (a + b) / 2;
  return { normal60_mm: Number((perDay * 60).toFixed(1)), monthly_mm_per_day: Number(perDay.toFixed(2)) };
}

// ---------------------------------------------------------------- scoring

export type HazardScores = Record<HazardKey, number>;

export type RegionAssessment = {
  scores: HazardScores;
  dominant: HazardKey;
  compound: boolean;
  compoundCount: number;
  /** Ranking value: compound score if compound, else the highest single hazard. */
  rank: number;
  flags: ForecastFlag[];
  live: boolean;
  note: string;
  source: string;
  streams: {
    forecast: ForecastStream | null;
    glofas: Awaited<ReturnType<typeof fetchGlofas>>;
    firesRaw: number | null;
    precipNormal: Awaited<ReturnType<typeof fetchPrecipNormal60d>>;
    droughtRatio: number | null;
    fireWeatherIndex: number | null;
  };
};

function heatScore(f: ForecastStream | null): number | null {
  if (!f?.next7MaxTemp) return null;
  const t = f.next7MaxTemp;
  // 30 °C → ~35, 40 °C → ~75, 48 °C → ~100
  const base = clamp((t - 22) * 4.2);
  const persistence = f.hotDays7 * 3;
  return Math.round(clamp(base + persistence));
}

function floodScore(
  f: ForecastStream | null,
  g: Awaited<ReturnType<typeof fetchGlofas>>,
): number | null {
  const parts: number[] = [];
  if (f?.next7Precip != null) parts.push(clamp((f.next7Precip / 150) * 100));
  if (g?.exceedance != null) parts.push(clamp((g.exceedance - 0.8) * 90));
  if (!parts.length) return null;
  return Math.round(Math.max(...parts));
}

/** 60-day rolling precipitation below 40% of the historical normal = drought. */
function droughtRatioOf(f: ForecastStream | null, normal: Awaited<ReturnType<typeof fetchPrecipNormal60d>>) {
  if (f?.past60Precip == null || !normal || normal.normal60_mm <= 0) return null;
  return Number((f.past60Precip / normal.normal60_mm).toFixed(2));
}

function droughtScore(ratio: number | null): number | null {
  if (ratio == null) return null;
  if (ratio <= 0.4) return Math.round(clamp(65 + ((0.4 - ratio) / 0.4) * 35));
  if (ratio >= 1) return Math.round(clamp(20 - (ratio - 1) * 10, 0, 20));
  return Math.round(clamp(20 + ((1 - ratio) / 0.6) * 44));
}

/** Fire-weather index proxy (0-100) from heat, low humidity, wind and dryness. */
function fireWeatherIndex(f: ForecastStream | null, droughtRatio: number | null): number | null {
  if (!f || f.next7MaxTemp == null) return null;
  const heat = clamp((f.next7MaxTemp - 18) * 3.2);
  const dry = f.next7MinRh != null ? clamp((60 - f.next7MinRh) * 2.2) : 40;
  const wind = f.next7MaxWindKmh != null ? clamp(f.next7MaxWindKmh * 1.6) : 35;
  const fuel = droughtRatio != null ? clamp((1 - Math.min(1.2, droughtRatio)) * 100) : 40;
  return Math.round(clamp(heat * 0.34 + dry * 0.26 + wind * 0.16 + fuel * 0.24));
}

function fireScore(fires: number | null, fwi: number | null): number | null {
  const parts: number[] = [];
  if (fires != null) parts.push(clamp(Math.log10(fires + 1) * 42));
  if (fwi != null) parts.push(fwi);
  if (!parts.length) return null;
  // Detections dominate when present; weather index sets the floor.
  return Math.round(Math.max(...parts));
}

// ---------------------------------------------------------------- flags

function lvl(status: string, critical: string[], watch: string[]): FlagLevel {
  if (critical.includes(status)) return "critical";
  if (watch.includes(status)) return "watch";
  return "normal";
}

export type StaticRegionProfile = {
  /** IPCC AR6 regional assessment inputs that have no free live stream. */
  glacial?: "accelerating" | "stable" | "decelerating" | "none";
  permafrost?: "active" | "stable" | "none";
  urban?: "severe" | "elevated" | "normal";
  monsoonRegion?: boolean;
  cycloneBasin?: boolean;
  marine?: boolean;
};

function buildFlags(opts: {
  lat: number;
  scores: HazardScores;
  f: ForecastStream | null;
  fwi: number | null;
  droughtRatio: number | null;
  normal: Awaited<ReturnType<typeof fetchPrecipNormal60d>>;
  profile: StaticRegionProfile;
}): ForecastFlag[] {
  const { lat, scores, f, fwi, droughtRatio, normal, profile } = opts;
  const flags: ForecastFlag[] = [];

  // --- Monsoon status (Open-Meteo precipitation forecast vs climatology)
  if (profile.monsoonRegion) {
    const expected7 = normal ? normal.monthly_mm_per_day * 7 : null;
    let status = "clear";
    if (f?.next7Precip != null && expected7 != null && expected7 > 0) {
      const r = f.next7Precip / expected7;
      status = r >= 1.2 ? "active" : r >= 0.6 ? "onset" : "delayed";
    } else if (f?.next7Precip != null) {
      status = f.next7Precip >= 90 ? "active" : f.next7Precip >= 25 ? "onset" : "delayed";
    }
    flags.push({
      id: "monsoon",
      label: "Monsoon Status",
      status,
      level: lvl(status, ["delayed"], ["onset"]),
      detail:
        f?.next7Precip != null
          ? `${f.next7Precip.toFixed(0)} mm forecast over 7 days vs ${expected7?.toFixed(0) ?? "—"} mm normal.`
          : "Precipitation forecast unavailable.",
      source: "Open-Meteo precipitation forecast + NASA POWER climatology",
    });
  }

  // --- Glacial melt rate (IPCC AR6 regional assessment, static)
  const glacial = profile.glacial ?? (Math.abs(lat) >= 45 ? "accelerating" : "none");
  if (glacial !== "none") {
    flags.push({
      id: "glacial",
      label: "Glacial Melt Rate",
      status: glacial,
      level: lvl(glacial, ["accelerating"], ["stable"]),
      detail: "IPCC AR6 WGI Ch.9 regional cryosphere assessment for the current decade.",
      source: "IPCC AR6 regional assessment (static)",
    });
  }

  // --- Marine heatwave index (coastal only, SST proxy from recent surface maxima)
  if (profile.marine) {
    const active = (scores.heat ?? 0) >= 60 || (f?.recentMaxTemp != null && f.recentMaxTemp >= 32);
    flags.push({
      id: "marine_heatwave",
      label: "Marine Heatwave Index",
      status: active ? "active" : "clear",
      level: active ? "critical" : "normal",
      detail: active
        ? "Sustained coastal surface temperature anomaly — reef bleaching and fishery stress risk."
        : "Coastal surface temperatures within climatological range.",
      source: "Open-Meteo surface temperature anomaly (SST proxy)",
    });
  }

  // --- Wildfire weather index (Open-Meteo fire-danger variables)
  if (fwi != null) {
    const status = fwi >= 75 ? "extreme" : fwi >= 55 ? "high" : fwi >= 35 ? "moderate" : "low";
    flags.push({
      id: "wildfire_weather",
      label: "Wildfire Weather Index",
      status,
      level: lvl(status, ["extreme"], ["high"]),
      detail: `FWI proxy ${fwi}/100 from max temp, min RH, peak wind and 60-day dryness.`,
      source: "Open-Meteo fire-danger variables (temp, RH, wind, precip deficit)",
    });
  }

  // --- Crop stress index
  if (droughtRatio != null || scores.heat != null) {
    const stress = Math.max(scores.drought ?? 0, (scores.heat ?? 0) * 0.8);
    const status = stress >= 70 ? "critical" : stress >= 45 ? "stressed" : "normal";
    flags.push({
      id: "crop_stress",
      label: "Crop Stress Index",
      status,
      level: lvl(status, ["critical"], ["stressed"]),
      detail:
        droughtRatio != null
          ? `60-day rainfall at ${(droughtRatio * 100).toFixed(0)}% of normal with heat score ${scores.heat ?? 0}.`
          : `Heat-driven stress score ${Math.round(stress)}/100.`,
      source: "Open-Meteo precipitation deficit + NASA POWER climatology",
    });
  }

  // --- Tropical cyclone watch
  if (profile.cycloneBasin || Math.abs(lat) <= 35) {
    const w = f?.next7MaxWindKmh ?? null;
    const status = w == null ? "clear" : w >= 88 ? "active track" : w >= 55 ? "watch" : "clear";
    flags.push({
      id: "cyclone",
      label: "Tropical Cyclone Watch",
      status,
      level: lvl(status, ["active track"], ["watch"]),
      detail: w != null ? `Peak 7-day sustained wind ${w.toFixed(0)} km/h.` : "Wind forecast unavailable.",
      source: "Open-Meteo 7-day wind forecast",
    });
  }

  // --- Urban heat island intensity
  const urban = profile.urban ?? "normal";
  if (urban !== "normal" || (scores.heat ?? 0) >= 60) {
    const status =
      urban === "severe" || (scores.heat ?? 0) >= 80
        ? "severe"
        : urban === "elevated" || (scores.heat ?? 0) >= 60
          ? "elevated"
          : "normal";
    flags.push({
      id: "uhi",
      label: "Urban Heat Island Intensity",
      status,
      level: lvl(status, ["severe"], ["elevated"]),
      detail: `Built-up density class combined with a heat score of ${scores.heat ?? 0}/100.`,
      source: "IPCC AR6 urban chapter class + Open-Meteo heat forecast",
    });
  }

  // --- Permafrost thaw signal
  const perma = profile.permafrost ?? (Math.abs(lat) >= 55 ? "active" : "none");
  if (perma !== "none") {
    flags.push({
      id: "permafrost",
      label: "Permafrost Thaw Signal",
      status: perma,
      level: perma === "active" ? "critical" : "normal",
      detail: "IPCC AR6 near-surface permafrost extent assessment for this region.",
      source: "IPCC AR6 regional assessment (static)",
    });
  }

  // --- Sea level (kept alongside the existing flag set)
  const slr = scores.sea_level ?? 0;
  flags.push({
    id: "sea_level",
    label: "Sea Level Pressure",
    status: slr >= 70 ? "critical" : slr >= 45 ? "watch" : "stable",
    level: slr >= 70 ? "critical" : slr >= 45 ? "watch" : "normal",
    detail: `Relative sea-level exposure score ${slr}/100 (AR6 SSP2-4.5 mid-century).`,
    source: "IPCC AR6 sea-level projections",
  });

  return flags;
}

// ---------------------------------------------------------------- public API

/**
 * Score all six hazard categories independently from live streams, blended with
 * a regional baseline prior so a quiet forecast week never zeroes out a region
 * with well-documented structural exposure.
 */
export async function assessRegion(opts: {
  lat: number;
  lon: number;
  baseline: HazardScores;
  profile?: StaticRegionProfile;
}): Promise<RegionAssessment> {
  const { lat, lon, baseline, profile = {} } = opts;

  const [forecast, glofas, firesRaw, precipNormal] = await Promise.all([
    fetchForecastStream(lat, lon),
    fetchGlofas(lat, lon),
    fetchFirmsCount(lat, lon),
    fetchPrecipNormal60d(lat, lon),
  ]);

  const droughtRatio = droughtRatioOf(forecast, precipNormal);
  const fwi = fireWeatherIndex(forecast, droughtRatio);

  const live: Partial<HazardScores> = {
    heat: heatScore(forecast) ?? undefined,
    flood: floodScore(forecast, glofas) ?? undefined,
    drought: droughtScore(droughtRatio) ?? undefined,
    fire: fireScore(firesRaw, fwi) ?? undefined,
    sea_level: undefined, // no free live stream — structural baseline governs
  };

  // Live surge lifts the baseline; it never suppresses documented exposure.
  const scores = {
    heat: Math.round(Math.max(baseline.heat, live.heat ?? 0)),
    flood: Math.round(Math.max(baseline.flood, live.flood ?? 0)),
    drought: Math.round(Math.max(baseline.drought, live.drought ?? 0)),
    fire: Math.round(Math.max(baseline.fire, live.fire ?? 0)),
    sea_level: Math.round(baseline.sea_level),
  } as HazardScores;

  const entries = (Object.keys(scores) as HazardKey[]).map((k) => [k, scores[k]] as const);
  const over = entries.filter(([, v]) => v > 60);
  const dominant = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const compound = over.length >= 2;
  const top = Math.max(...entries.map(([, v]) => v));
  const compoundScore = compound
    ? Math.round(Math.min(100, top + (over.length - 1) * 6))
    : top;

  const anyLive = forecast != null || glofas != null || firesRaw != null;

  const note =
    `heat ${scores.heat} · flood ${scores.flood} · drought ${scores.drought} · ` +
    `fire ${scores.fire} · SLR ${scores.sea_level}` +
    (droughtRatio != null ? ` · 60d rain ${(droughtRatio * 100).toFixed(0)}% of normal` : "") +
    (firesRaw != null ? ` · ${firesRaw} FIRMS detections/24h` : "") +
    (glofas?.exceedance != null ? ` · GloFAS ${glofas.exceedance}× median` : "");

  return {
    scores,
    dominant,
    compound,
    compoundCount: over.length,
    rank: compoundScore,
    flags: buildFlags({ lat, scores, f: forecast, fwi, droughtRatio, normal: precipNormal, profile }),
    live: anyLive,
    note,
    source:
      "NASA FIRMS · Copernicus EMS GloFAS (Open-Meteo) · Open-Meteo forecast · NASA POWER climatology · IPCC AR6",
    streams: { forecast, glofas, firesRaw, precipNormal, droughtRatio, fireWeatherIndex: fwi },
  };
}

/** Bounded-concurrency map so free APIs are not hammered. */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
