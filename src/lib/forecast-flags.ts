// Client-safe types + presentation helpers for forecast flags.
// Values are computed server-side in hazard-streams.server.ts.

export type FlagLevel = "critical" | "watch" | "normal";

export type ForecastFlag = {
  id: string;
  label: string;
  /** Human status word, e.g. "active", "delayed", "extreme" */
  status: string;
  level: FlagLevel;
  detail: string;
  source: string;
};

export const FLAG_BADGE_CLASS: Record<FlagLevel, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-400",
  watch: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  normal: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
};

export const FLAG_DOT_COLOR: Record<FlagLevel, string> = {
  critical: "#f43f5e",
  watch: "#f59e0b",
  normal: "#22c55e",
};

export const HAZARD_KEYS = [
  "heat",
  "flood",
  "drought",
  "fire",
  "sea_level",
] as const;
export type HazardKey = (typeof HAZARD_KEYS)[number];
export type HotspotKindLive = HazardKey | "compound";

export const HAZARD_TAG: Record<HotspotKindLive, string> = {
  heat: "HEAT",
  flood: "FLOOD",
  drought: "DROUGHT",
  fire: "FIRE",
  sea_level: "SEA-LEVEL",
  compound: "COMPOUND",
};

/** A region is COMPOUND when 2+ hazard categories independently exceed 60. */
export const COMPOUND_THRESHOLD = 60;
export const COMPOUND_MIN_CATEGORIES = 2;
