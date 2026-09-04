// Canonical sea-level-rise reference — replaces the two duplicated, mutually
// inconsistent tables that used to live in regions.server.ts (a single
// global curve reused for every region) and hazards.server.ts (a handful of
// named bounding boxes with one fixed value regardless of scenario/year).
//
// There is no free live feed for regional sea-level rise, so this is
// necessarily a STATIC BASELINE — never report it as "live" upstream.
//
// Method: an IPCC AR6 WG1 (Fox-Kemper et al. 2021) global-mean SSP median
// curve, scaled by a coarse regional multiplier that approximates AR6 Ch.9
// regional relative-SLR patterns:
//   - subsiding river deltas (sediment compaction + groundwater extraction)
//     see faster-than-global relative SLR (Bay of Bengal, Mekong, US Gulf,
//     West African deltas)
//   - glacial-isostatic-rebound zones see slower-than-global relative SLR
//     (Baltic/Scandinavia)
// This is a coarse regional-band approximation, NOT per-tide-gauge AR6
// projection data. If a bundled per-location AR6 sea-level tool dataset
// becomes available, swap it in behind `getSeaLevelRiseM()` — nothing
// downstream needs to change.

import type { Provenance } from "./hazard-taxonomy";

export type Scenario = "SSP2-4.5" | "SSP5-8.5";
export type Year = 2040 | 2050 | 2060;

/** Global-mean relative SLR (m) vs. a 1995-2014 baseline, AR6 SSP medians. */
const GLOBAL_CURVE_M: Record<Scenario, Record<Year, number>> = {
  "SSP2-4.5": { 2040: 0.14, 2050: 0.23, 2060: 0.32 },
  "SSP5-8.5": { 2040: 0.17, 2050: 0.29, 2060: 0.42 },
};

type Band = { name: string; test: (lat: number, lon: number) => boolean; multiplier: number };

const REGIONAL_BANDS: Band[] = [
  {
    name: "Bay of Bengal / Ganges-Brahmaputra delta",
    test: (lat, lon) => lat > 5 && lat < 23 && lon > 80 && lon < 100,
    multiplier: 1.5,
  },
  {
    name: "Mekong / SE Asia deltas",
    test: (lat, lon) => lat > 5 && lat < 23 && lon > 100 && lon < 110,
    multiplier: 1.4,
  },
  {
    name: "US Gulf Coast",
    test: (lat, lon) => lat > 24 && lat < 31 && lon > -98 && lon < -80,
    multiplier: 1.6,
  },
  {
    name: "North Sea / NW Europe",
    test: (lat, lon) => lat > 50 && lat < 60 && lon > -5 && lon < 12,
    multiplier: 0.85,
  },
  {
    name: "Baltic / Scandinavia (isostatic rebound)",
    test: (lat, lon) => lat > 55 && lat < 66 && lon > 10 && lon < 30,
    multiplier: 0.4,
  },
  {
    name: "Mediterranean",
    test: (lat, lon) => lat > 30 && lat < 46 && lon > -6 && lon < 36,
    multiplier: 0.75,
  },
  {
    name: "West Africa coast",
    test: (lat, lon) => lat > -5 && lat < 10 && lon > -5 && lon < 10,
    multiplier: 1.3,
  },
  {
    name: "Pacific Small Island States",
    test: (lat, lon) => Math.abs(lat) < 20 && (lon > 130 || lon < -130),
    multiplier: 1.1,
  },
];

const DEFAULT_MULTIPLIER = 1.0;

export type SeaLevelResult = {
  sea_level_rise_m: number;
  band: string;
  multiplier: number;
  provenance: Provenance;
};

/** Static regional sea-level-rise baseline for a point. Always returns a
 *  value — it's the caller's job to decide whether a location is coastal
 *  enough for the number to be meaningful (e.g. via topography). */
export function getSeaLevelRiseM(
  lat: number,
  lon: number,
  scenario: Scenario,
  year: Year,
): SeaLevelResult {
  const global = GLOBAL_CURVE_M[scenario]?.[year] ?? GLOBAL_CURVE_M["SSP2-4.5"][2050];
  const band = REGIONAL_BANDS.find((b) => b.test(lat, lon));
  const multiplier = band?.multiplier ?? DEFAULT_MULTIPLIER;
  const value = Number((global * multiplier).toFixed(3));
  return {
    sea_level_rise_m: value,
    band: band?.name ?? "Global mean (no regional band match)",
    multiplier,
    provenance: {
      status: "static_baseline",
      source: "IPCC AR6 WG1 global-mean SSP median curve × coarse regional multiplier",
      note: "Regional-band approximation, not per-tide-gauge AR6 projection data — treat as an indicative baseline, not a live measurement.",
    },
  };
}
