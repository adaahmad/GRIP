// Canonical hazard taxonomy for Grip.
//
// Every page in the app must score locations against this same set of
// categories, computed from the same pipeline (regions.server.ts +
// topography.ts). Do not introduce a page-local hazard list again.
//
// CATEGORIES (5 physical hazards + 1 derived):
//   heat, flood, fire, drought, sea_level   — physical, independently scored
//   compound                                — derived: true when 2+ categories
//                                              clear COMPOUND_THRESHOLD
//
// METRIC → CATEGORY MAPPING (the 14 metrics defined in topography.ts):
//
//   heat        temp_anomaly_c, extreme_heat_days, very_hot_days        [primary]
//               permafrost_loss_pct                                    [sub-metric]
//     Permafrost thaw is temperature-driven, so it sits under Heat, but
//     its consequence (structural/infrastructure risk: roads, buildings,
//     supply routes destabilizing) is categorically different from
//     "too hot to grow this crop". It is never averaged into the blended
//     Heat number — it is surfaced as its own labeled severity so the
//     distinction survives.
//
//   flood       extreme_precip_days, flood_return_5yr_m3s              [primary]
//
//   drought     soil_moisture_change_pct, drought_index                [primary]
//               snowfall_change_pct, ski_season_days                   [sub-metric]
//     Declining snowpack is a leading indicator of future meltwater /
//     water-security stress, not a hazard in its own right, so it lives
//     under Drought conceptually but — same rule as permafrost — is
//     surfaced as its own labeled sub-indicator rather than blended in.
//
//   fire        wildfire_active_count                                  [primary]
//
//   sea_level   sea_level_rise_m, wind_max_ms                          [primary]
//     ("Sea Level & Storm" in UI copy.) wind_max_ms is only ever scored
//     for coastal topography today, and coastal wind extremes co-occur
//     with storm-surge exposure, so it blends directly into this
//     category rather than getting its own top-level hazard.
//
//   (not a hazard) solar_potential_kwh, growing_season_days
//     Both are `higherIsWorse: false` "opportunity" metrics. They are
//     EXCLUDED from every hazard category and from the overall composite
//     risk score — folding them in previously let a sunny/long-season
//     region read as artificially lower-risk. They are scored separately
//     via `opportunity()` in topography.ts and shown as their own score,
//     e.g. "moderate risk, high opportunity" rather than one blended
//     number that hides the tradeoff.
//
// PROVENANCE
//   Every score/metric in the pipeline should be able to say whether it
//   is live, cached, or a static baseline/heuristic — see `Provenance`
//   below. Step 2 wires this for fire (NASA FIRMS) and sea level (IPCC
//   AR6-aligned regional bands); Step 5 wires it into every page's UI.

export type HazardCategory = "heat" | "flood" | "drought" | "fire" | "sea_level";
export type HotspotKind = HazardCategory | "compound";

export const HAZARD_CATEGORIES: HazardCategory[] = [
  "heat",
  "flood",
  "drought",
  "fire",
  "sea_level",
];

export const CATEGORY_LABEL: Record<HazardCategory, string> = {
  heat: "Heat",
  flood: "Flood",
  drought: "Drought",
  fire: "Fire",
  sea_level: "Sea Level & Storm",
};

/** A location is COMPOUND when 2+ categories independently clear this score. */
export const COMPOUND_THRESHOLD = 60;
export const COMPOUND_MIN_CATEGORIES = 2;

/** Metric-key → category, with whether it blends into that category's
 *  arithmetic ("primary") or is tracked under it but shown as its own
 *  distinct, unblended sub-indicator ("sub-metric"). */
export type MetricRole = "primary" | "sub-metric" | "opportunity";

export const METRIC_CATEGORY: Record<
  string,
  { category: HazardCategory | "opportunity"; role: MetricRole }
> = {
  temp_anomaly_c: { category: "heat", role: "primary" },
  extreme_heat_days: { category: "heat", role: "primary" },
  very_hot_days: { category: "heat", role: "primary" },
  permafrost_loss_pct: { category: "heat", role: "sub-metric" },

  extreme_precip_days: { category: "flood", role: "primary" },
  flood_return_5yr_m3s: { category: "flood", role: "primary" },

  soil_moisture_change_pct: { category: "drought", role: "primary" },
  drought_index: { category: "drought", role: "primary" },
  snowfall_change_pct: { category: "drought", role: "sub-metric" },
  ski_season_days: { category: "drought", role: "sub-metric" },

  wildfire_active_count: { category: "fire", role: "primary" },

  sea_level_rise_m: { category: "sea_level", role: "primary" },
  wind_max_ms: { category: "sea_level", role: "primary" },

  solar_potential_kwh: { category: "opportunity", role: "opportunity" },
  growing_season_days: { category: "opportunity", role: "opportunity" },
};

// ---------------------------------------------------------------- provenance

/** How a score/metric was produced. Every number shown in the UI should be
 *  traceable to one of these so the app never implies "live" when it isn't. */
export type Provenance =
  | { status: "live"; source: string; fetchedAt: string }
  | { status: "cached"; source: string; computedAt: string; ageMs: number }
  | { status: "static_baseline"; source: string; note: string }
  | { status: "unavailable"; reason: string };

export function isLive(p: Provenance): boolean {
  return p.status === "live";
}
