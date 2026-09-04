// Pure scoring helpers — server-only (kept out of client bundle via .server.ts).
// All hazard scores are 0..100. Composite uses sector-adjusted weights.

export type HazardKey = "flood" | "heat" | "water" | "wildfire" | "sea_level" | "wind";

export type HazardResult = {
  score: number;
  score2050: number;
  source: string;
  note: string;
  warning?: string;
};

export type ScoreBundle = {
  flood: HazardResult;
  heat: HazardResult;
  water: HazardResult;
  wildfire: HazardResult;
  sea_level: HazardResult;
  wind: HazardResult;
  composite_now: number;
  composite_2050: number;
  expected_annual_loss_usd: number | null;
  warnings: string[];
};

const DEFAULT_WEIGHTS: Record<HazardKey, number> = {
  flood: 0.25, heat: 0.2, water: 0.2, wildfire: 0.15, sea_level: 0.1, wind: 0.1,
};

const SECTOR_WEIGHTS: Record<string, Record<HazardKey, number>> = {
  agriculture: { flood: 0.25, heat: 0.25, water: 0.3, wildfire: 0.1, sea_level: 0.05, wind: 0.05 },
  logistics: { flood: 0.3, heat: 0.15, water: 0.15, wildfire: 0.05, sea_level: 0.1, wind: 0.25 },
  energy: { flood: 0.2, heat: 0.3, water: 0.25, wildfire: 0.15, sea_level: 0.05, wind: 0.05 },
};

export function weightsForSector(sector: string): Record<HazardKey, number> {
  return SECTOR_WEIGHTS[sector] ?? DEFAULT_WEIGHTS;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// -- HEAT (NASA POWER) -------------------------------------------------------
export async function scoreHeat(lat: number, lon: number): Promise<HazardResult> {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M_MAX&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j: any = await r.json();
    const monthly = j?.properties?.parameter?.T2M_MAX as Record<string, number> | undefined;
    if (!monthly) throw new Error("no T2M_MAX");
    const months = Object.entries(monthly).filter(([k]) => k !== "ANN").map(([, v]) => Number(v));
    const mean = months.reduce((a, b) => a + b, 0) / months.length;
    const variance = months.reduce((a, b) => a + (b - mean) ** 2, 0) / months.length;
    const sd = Math.sqrt(variance) || 1;

    const heatDays = (m: number) => {
      // approximate days/year where daily max > 35C using normal CDF on monthly mean
      const z = (35 - m) / sd;
      const p = 1 - normalCdf(z);
      return Math.round(p * 365);
    };
    const now = clamp(heatDays(mean) * 2);
    const fut = clamp(heatDays(mean + 1.8) * 2);
    return {
      score: now, score2050: fut,
      source: "NASA POWER climatology (T2M_MAX)",
      note: `Mean annual T2M_MAX ${mean.toFixed(1)}°C. Score = days/yr >35°C × 2. 2050 adds +1.8°C (IPCC AR6 SSP2-4.5).`,
    };
  } catch (e: any) {
    return fallbackHeat(lat, e?.message ?? String(e));
  }
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function fallbackHeat(lat: number, reason: string): HazardResult {
  // Latitude-band heuristic
  const absLat = Math.abs(lat);
  const baseTemp = absLat < 15 ? 33 : absLat < 30 ? 30 : absLat < 45 ? 25 : absLat < 60 ? 18 : 10;
  const sd = 5;
  const z = (35 - baseTemp) / sd;
  const days = Math.round((1 - normalCdf(z)) * 365);
  return {
    score: clamp(days * 2), score2050: clamp(Math.round((1 - normalCdf((35 - baseTemp - 1.8) / sd)) * 365) * 2),
    source: "Latitude heuristic (NASA POWER unavailable)",
    note: `Approximated from latitude band; mean ~${baseTemp}°C max.`,
    warning: `NASA POWER fallback used: ${reason}`,
  };
}

// -- ELEVATION + SEA LEVEL --------------------------------------------------
async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const e = j?.results?.[0]?.elevation;
    return typeof e === "number" ? e : null;
  } catch { return null; }
}

function slrForRegion(lat: number, lon: number): number {
  // North Sea (Rotterdam, etc.)
  if (lat > 50 && lat < 60 && lon > -5 && lon < 12) return 0.28;
  // Bay of Bengal
  if (lat > 5 && lat < 23 && lon > 80 && lon < 100) return 0.35;
  // US Gulf Coast
  if (lat > 24 && lat < 31 && lon > -98 && lon < -80) return 0.44;
  // Mediterranean
  if (lat > 30 && lat < 46 && lon > -6 && lon < 36) return 0.22;
  // Pacific Islands (rough)
  if (Math.abs(lat) < 20 && (lon > 130 || lon < -130)) return 0.31;
  return 0.0;
}

export async function scoreSeaLevel(lat: number, lon: number): Promise<HazardResult> {
  const elev = await fetchElevation(lat, lon);
  const slr = slrForRegion(lat, lon);
  if (slr === 0 || elev == null || elev > 20) {
    return {
      score: 0, score2050: 0,
      source: "NASA SLR projections + Open-Elevation",
      note: elev == null ? "Inland or elevation unavailable — scored 0." : `Elevation ${elev.toFixed(0)}m, inland region.`,
    };
  }
  const threshold = slr + 0.5;
  const raw = 100 - (elev / threshold) * 100;
  const score = clamp(raw);
  // 2050 IS the projection horizon; current SLR exposure is much lower
  const scoreNow = clamp(raw * 0.4);
  return {
    score: scoreNow, score2050: score,
    source: "NASA SLR projections + Open-Elevation",
    note: `Coastal region SLR 2050 ${slr.toFixed(2)}m; elevation ${elev.toFixed(1)}m.`,
  };
}

// -- WILDFIRE (NASA FIRMS) --------------------------------------------------
export async function scoreWildfire(lat: number, lon: number): Promise<HazardResult> {
  const key = process.env.FIRMS_API_KEY;
  if (!key) return fallbackWildfire(lat, "FIRMS_API_KEY missing");
  const bbox = `${lon - 0.5},${lat - 0.5},${lon + 0.5},${lat + 0.5}`;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/MODIS_NRT/${bbox}/10`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const text = await r.text();
    const lines = text.trim().split("\n").filter(Boolean);
    const count = Math.max(0, lines.length - 1); // minus header
    // Extrapolate 10-day count to annual (×36) but cap scaling
    const annual = count * 36;
    const now = clamp(Math.min(annual, 100) * 5 / 5);
    const score = clamp(annual * 0.5);
    return {
      score, score2050: clamp(score * 1.25),
      source: "NASA FIRMS (MODIS_NRT, 10-day, 50km bbox)",
      note: `${count} fire detections in past 10 days within 50km. 2050: ×1.25 (IPCC fire weather).`,
    };
  } catch (e: any) {
    return fallbackWildfire(lat, e?.message ?? String(e));
  }
}

function fallbackWildfire(lat: number, reason: string): HazardResult {
  const absLat = Math.abs(lat);
  // Rough fire-prone latitude bands (Mediterranean, US West, Australia interior)
  const base = (absLat > 25 && absLat < 50) ? 35 : 15;
  return {
    score: base, score2050: clamp(base * 1.25),
    source: "Latitude heuristic (FIRMS unavailable)",
    note: "Approximated by fire-prone latitude band.",
    warning: `FIRMS fallback: ${reason}`,
  };
}

// -- FLOOD (heuristic, transparent) -----------------------------------------
export async function scoreFlood(lat: number, lon: number): Promise<HazardResult> {
  // Transparent heuristic: high in major river delta / monsoon belts + coastal
  // Pulls NASA POWER precipitation as a proxy for baseline wetness.
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j: any = await r.json();
    const monthly = j?.properties?.parameter?.PRECTOTCORR as Record<string, number> | undefined;
    if (!monthly) throw new Error("no PRECTOTCORR");
    const months = Object.entries(monthly).filter(([k]) => k !== "ANN").map(([, v]) => Number(v));
    const maxMonth = Math.max(...months);
    // mm/day in wettest month — proxy for monsoon intensity
    const monsoonProxy = clamp(maxMonth * 8); // ~12mm/day -> 96
    // boost if coastal (we approximate via region table below)
    const coastal = slrForRegion(lat, lon) > 0 ? 15 : 0;
    const score = clamp(monsoonProxy * 0.85 + coastal);
    return {
      score, score2050: clamp(score * 1.35),
      source: "NASA POWER precipitation + coastal proximity heuristic",
      note: `Wettest-month precip ${maxMonth.toFixed(1)} mm/day. Coastal +${coastal}. 2050: ×1.35 (IPCC AR6 riverine).`,
    };
  } catch (e: any) {
    return {
      score: 30, score2050: 40,
      source: "Default fallback",
      note: "Precip data unavailable.",
      warning: `Flood fallback: ${e?.message ?? String(e)}`,
    };
  }
}

// -- WATER STRESS (heuristic) -----------------------------------------------
export async function scoreWater(lat: number, lon: number): Promise<HazardResult> {
  // Aridity proxy: low precip + high temp = high water stress
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR,T2M&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j: any = await r.json();
    const precip = j?.properties?.parameter?.PRECTOTCORR?.ANN as number | undefined;
    const temp = j?.properties?.parameter?.T2M?.ANN as number | undefined;
    if (precip == null || temp == null) throw new Error("no ANN values");
    // De Martonne aridity index: P / (T + 10). Lower = more arid.
    const dm = precip * 365 / (temp + 10);
    let bws: number; // 0..5 like Aqueduct
    if (dm < 5) bws = 5;
    else if (dm < 10) bws = 4;
    else if (dm < 20) bws = 3;
    else if (dm < 30) bws = 2;
    else if (dm < 60) bws = 1;
    else bws = 0;
    const score = clamp(bws * 20);
    return {
      score, score2050: clamp(score * 1.15),
      source: "WRI Aqueduct methodology — De Martonne aridity from NASA POWER",
      note: `De Martonne aridity index ${dm.toFixed(1)} → baseline water stress tier ${bws}/5.`,
    };
  } catch (e: any) {
    return {
      score: 40, score2050: 46,
      source: "Default fallback",
      note: "Aridity data unavailable.",
      warning: `Water fallback: ${e?.message ?? String(e)}`,
    };
  }
}

// -- WIND / TROPICAL STORM (NOAA IBTrACS lookup) ----------------------------
export function scoreWind(lat: number, lon: number): HazardResult {
  const absLat = Math.abs(lat);
  let tier: "high" | "medium" | "low" | "negligible";
  let score: number;
  if (absLat <= 20) { tier = "high"; score = 70; }
  else if (absLat <= 35) { tier = "medium"; score = 40; }
  else if (absLat <= 60) { tier = "low"; score = 15; }
  else { tier = "negligible"; score = 5; }
  // Coastal +10 (approximate via SLR table)
  if (slrForRegion(lat, lon) > 0) score += 10;
  const score2050 = tier === "high" ? clamp(score + 10) :
                    tier === "medium" ? clamp(score + 25) :
                    tier === "low" ? clamp(score + 20) : clamp(score + 5);
  return {
    score: clamp(score), score2050,
    source: "NOAA IBTrACS latitude-band classification",
    note: `Latitude band ${absLat.toFixed(0)}° → tier ${tier}. 2050: poleward storm-track expansion (IPCC AR6).`,
  };
}

// -- COMPOSITE --------------------------------------------------------------
export function composite(scores: Pick<ScoreBundle, HazardKey>, sector: string, key: "score" | "score2050"): number {
  const w = weightsForSector(sector);
  let total = 0;
  for (const k of Object.keys(w) as HazardKey[]) {
    total += scores[k][key] * w[k];
  }
  return Math.round(total);
}

export async function scoreAsset(opts: {
  lat: number; lon: number; sector: string; replacement_value_usd: number | null;
}): Promise<ScoreBundle> {
  const { lat, lon, sector, replacement_value_usd } = opts;
  const [flood, heat, water, wildfire, sea_level] = await Promise.all([
    scoreFlood(lat, lon),
    scoreHeat(lat, lon),
    scoreWater(lat, lon),
    scoreWildfire(lat, lon),
    scoreSeaLevel(lat, lon),
  ]);
  const wind = scoreWind(lat, lon);

  const hazards = { flood, heat, water, wildfire, sea_level, wind };
  const compNow = composite(hazards, sector, "score");
  const comp2050 = composite(hazards, sector, "score2050");
  const eal = replacement_value_usd != null
    ? Math.round(replacement_value_usd * (comp2050 / 100) * 0.03)
    : null;

  const warnings = Object.entries(hazards)
    .filter(([, h]) => h.warning)
    .map(([k, h]) => `${k}: ${h.warning}`);

  return {
    ...hazards,
    composite_now: compNow,
    composite_2050: comp2050,
    expected_annual_loss_usd: eal,
    warnings,
  };
}
