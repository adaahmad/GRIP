import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { computeRegionMetrics } from "./regions.server";
import { composite, tier, type Topography } from "./topography";
import type { Provenance } from "./hazard-taxonomy";

/** Fill any metric key missing an explicit provenance entry with a generic
 *  tag for the given status, so every metric the UI reads always has one —
 *  no metric silently reads as "unknown provenance". Fire and sea level
 *  carry precise per-metric provenance from computeRegionMetrics(); the
 *  rest are all Open-Meteo/NASA POWER derived within the same request. */
function fillProvenance(
  metrics: Record<string, unknown>,
  explicit: Partial<Record<string, Provenance>>,
  fallback: Provenance,
): Record<string, Provenance> {
  const out: Record<string, Provenance> = {};
  for (const key of Object.keys(metrics)) {
    out[key] = explicit[key] ?? fallback;
  }
  return out;
}

export type RegionRow = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  topography: string;
  lat: number;
  lon: number;
  bbox: { w: number; s: number; e: number; n: number } | null;
  sectors: string[];
  population: number | null;
  annual_visitors: number | null;
  baseline_revenue_usd: number | null;
  description: string | null;
};

function serverClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export const listRegions = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = serverClient();
  const { data, error } = await supabase.from("regions").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as RegionRow[];
});

export const getRegionMetrics = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { slug: string; scenario: "SSP2-4.5" | "SSP5-8.5"; year: 2040 | 2050 | 2060 }) => data,
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: region, error: regionErr } = await supabase
      .from("regions")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (regionErr) throw new Error(regionErr.message);
    if (!region) throw new Error(`Unknown region: ${data.slug}`);

    const { data: cached } = await supabase
      .from("region_metrics")
      .select("*")
      .eq("region_id", region.id)
      .eq("scenario", data.scenario)
      .eq("year", data.year)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      const ageMs = Date.now() - new Date(cached.computed_at).getTime();
      const provenance = fillProvenance(
        cached.metrics as Record<string, unknown>,
        {},
        {
          status: "cached",
          source: cached.source ?? "region_metrics cache",
          computedAt: cached.computed_at,
          ageMs,
        },
      );
      return { region, metrics: cached.metrics, source: cached.source, provenance, cached: true };
    }

    const result = await computeRegionMetrics({
      topography: region.topography,
      lat: region.lat,
      lon: region.lon,
      bbox: region.bbox,
      scenario: data.scenario,
      year: data.year,
    });

    await supabase.from("region_metrics").upsert(
      {
        region_id: region.id,
        scenario: data.scenario,
        year: data.year,
        metrics: result.metrics,
        source: result.source,
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "region_id,scenario,year" },
    );

    const provenance = fillProvenance(result.metrics, result.provenance, {
      status: "live",
      source: result.source,
      fetchedAt: new Date().toISOString(),
    });
    return { region, metrics: result.metrics, source: result.source, provenance, cached: false };
  });

export const listAdaptationStrategies = createServerFn({ method: "POST" })
  .inputValidator((data: { topography?: string }) => data)
  .handler(async ({ data }) => {
    const supabase = serverClient();
    let q = supabase.from("adaptation_strategies").select("*");
    if (data.topography) q = q.contains("topography", [data.topography]);
    const { data: rows, error } = await q.order("effectiveness", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export type RegionAggregate = {
  slug: string;
  name: string;
  country: string | null;
  topography: Topography;
  lat: number;
  lon: number;
  score: number;
  tier: "critical" | "high" | "medium" | "low";
  metrics: Record<string, number | null>;
  cached: boolean;
};

/** Bulk aggregates for the globe: every region scored under the same scenario/year. */
export const listRegionAggregates = createServerFn({ method: "POST" })
  .inputValidator((data: { scenario: "SSP2-4.5" | "SSP5-8.5"; year: 2040 | 2050 | 2060 }) => data)
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: regions, error: rErr } = await supabase.from("regions").select("*");
    if (rErr) throw new Error(rErr.message);
    const rows = (regions ?? []) as RegionRow[];

    const { data: cacheRows } = await supabase
      .from("region_metrics")
      .select("region_id, metrics, expires_at")
      .eq("scenario", data.scenario)
      .eq("year", data.year);

    const now = Date.now();
    const cacheMap = new Map<string, Record<string, number | null>>();
    for (const c of cacheRows ?? []) {
      if (new Date(c.expires_at).getTime() > now) {
        cacheMap.set(c.region_id as string, c.metrics as Record<string, number | null>);
      }
    }

    // Compute missing in parallel (capped concurrency).
    const missing = rows.filter((r) => !cacheMap.has(r.id));
    const CONCURRENCY = 4;
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const batch = missing.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (r) => {
          try {
            const result = await computeRegionMetrics({
              topography: r.topography,
              lat: r.lat,
              lon: r.lon,
              bbox: r.bbox,
              scenario: data.scenario,
              year: data.year,
            });
            cacheMap.set(r.id, result.metrics);
            await supabase.from("region_metrics").upsert(
              {
                region_id: r.id,
                scenario: data.scenario,
                year: data.year,
                metrics: result.metrics,
                source: result.source,
                computed_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              },
              { onConflict: "region_id,scenario,year" },
            );
          } catch {
            cacheMap.set(r.id, {});
          }
        }),
      );
    }

    const out: RegionAggregate[] = rows.map((r) => {
      const m = cacheMap.get(r.id) ?? {};
      const score = composite(r.topography as Topography, m);
      return {
        slug: r.slug,
        name: r.name,
        country: r.country,
        topography: r.topography as Topography,
        lat: r.lat,
        lon: r.lon,
        score,
        tier: tier(score),
        metrics: m,
        cached: true,
      };
    });
    return out;
  });
