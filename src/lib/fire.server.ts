// Canonical fire assessment — server-only.
//
// Real NASA FIRMS wiring (ported from the previously-unused
// hazard-streams.server.ts) with an HONEST fallback: when FIRMS_API_KEY is
// missing or the request fails, this returns wildfire_active_count: null
// plus a clearly-tagged provenance reason — never a fake latitude-band
// number dressed up to look like a real reading (that's what
// hazards.server.ts's old fallbackWildfire() did; do not reintroduce it).
//
// A separate fire-weather-index (FWI) proxy is always attempted from live
// forecast variables (heat / humidity / wind / dryness). It estimates how
// conducive conditions are to fire, NOT whether a fire is burning — it is
// surfaced as its own labeled number, never silently substituted for a
// satellite detection count.

import type { Provenance } from "./hazard-taxonomy";

const FIRMS_AREA = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const OM_FORECAST = "https://api.open-meteo.com/v1/forecast";

async function getText(url: string, ms = 12000): Promise<string | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

async function getJson<T>(url: string, ms = 12000): Promise<T | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const nums = (xs: unknown[]) =>
  (xs ?? []).filter((x): x is number => typeof x === "number" && !Number.isNaN(x));

/** Real NASA FIRMS VIIRS active-fire detection count in a box around a point. */
export async function fetchFirmsDetections(
  lat: number,
  lon: number,
  opts: {
    bbox?: { w: number; s: number; e: number; n: number } | null;
    degRadius?: number;
    days?: number;
  } = {},
): Promise<number | null> {
  const key = process.env.FIRMS_API_KEY;
  if (!key) return null;
  const { bbox = null, degRadius = 1.5, days = 1 } = opts;
  const area = bbox
    ? `${bbox.w},${bbox.s},${bbox.e},${bbox.n}`
    : `${(lon - degRadius).toFixed(2)},${(lat - degRadius).toFixed(2)},${(lon + degRadius).toFixed(2)},${(lat + degRadius).toFixed(2)}`;
  const text = await getText(`${FIRMS_AREA}/${key}/VIIRS_SNPP_NRT/${area}/${days}`);
  if (!text || text.trim().toLowerCase().startsWith("invalid")) return null;
  const lines = text.trim().split("\n").filter(Boolean);
  return Math.max(0, lines.length - 1); // minus header row
}

/** Fire-weather-index proxy (0-100) from live Open-Meteo forecast variables. */
async function fetchFireWeatherIndex(lat: number, lon: number): Promise<number | null> {
  const url =
    `${OM_FORECAST}?latitude=${lat}&longitude=${lon}&timezone=UTC&past_days=60&forecast_days=7` +
    `&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_min`;
  const j = await getJson<any>(url);
  const d = j?.daily;
  if (!d?.time) return null;
  const n: number = d.time.length;
  const pastIdx = Math.max(0, n - 7);

  const tmax = nums((d.temperature_2m_max ?? []).slice(pastIdx));
  const precip = nums((d.precipitation_sum ?? []).slice(0, pastIdx));
  const wind = nums((d.wind_speed_10m_max ?? []).slice(pastIdx));
  const rh = nums((d.relative_humidity_2m_min ?? []).slice(pastIdx));
  if (!tmax.length) return null;

  const maxTemp = Math.max(...tmax);
  const minRh = rh.length ? Math.min(...rh) : null;
  const maxWind = wind.length ? Math.max(...wind) : null;
  const past60Precip = precip.length ? precip.reduce((a, b) => a + b, 0) : null;

  const heat = clamp((maxTemp - 18) * 3.2);
  const dry = minRh != null ? clamp((60 - minRh) * 2.2) : 40;
  const windScore = maxWind != null ? clamp(maxWind * 1.6) : 35;
  const fuel = past60Precip != null ? clamp((1 - Math.min(1.2, past60Precip / 150)) * 100) : 40;
  return Math.round(clamp(heat * 0.34 + dry * 0.26 + windScore * 0.16 + fuel * 0.24));
}

export type FireAssessment = {
  /** Real satellite detection count, or null if unavailable. */
  wildfire_active_count: number | null;
  /** 0-100 modeled fire-weather proxy — always attempted, always shown
   *  alongside (never in place of) the detection count. */
  fire_weather_index: number | null;
  provenance: Provenance;
};

export async function assessFire(opts: {
  lat: number;
  lon: number;
  bbox?: { w: number; s: number; e: number; n: number } | null;
}): Promise<FireAssessment> {
  const key = process.env.FIRMS_API_KEY;
  const [detections, fwi] = await Promise.all([
    fetchFirmsDetections(opts.lat, opts.lon, { bbox: opts.bbox }),
    fetchFireWeatherIndex(opts.lat, opts.lon),
  ]);

  if (!key) {
    return {
      wildfire_active_count: null,
      fire_weather_index: fwi,
      provenance: {
        status: "unavailable",
        reason:
          "FIRMS_API_KEY not configured — showing modeled fire-weather index only, not satellite detections",
      },
    };
  }
  if (detections == null) {
    return {
      wildfire_active_count: null,
      fire_weather_index: fwi,
      provenance: {
        status: "unavailable",
        reason:
          "NASA FIRMS request failed or returned no data — showing modeled fire-weather index only, not satellite detections",
      },
    };
  }
  return {
    wildfire_active_count: detections,
    fire_weather_index: fwi,
    provenance: {
      status: "live",
      source: "NASA FIRMS VIIRS_SNPP_NRT (area/csv, 24h window)",
      fetchedAt: new Date().toISOString(),
    },
  };
}
