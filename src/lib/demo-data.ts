export type DemoAsset = {
  name: string;
  asset_type: string;
  sector: string;
  lat: number;
  lon: number;
  address: string;
  replacement_value_usd: number;
};

export const DEMO_ASSETS: DemoAsset[] = [
  {
    name: "Port of Rotterdam Logistics Hub",
    asset_type: "Logistics",
    sector: "logistics",
    lat: 51.9225,
    lon: 4.4792,
    address: "Rotterdam, Netherlands",
    replacement_value_usd: 800_000_000,
  },
  {
    name: "Punjab Agricultural Co-operative",
    asset_type: "Farm",
    sector: "agriculture",
    lat: 31.1471,
    lon: 75.3412,
    address: "Punjab, India",
    replacement_value_usd: 50_000_000,
  },
  {
    name: "Jakarta Data Centre",
    asset_type: "Infrastructure",
    sector: "other",
    lat: -6.2088,
    lon: 106.8456,
    address: "Jakarta, Indonesia",
    replacement_value_usd: 200_000_000,
  },
  {
    name: "Texas Petrochemical Refinery",
    asset_type: "Industrial",
    sector: "energy",
    lat: 29.7604,
    lon: -95.3698,
    address: "Houston, Texas, USA",
    replacement_value_usd: 1_200_000_000,
  },
  {
    name: "Lagos Commercial District",
    asset_type: "Office",
    sector: "finance",
    lat: 6.5244,
    lon: 3.3792,
    address: "Lagos, Nigeria",
    replacement_value_usd: 120_000_000,
  },
];

export const SECTORS = [
  { id: "manufacturing", label: "Manufacturing" },
  { id: "logistics", label: "Logistics" },
  { id: "agriculture", label: "Agriculture" },
  { id: "finance", label: "Finance" },
  { id: "energy", label: "Energy" },
  { id: "other", label: "Other" },
];

export function sectorColor(sector: string): string {
  switch (sector) {
    case "manufacturing": return "#3b82f6";
    case "logistics": return "#f97316";
    case "agriculture": return "#22c55e";
    case "finance": return "#a855f7";
    case "energy": return "#ef4444";
    default: return "#94a3b8";
  }
}

export function riskColor(score: number | null | undefined): string {
  if (score == null) return "#94a3b8";
  if (score <= 25) return "#22c55e";
  if (score <= 50) return "#f59e0b";
  if (score <= 75) return "#f97316";
  return "#ef4444";
}

export function riskBand(score: number | null | undefined): "low" | "medium" | "elevated" | "high" | "unknown" {
  if (score == null) return "unknown";
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "elevated";
  return "high";
}
