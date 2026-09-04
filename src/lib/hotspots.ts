import type { GlobeHotspot } from "@/components/RiskGlobe";

export type Hotspot = GlobeHotspot & {
  lon: number;
  sector: string;
  /** Real population figure when known — omitted (not invented) otherwise. */
  population?: number | null;
};

export type Continent = "africa" | "asia" | "europe" | "americas" | "oceania";

export const CONTINENTS: Continent[] = ["africa", "asia", "europe", "americas", "oceania"];

export const CONTINENT_LABEL: Record<Continent, string> = {
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  americas: "Americas",
  oceania: "Oceania",
};

/** Coarse continent bucket from lat/lon — a bounding-box heuristic (same
 *  approach as the regional SLR bands in sea-level-reference.ts), not a
 *  geocoding lookup. Good enough for UI filtering of hotspots, including
 *  ones added ad hoc via region search; not meant to be authoritative at
 *  political boundaries. */
export function deriveContinent(lat: number, lon: number): Continent {
  // Oceania: Australia/NZ mainland, plus Pacific islands on either side of
  // the antimeridian.
  if (lat < -10 && lon > 110 && lon < 180) return "oceania";
  if (lat > -25 && lat < 25 && (lon > 155 || lon < -130)) return "oceania";

  // Americas: everything in the western hemisphere's populated longitude band.
  if (lon >= -170 && lon <= -30) return "americas";

  // Africa: roughly -20..52 lon, -35..38 lat.
  if (lat < 38 && lat > -35 && lon >= -20 && lon < 52) return "africa";

  // Europe: north of the Mediterranean, west of the Urals.
  if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 45) return "europe";

  // Default: Asia (the remaining lon/lat space, including the Middle East
  // and Russia east of the Urals).
  return "asia";
}

export const HOTSPOTS: Hotspot[] = [
  // Critical
  {
    id: "bgd",
    name: "Bangladesh Delta",
    lat: 23.7,
    lng: 90.4,
    lon: 90.4,
    sector: "agriculture",
    tag: "FLOOD",
    tier: "critical",
    score: 92,
  },
  {
    id: "mkg",
    name: "Mekong Delta",
    lat: 10.0,
    lng: 105.5,
    lon: 105.5,
    sector: "agriculture",
    tag: "COMPOUND",
    tier: "critical",
    score: 88,
  },
  {
    id: "jkt",
    name: "Jakarta",
    lat: -6.2,
    lng: 106.8,
    lon: 106.8,
    sector: "industrial",
    tag: "WATER + SLR",
    tier: "critical",
    score: 90,
  },
  {
    id: "mdv",
    name: "Maldives Atolls",
    lat: 3.2,
    lng: 73.2,
    lon: 73.2,
    sector: "tourism",
    tag: "SEA-LEVEL",
    tier: "critical",
    score: 94,
  },
  {
    id: "mia",
    name: "Miami / South FL",
    lat: 25.8,
    lng: -80.2,
    lon: -80.2,
    sector: "industrial",
    tag: "SLR + STORM",
    tier: "critical",
    score: 87,
  },
  {
    id: "mnl",
    name: "Manila Bay",
    lat: 14.6,
    lng: 120.9,
    lon: 120.9,
    sector: "industrial",
    tag: "TYPHOON",
    tier: "critical",
    score: 86,
  },
  {
    id: "khi",
    name: "Karachi Coast",
    lat: 24.9,
    lng: 67.0,
    lon: 67.0,
    sector: "industrial",
    tag: "HEATWAVE",
    tier: "critical",
    score: 85,
  },
  {
    id: "lag",
    name: "Lagos Lagoon",
    lat: 6.5,
    lng: 3.4,
    lon: 3.4,
    sector: "industrial",
    tag: "FLOOD + SLR",
    tier: "critical",
    score: 84,
  },

  // High
  {
    id: "med",
    name: "Mediterranean Basin",
    lat: 41.0,
    lng: 15.0,
    lon: 15.0,
    sector: "agriculture",
    tag: "WILDFIRE",
    tier: "high",
    score: 74,
  },
  {
    id: "sah",
    name: "Sahel Corridor",
    lat: 14.0,
    lng: 2.0,
    lon: 2.0,
    sector: "agriculture",
    tag: "DROUGHT",
    tier: "high",
    score: 71,
  },
  {
    id: "cal",
    name: "California Coast",
    lat: 36.7,
    lng: -119.4,
    lon: -119.4,
    sector: "industrial",
    tag: "WILDFIRE",
    tier: "high",
    score: 68,
  },
  {
    id: "dxb",
    name: "Dubai",
    lat: 25.2,
    lng: 55.3,
    lon: 55.3,
    sector: "industrial",
    tag: "WATER + HEAT",
    tier: "high",
    score: 76,
  },
  {
    id: "mum",
    name: "Mumbai",
    lat: 19.0,
    lng: 72.9,
    lon: 72.9,
    sector: "industrial",
    tag: "MONSOON",
    tier: "high",
    score: 78,
  },
  {
    id: "tko",
    name: "Tokyo Bay",
    lat: 35.5,
    lng: 139.8,
    lon: 139.8,
    sector: "industrial",
    tag: "SEISMIC + SLR",
    tier: "high",
    score: 70,
  },
  {
    id: "shg",
    name: "Shanghai / Yangtze",
    lat: 31.2,
    lng: 121.5,
    lon: 121.5,
    sector: "industrial",
    tag: "SUBSIDENCE",
    tier: "high",
    score: 75,
  },
  {
    id: "syd",
    name: "Sydney Basin",
    lat: -33.9,
    lng: 151.2,
    lon: 151.2,
    sector: "industrial",
    tag: "BUSHFIRE",
    tier: "high",
    score: 65,
  },
  {
    id: "ath",
    name: "Athens / Attica",
    lat: 38.0,
    lng: 23.7,
    lon: 23.7,
    sector: "tourism",
    tag: "HEAT + FIRE",
    tier: "high",
    score: 69,
  },
  {
    id: "phx",
    name: "Phoenix",
    lat: 33.5,
    lng: -112.1,
    lon: -112.1,
    sector: "industrial",
    tag: "EXTREME HEAT",
    tier: "high",
    score: 73,
  },
  {
    id: "alp",
    name: "Alpine Arc",
    lat: 46.5,
    lng: 10.5,
    lon: 10.5,
    sector: "tourism",
    tag: "SNOWPACK LOSS",
    tier: "high",
    score: 66,
  },
  {
    id: "nig",
    name: "Niger Delta",
    lat: 5.3,
    lng: 6.0,
    lon: 6.0,
    sector: "industrial",
    tag: "OIL + FLOOD",
    tier: "high",
    score: 72,
  },

  // Medium
  {
    id: "amz",
    name: "Amazon Basin",
    lat: -3.0,
    lng: -60.0,
    lon: -60.0,
    sector: "other",
    tag: "DEFORESTATION",
    tier: "medium",
    score: 52,
  },
  {
    id: "ldn",
    name: "London / Thames",
    lat: 51.5,
    lng: -0.1,
    lon: -0.1,
    sector: "finance",
    tag: "TIDAL SURGE",
    tier: "medium",
    score: 48,
  },
  {
    id: "berl",
    name: "Berlin / Brandenburg",
    lat: 52.5,
    lng: 13.4,
    lon: 13.4,
    sector: "industrial",
    tag: "DROUGHT",
    tier: "medium",
    score: 44,
  },
  {
    id: "chi",
    name: "Chicago / Great Lakes",
    lat: 41.9,
    lng: -87.6,
    lon: -87.6,
    sector: "industrial",
    tag: "POLAR VORTEX",
    tier: "medium",
    score: 41,
  },
  {
    id: "rio",
    name: "Rio de Janeiro",
    lat: -22.9,
    lng: -43.2,
    lon: -43.2,
    sector: "tourism",
    tag: "LANDSLIDE",
    tier: "medium",
    score: 49,
  },
  {
    id: "cpt",
    name: "Cape Town",
    lat: -33.9,
    lng: 18.4,
    lon: 18.4,
    sector: "industrial",
    tag: "DAY ZERO",
    tier: "medium",
    score: 46,
  },
];
