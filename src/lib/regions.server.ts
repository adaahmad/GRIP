// Server-only adapters for climate data providers. Free public APIs where possible.
// Loaded from inside server-function handlers.

import { assessFire } from "./fire.server";
import {
  getSeaLevelRiseM,
  type Scenario as SlrScenario,
  type Year as SlrYear,
} from "./sea-level-reference";
import type { Provenance } from "./hazard-taxonomy";

type LatLon = { lat: number; lon: number };

const SCENARIO_MODEL_MAP: Record<string, string> = {
  // Open-Meteo climate API model parameter values (CMIP6).
  "SSP2-4.5": "MRI_AGCM3_2_S",
  "SSP5-8.5": "EC_Earth3P_HR",
};

const OM_CLIMATE = "https://climate-api.open-meteo.com/v1/climate";
const OM_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const OM_FLOOD = "https://flood-api.open-meteo.com/v1/flood";
const NASA_POWER = "https://power.larc.nasa.gov/api/temporal/climatology/point";

async function safeJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function mean(xs: number[]) {
  const nums = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function yearWindow(year: number): { start: string; end: string } {
  // 10-year window centered on target year
  const lo = Math.max(1950, year - 5);
  const hi = Math.min(2100, year + 4);
  return { start: `${lo}-01-01`, end: `${hi}-12-31` };
}

/** Open-Meteo climate API — CMIP6 ensemble. Returns annual means/sums for a window. */
export async function fetchOpenMeteoClimate({ lat, lon }: LatLon, scenario: string, year: number) {
  const { start, end } = yearWindow(year);
  const model = SCENARIO_MODEL_MAP[scenario] ?? "MRI_AGCM3_2_S";
  const url = `${OM_CLIMATE}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&models=${model}&daily=temperature_2m_mean,precipitation_sum,snowfall_sum,soil_moisture_0_to_10cm_mean,wind_speed_10m_max`;
  const data = await safeJson<any>(url, {});
  const d = data?.daily;
  if (!d?.time) return null;
  const temps: number[] = d.temperature_2m_mean ?? [];
  const precs: number[] = d.precipitation_sum ?? [];
  const snows: number[] = d.snowfall_sum ?? [];
  const sm: number[] = d.soil_moisture_0_to_10cm_mean ?? [];
  const winds: number[] = d.wind_speed_10m_max ?? [];
  const days = d.time.length;
  const years = Math.max(1, Math.round(days / 365));
  const extremeHeat = temps.filter((t) => t >= 35).length / years;
  const veryHotDays = temps.filter((t) => t >= 40).length / years;
  const extremePrecip = precs.filter((p) => p >= 20).length / years;
  const snowfallAnnual = (snows.reduce((a, b) => a + (b ?? 0), 0) || 0) / years;
  const skiDays = snows.filter((s) => (s ?? 0) > 1).length / years; // days with snowfall
  return {
    temp_mean_c: mean(temps),
    extreme_heat_days: Math.round(extremeHeat),
    very_hot_days: Math.round(veryHotDays),
    extreme_precip_days: Math.round(extremePrecip),
    snowfall_annual_mm: Math.round(snowfallAnnual),
    ski_season_days: Math.round(skiDays),
    soil_moisture_mean: mean(sm),
    wind_max_ms: Math.max(0, ...winds.filter((w) => typeof w === "number")),
    source_model: model,
  };
}

/** Historical baseline (ERA5) for a point. */
export async function fetchOpenMeteoBaseline({ lat, lon }: LatLon) {
  const url = `${OM_ARCHIVE}?latitude=${lat}&longitude=${lon}&start_date=2000-01-01&end_date=2014-12-31&daily=temperature_2m_mean,precipitation_sum,snowfall_sum,soil_moisture_0_to_10cm_mean,wind_speed_10m_max&timezone=UTC`;
  const data = await safeJson<any>(url, {});
  const d = data?.daily;
  if (!d?.time) return null;
  const temps: number[] = d.temperature_2m_mean ?? [];
  const snows: number[] = d.snowfall_sum ?? [];
  const sm: number[] = d.soil_moisture_0_to_10cm_mean ?? [];
  const years = Math.max(1, Math.round(d.time.length / 365));
  return {
    temp_mean_c: mean(temps),
    snowfall_annual_mm: (snows.reduce((a, b) => a + (b ?? 0), 0) || 0) / years,
    soil_moisture_mean: mean(sm),
    ski_season_days: snows.filter((s) => (s ?? 0) > 1).length / years,
  };
}

/** Open-Meteo flood API — returns the recent peak discharge as a proxy for flood pressure. */
export async function fetchOpenMeteoFlood({ lat, lon }: LatLon) {
  const url = `${OM_FLOOD}?latitude=${lat}&longitude=${lon}&daily=river_discharge_max&past_days=92`;
  const data = await safeJson<any>(url, {});
  const arr: number[] = data?.daily?.river_discharge_max ?? [];
  const valid = arr.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (!valid.length) return null;
  valid.sort((a, b) => b - a);
  return {
    river_discharge_p95: valid[Math.floor(valid.length * 0.05)] ?? null,
    flood_return_5yr_m3s: valid[0] ?? null,
  };
}

/** NASA POWER — long-term climatology for solar potential and wind. */
export async function fetchNasaPower({ lat, lon }: LatLon) {
  const url = `${NASA_POWER}?parameters=ALLSKY_SFC_SW_DWN,WS10M,T2M&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  const data = await safeJson<any>(url, {});
  const props = data?.properties?.parameter ?? {};
  const ghi = props.ALLSKY_SFC_SW_DWN?.ANN ?? null;
  const wind = props.WS10M?.ANN ?? null;
  const t = props.T2M?.ANN ?? null;
  return {
    solar_potential_kwh: typeof ghi === "number" ? Number(ghi.toFixed(2)) : null,
    wind_baseline_ms: typeof wind === "number" ? Number(wind.toFixed(2)) : null,
    temp_climatology_c: typeof t === "number" ? Number(t.toFixed(2)) : null,
  };
}

const FIRE_TOPOGRAPHIES = new Set(["savanna", "boreal", "alpine"]);
const SEA_LEVEL_TOPOGRAPHIES = new Set(["coastal", "tropical-delta"]);

/** Compose a topography-aware metric bundle for a region. */
export async function computeRegionMetrics(opts: {
  topography: string;
  lat: number;
  lon: number;
  bbox: { w: number; s: number; e: number; n: number } | null;
  scenario: string;
  year: number;
}) {
  const { topography, lat, lon, bbox, scenario, year } = opts;
  const [climate, baseline, flood, power, fire] = await Promise.all([
    fetchOpenMeteoClimate({ lat, lon }, scenario, year),
    fetchOpenMeteoBaseline({ lat, lon }),
    topography === "tropical-delta" || topography === "alpine" || topography === "coastal"
      ? fetchOpenMeteoFlood({ lat, lon })
      : Promise.resolve(null),
    fetchNasaPower({ lat, lon }),
    FIRE_TOPOGRAPHIES.has(topography) ? assessFire({ lat, lon, bbox }) : Promise.resolve(null),
  ]);

  const slr = SEA_LEVEL_TOPOGRAPHIES.has(topography)
    ? getSeaLevelRiseM(lat, lon, scenario as SlrScenario, year as SlrYear)
    : null;

  const tempAnomaly =
    climate?.temp_mean_c != null && baseline?.temp_mean_c != null
      ? Number((climate.temp_mean_c - baseline.temp_mean_c).toFixed(2))
      : null;

  const snowfallChange =
    climate?.snowfall_annual_mm != null &&
    baseline?.snowfall_annual_mm != null &&
    baseline.snowfall_annual_mm > 0
      ? Number(
          (
            ((climate.snowfall_annual_mm - baseline.snowfall_annual_mm) /
              baseline.snowfall_annual_mm) *
            100
          ).toFixed(1),
        )
      : null;

  const soilMoistureChange =
    climate?.soil_moisture_mean != null &&
    baseline?.soil_moisture_mean != null &&
    baseline.soil_moisture_mean > 0
      ? Number(
          (
            ((climate.soil_moisture_mean - baseline.soil_moisture_mean) /
              baseline.soil_moisture_mean) *
            100
          ).toFixed(1),
        )
      : null;

  // Drought index proxy from soil moisture change
  const drought_index =
    soilMoistureChange != null ? Number((soilMoistureChange / 20).toFixed(2)) : null;

  // Permafrost loss proxy from temp anomaly (boreal only)
  const permafrost_loss_pct =
    tempAnomaly != null && topography === "boreal"
      ? Math.min(95, Math.round(tempAnomaly * 12))
      : null;

  // Growing season days proxy
  const growing_season_days =
    climate?.temp_mean_c != null ? Math.round(120 + (climate.temp_mean_c - 5) * 8) : null;

  const nowIso = new Date().toISOString();
  const provenance: Partial<Record<string, Provenance>> = {};
  if (fire) provenance.wildfire_active_count = fire.provenance;
  if (slr) provenance.sea_level_rise_m = slr.provenance;
  if (climate) {
    const climateProvenance: Provenance = {
      status: "live",
      source: `open-meteo:climate (${climate.source_model})`,
      fetchedAt: nowIso,
    };
    provenance.temp_anomaly_c = climateProvenance;
    provenance.extreme_heat_days = climateProvenance;
    provenance.very_hot_days = climateProvenance;
    provenance.extreme_precip_days = climateProvenance;
    provenance.wind_max_ms = climateProvenance;
  }
  if (flood)
    provenance.flood_return_5yr_m3s = {
      status: "live",
      source: "open-meteo:flood",
      fetchedAt: nowIso,
    };

  return {
    metrics: {
      temp_anomaly_c: tempAnomaly,
      temp_mean_c: climate?.temp_mean_c ?? null,
      extreme_heat_days: climate?.extreme_heat_days ?? null,
      very_hot_days: climate?.very_hot_days ?? null,
      extreme_precip_days: climate?.extreme_precip_days ?? null,
      snowfall_change_pct: snowfallChange,
      ski_season_days: climate?.ski_season_days ?? null,
      soil_moisture_change_pct: soilMoistureChange,
      solar_potential_kwh: power?.solar_potential_kwh ?? null,
      wind_max_ms: climate?.wind_max_ms ?? null,
      sea_level_rise_m: slr?.sea_level_rise_m ?? null,
      flood_return_5yr_m3s: flood?.flood_return_5yr_m3s ?? null,
      drought_index,
      wildfire_active_count: fire?.wildfire_active_count ?? null,
      fire_weather_index: fire?.fire_weather_index ?? null,
      permafrost_loss_pct,
      growing_season_days,
    },
    /** Per-metric provenance (live / static-baseline / unavailable). Fire and
     *  sea level are fully wired; other metrics get coarse "live" tagging
     *  for now — finer-grained cache/staleness provenance is step 5. */
    provenance,
    source: [
      "open-meteo:climate",
      "open-meteo:archive",
      flood ? "open-meteo:flood" : null,
      "nasa:power",
      fire?.provenance.status === "live"
        ? "nasa:firms"
        : fire
          ? "fire-weather-index (modeled, no FIRMS)"
          : null,
      slr ? "ipcc-ar6:slr-regional-baseline" : null,
    ]
      .filter(Boolean)
      .join(","),
  };
}
