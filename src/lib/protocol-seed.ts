// Candidate region catalog for the Intelligence Protocol.
//
// Each region carries a *per-hazard* baseline score (0-100) reflecting current
// observed / seasonal conditions (mid-August 2026). The protocol server function
// blends live feeds into these same six channels, so swapping a static channel
// for a live API later is a one-line change in HAZARD_PROVIDERS.

export type HazardKey = "heat" | "flood" | "fire" | "drought" | "sea_level";

export type HotspotKind = HazardKey | "compound";

export type HazardScores = Record<HazardKey, number>;

export type SeedHotspot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Current-condition priors per hazard channel, 0-100. */
  baseline: HazardScores;
  /** Short human context for the panel. */
  context: string;
  /** Derived at runtime — kept for type compatibility with the UI. */
  kind: HotspotKind;
  score: number;
  tag: string;
};

export const HAZARD_KEYS: HazardKey[] = ["heat", "flood", "fire", "drought", "sea_level"];

export const TAG_OF: Record<HotspotKind, string> = {
  heat: "HEAT",
  flood: "FLOOD",
  fire: "FIRE",
  drought: "DROUGHT",
  sea_level: "SEA-LEVEL",
  compound: "COMPOUND",
};

/** A region is COMPOUND when 2+ hazard channels independently exceed this. */
export const COMPOUND_THRESHOLD = 68;
export const COMPOUND_MIN_CATEGORIES = 2;

const b = (
  p: Partial<HazardScores>,
): HazardScores => ({ heat: 20, flood: 20, fire: 15, drought: 20, sea_level: 10, ...p });

type SeedInput = Omit<SeedHotspot, "kind" | "score" | "tag">;

const SEEDS: SeedInput[] = [
  // ---------------- DROUGHT — UK / Europe, Aug 2026 ----------------
  { id: "d1", name: "Wales — Dee & Severn", lat: 52.4, lng: -3.6,
    baseline: b({ drought: 92, heat: 48, fire: 55, flood: 8 }),
    context: "Driest July in ~200 years; most of Wales formally in drought, hosepipe bans in force." },
  { id: "d2", name: "Central & Eastern England", lat: 52.6, lng: -0.9,
    baseline: b({ drought: 89, heat: 55, fire: 58, flood: 10 }),
    context: "Over half of England in official drought status; reservoir storage well below seasonal average." },
  { id: "d3", name: "Iberian Meseta", lat: 39.9, lng: -4.2,
    baseline: b({ drought: 84, heat: 82, fire: 76 }),
    context: "Prolonged rainfall deficit across central Spain with compounding heat." },
  { id: "d4", name: "Rhine–Moselle Basin", lat: 50.0, lng: 7.4,
    baseline: b({ drought: 78, heat: 64, fire: 42 }),
    context: "Low Rhine gauge levels constraining barge freight; ~half of EU under some drought level." },
  { id: "d5", name: "Po Valley", lat: 45.1, lng: 10.3,
    baseline: b({ drought: 80, heat: 74, fire: 40, flood: 30 }),
    context: "Irrigation restrictions across northern Italy; snowpack deficit carried into summer." },
  { id: "d6", name: "Horn of Africa", lat: 5.0, lng: 44.0,
    baseline: b({ drought: 93, heat: 71, fire: 25 }),
    context: "Consecutive failed rainy seasons; pastoral water stress at emergency thresholds." },
  { id: "d7", name: "Southern Madagascar", lat: -24.7, lng: 46.1,
    baseline: b({ drought: 82, heat: 58 }),
    context: "Grand Sud rainfall deficit persisting; crop failure risk elevated." },
  { id: "d8", name: "Australian Outback", lat: -25.3, lng: 133.8,
    baseline: b({ drought: 76, heat: 66, fire: 52 }),
    context: "Interior rainfall deficiency; soil moisture in lowest decile." },

  // ---------------- FIRE — European season, Aug 2026 ----------------
  { id: "f1", name: "Southern England Heaths", lat: 51.1, lng: -0.9,
    baseline: b({ fire: 88, drought: 80, heat: 52 }),
    context: "20,000+ hectares burned this season — a record UK wildfire year." },
  { id: "f2", name: "Provence — Bouches-du-Rhône", lat: 43.5, lng: 5.4,
    baseline: b({ fire: 90, heat: 74, drought: 72 }),
    context: "Extreme fire-weather index with mistral wind amplification." },
  { id: "f3", name: "Gironde — Bordeaux Pine Belt", lat: 44.6, lng: -0.9,
    baseline: b({ fire: 85, drought: 68, heat: 66 }),
    context: "Landes pine plantations at critical fuel dryness." },
  { id: "f4", name: "Attica — North of Athens", lat: 38.15, lng: 23.8,
    baseline: b({ fire: 91, heat: 84, drought: 70 }),
    context: "Active perimeters north of Athens; civil protection at highest alert category." },
  { id: "f5", name: "Castilla y León", lat: 41.7, lng: -5.0,
    baseline: b({ fire: 86, heat: 78, drought: 76 }),
    context: "Large-fire clusters across northwest Spain during heat episode." },
  { id: "f6", name: "Limburg Heath, Netherlands", lat: 51.2, lng: 5.9,
    baseline: b({ fire: 72, drought: 66, heat: 46 }),
    context: "Nature-reserve fire bans; unusually dry peat and heath fuels." },
  { id: "f7", name: "California Coast Ranges", lat: 36.7, lng: -121.7,
    baseline: b({ fire: 84, drought: 70, heat: 58 }),
    context: "Offshore-wind driven ignition risk in cured fuels." },
  { id: "f8", name: "Siberian Taiga", lat: 62.0, lng: 105.0,
    baseline: b({ fire: 80, heat: 55, drought: 48 }),
    context: "Boreal thermal anomalies persisting through the northern summer." },
  { id: "f9", name: "Canadian Shield", lat: 52.5, lng: -95.0,
    baseline: b({ fire: 87, drought: 58, heat: 50 }),
    context: "Large out-of-control boreal perimeters with transboundary smoke transport." },
  { id: "f10", name: "Amazon Arc of Deforestation", lat: -9.5, lng: -56.0,
    baseline: b({ fire: 78, drought: 64, heat: 60 }),
    context: "Burn-season detections rising with dry-season onset." },

  // ---------------- HEAT ----------------
  { id: "h1", name: "Chennai Coast", lat: 13.08, lng: 80.27,
    baseline: b({ heat: 86, flood: 62, sea_level: 58 }),
    context: "Persistent wet-bulb stress with coastal inundation exposure." },
  { id: "h2", name: "Jakarta", lat: -6.2, lng: 106.85,
    baseline: b({ heat: 82, flood: 74, sea_level: 72 }),
    context: "Urban heat island plus land subsidence and tidal flooding." },
  { id: "h3", name: "Pearl River Delta", lat: 22.9, lng: 113.4,
    baseline: b({ heat: 84, flood: 70, sea_level: 62 }),
    context: "Manufacturing corridor under sustained heat and typhoon-season rainfall." },
  { id: "h4", name: "Mumbai Coast", lat: 19.0, lng: 72.9,
    baseline: b({ heat: 80, flood: 78, sea_level: 66 }),
    context: "Monsoon surge overlaid on high humid-heat exposure." },
  { id: "h5", name: "Persian Gulf Coast", lat: 26.2, lng: 50.6,
    baseline: b({ heat: 94, drought: 62, sea_level: 44 }),
    context: "Wet-bulb readings approaching human survivability thresholds." },
  { id: "h6", name: "Karachi", lat: 24.86, lng: 67.01,
    baseline: b({ heat: 88, flood: 58, sea_level: 52 }),
    context: "Dense urban heat exposure with limited cooling infrastructure." },

  // ---------------- FLOOD ----------------
  { id: "w1", name: "Bangladesh Delta", lat: 22.5, lng: 90.4,
    baseline: b({ flood: 92, sea_level: 84, heat: 76, drought: 20 }),
    context: "Peak monsoon discharge on the Brahmaputra–Meghna system with tidal backwater." },
  { id: "w2", name: "Indus Basin, Sindh", lat: 26.0, lng: 68.4,
    baseline: b({ flood: 86, heat: 82, drought: 30 }),
    context: "High river stage with saturated floodplains downstream of monsoon rainfall." },
  { id: "w3", name: "Manila Bay", lat: 14.6, lng: 120.9,
    baseline: b({ flood: 84, sea_level: 66, heat: 70 }),
    context: "Habagat rainfall bands with storm-surge exposure across Metro Manila." },
  { id: "w4", name: "Yangtze Basin", lat: 31.2, lng: 121.5,
    baseline: b({ flood: 80, heat: 72, sea_level: 58 }),
    context: "Mid-basin reservoir levels elevated during plum-rain aftermath." },
  { id: "w5", name: "Kerala Coast", lat: 9.9, lng: 76.26,
    baseline: b({ flood: 82, sea_level: 60, heat: 64 }),
    context: "Orographic monsoon rainfall driving landslide and lowland flooding." },
  { id: "w6", name: "Rio Grande do Sul", lat: -30.0, lng: -53.0,
    baseline: b({ flood: 76, sea_level: 30 }),
    context: "Guaíba basin recovery still fragile after successive flood events." },
  { id: "w7", name: "Gulf Coast Refinery Belt", lat: 29.7, lng: -94.1,
    baseline: b({ flood: 78, sea_level: 64, heat: 72 }),
    context: "Peak Atlantic season rainfall-flood exposure across petrochemical assets." },

  // ---------------- SEA LEVEL ----------------
  { id: "s1", name: "Maldives Atolls", lat: 3.2, lng: 73.2,
    baseline: b({ sea_level: 94, flood: 62, heat: 66 }),
    context: "Mean atoll elevation below 1.5 m; chronic inundation and aquifer salinisation." },
  { id: "s2", name: "Mekong Delta", lat: 10.0, lng: 105.5,
    baseline: b({ sea_level: 88, flood: 74, drought: 46 }),
    context: "Saline intrusion advancing inland with subsidence-amplified relative SLR." },
  { id: "s3", name: "Miami — South Florida", lat: 25.77, lng: -80.19,
    baseline: b({ sea_level: 85, flood: 66, heat: 70 }),
    context: "King-tide nuisance flooding frequency rising on porous limestone." },
  { id: "s4", name: "Venice Lagoon", lat: 45.4, lng: 12.3,
    baseline: b({ sea_level: 82, flood: 58, heat: 56 }),
    context: "Acqua alta events requiring increasingly frequent barrier closures." },
  { id: "s5", name: "Alexandria Coast", lat: 31.2, lng: 29.9,
    baseline: b({ sea_level: 84, flood: 56, heat: 68, drought: 52 }),
    context: "Nile Delta subsidence with coastal erosion and agricultural salinisation." },
  { id: "s6", name: "New Orleans", lat: 29.95, lng: -90.07,
    baseline: b({ sea_level: 80, flood: 72, heat: 66 }),
    context: "Subsiding delta behind levee protection during peak hurricane season." },
  { id: "s7", name: "Tokyo Bay", lat: 35.5, lng: 139.8,
    baseline: b({ sea_level: 74, flood: 58, heat: 72 }),
    context: "Zero-metre zone assets dependent on tidal defence performance." },

  // ---------------- COMPOUND (2+ channels above threshold) ----------------
  { id: "x1", name: "Lagos Coast", lat: 6.45, lng: 3.4,
    baseline: b({ flood: 82, sea_level: 78, heat: 74 }),
    context: "Coastal flooding, relative sea-level rise and humid heat converging on a megacity." },
  { id: "x2", name: "Cape Town", lat: -33.9, lng: 18.4,
    baseline: b({ drought: 74, fire: 76, heat: 52, sea_level: 44 }),
    context: "Fynbos fire weather layered onto multi-year hydrological drought." },
  { id: "x3", name: "Athens Basin", lat: 37.98, lng: 23.72,
    baseline: b({ heat: 86, fire: 84, drought: 72 }),
    context: "Heat, fire weather and water deficit occurring simultaneously." },
  { id: "x4", name: "Sahel Belt", lat: 15.5, lng: 0.5,
    baseline: b({ drought: 86, heat: 84, flood: 54 }),
    context: "Extreme heat with rainfall variability driving flash-flood and crop failure risk." },
];

export const SEED_HOTSPOTS: SeedHotspot[] = SEEDS.map((s) => {
  const kind = classifySeed(s.baseline);
  return { ...s, kind, tag: TAG_OF[kind], score: compositeOf(s.baseline) };
});

/** Highest single channel, or COMPOUND when 2+ channels clear the threshold. */
export function classifySeed(scores: HazardScores): HotspotKind {
  const over = HAZARD_KEYS.filter((k) => scores[k] >= COMPOUND_THRESHOLD);
  if (over.length >= COMPOUND_MIN_CATEGORIES) {
    // Only call it compound when the channels are genuinely comparable
    // (avoids labelling a single dominant hazard as compound).
    const sorted = [...over].sort((a, b) => scores[b] - scores[a]);
    if (scores[sorted[0]] - scores[sorted[1]] <= 12) return "compound";
  }
  return HAZARD_KEYS.reduce<HazardKey>((best, k) => (scores[k] > scores[best] ? k : best), "heat");
}

/** Rank value: worst channel, nudged up by secondary stress. */
export function compositeOf(scores: HazardScores): number {
  const vals = HAZARD_KEYS.map((k) => scores[k]).sort((a, b) => b - a);
  return Math.round(Math.min(100, vals[0] + vals[1] * 0.12));
}

export type Arc = { startLat: number; startLng: number; endLat: number; endLng: number; label: string };
export const ARCS: Arc[] = [
  { startLat: 22.9, startLng: 113.4, endLat: 33.7, endLng: -118.2, label: "PRD → LA" },
  { startLat: 1.35, startLng: 103.8, endLat: 51.95, endLng: 4.13,  label: "SG → Rotterdam" },
  { startLat: 24.5, startLng: 119.5, endLat: 37.45, endLng: 126.6, label: "TPE → ICN" },
  { startLat: 30.55, startLng: 32.35, endLat: 40.6, endLng: -74.05, label: "Suez → NYC" },
  { startLat: -23.55, startLng: -46.6, endLat: 31.23, endLng: 121.47, label: "GRU → SHA" },
  { startLat: 19.43, startLng: -99.13, endLat: 32.78, endLng: -96.8,  label: "MEX → DFW" },
];
