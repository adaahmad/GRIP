import { createServerFn } from "@tanstack/react-start";

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  return r.json();
}

function mean(xs: number[]): number | null {
  const vs = xs.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!vs.length) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

export type LiveClimateMetrics = {
  temp_anomaly_c: number | null;
  baseline_temp_c: number | null;
  recent_temp_c: number | null;
  days_over_40c_per_year: number | null;
  soil_moisture_index: number | null;
  source: string;
};

export const getLiveClimateMetrics = createServerFn({ method: "POST" })
  .inputValidator((data: { lat: number; lon: number }) => data)
  .handler(async ({ data }): Promise<LiveClimateMetrics> => {
    const { lat, lon } = data;
    const base = `${ARCHIVE}?latitude=${lat}&longitude=${lon}&timezone=UTC`;

    const baselineUrl = `${base}&start_date=1990-01-01&end_date=1999-12-31&daily=temperature_2m_mean`;
    const recentUrl = `${base}&start_date=2015-01-01&end_date=2024-12-31&daily=temperature_2m_mean,temperature_2m_max,soil_moisture_0_to_10cm_mean`;

    const [baseline, recent] = await Promise.all([
      fetchJson(baselineUrl).catch(() => null),
      fetchJson(recentUrl).catch(() => null),
    ]);

    const baseTemps: number[] = baseline?.daily?.temperature_2m_mean ?? [];
    const recTemps: number[] = recent?.daily?.temperature_2m_mean ?? [];
    const recMax: number[] = recent?.daily?.temperature_2m_max ?? [];
    const recSoil: number[] = recent?.daily?.soil_moisture_0_to_10cm_mean ?? [];

    const baseMean = mean(baseTemps);
    const recMean = mean(recTemps);
    const anomaly =
      baseMean != null && recMean != null
        ? Number((recMean - baseMean).toFixed(2))
        : null;

    const years = recMax.length ? Math.max(1, recMax.length / 365) : 1;
    const daysOver40 = recMax.length
      ? Math.round(recMax.filter((t) => t >= 40).length / years)
      : null;

    const soilMean = mean(recSoil);
    const soilIndex = soilMean != null ? Number(soilMean.toFixed(3)) : null;

    return {
      temp_anomaly_c: anomaly,
      baseline_temp_c: baseMean != null ? Number(baseMean.toFixed(2)) : null,
      recent_temp_c: recMean != null ? Number(recMean.toFixed(2)) : null,
      days_over_40c_per_year: daysOver40,
      soil_moisture_index: soilIndex,
      source: "Open-Meteo ERA5 archive (1990 baseline vs 2015–2024)",
    };
  });
