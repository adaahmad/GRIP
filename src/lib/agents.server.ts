// Grip — 5-agent intelligence system (Terra, Echo, Sage, Oracle, Herald).
// Calls the Anthropic Messages API directly (ANTHROPIC_API_KEY) via the
// shared callClaudeJSON() helper — see anthropic.server.ts.

import { callClaudeJSON } from "./anthropic.server";

// ───────────────────────────── Schemas ─────────────────────────────
const terraSchema = {
  type: "object",
  additionalProperties: false,
  required: ["primary_driver", "risk_narrative"],
  properties: {
    primary_driver: { type: "string" },
    risk_narrative: { type: "string" },
  },
} as const;

// Echo has no live biodiversity/deforestation/habitat dataset behind it, so
// its schema deliberately carries ONLY a narrative field — no species
// names, corridor names, deforestation rates, or health scores, all of
// which would be fabricated. See runEcho() for the grounding this
// narrative is required to reason from instead.
const echoSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ecosystem_narrative"],
  properties: {
    ecosystem_narrative: { type: "string" },
  },
} as const;

// Sage's RCI score is computed deterministically in computeRci() below from
// two real inputs (water-stress score, planned demand) — the model never
// generates it. Population/food-security/jobs figures were previously
// asked for with no dataset behind them; removed. See runSage().
const sageSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rci_explanation", "community_narrative"],
  properties: {
    rci_explanation: { type: "string" },
    community_narrative: { type: "string" },
  },
} as const;

/** Deterministic RCI (Resource Competition Index) — no LLM involved.
 *  Blends the real water-stress score with the real planned demand
 *  (normalized against the UI's 0-5000 m3/day slider range). Replaces the
 *  old approach of asking the model to invent this number itself. */
export function computeRci(
  waterStressScore: number,
  plannedWaterDemandM3Daily: number,
): { score: number; flag: boolean } {
  const demandPressure = Math.max(0, Math.min(100, (plannedWaterDemandM3Daily / 5000) * 100));
  const score = Math.round(waterStressScore * 0.6 + demandPressure * 0.4);
  return { score, flag: score >= 65 };
}

const oracleSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "scenario_2030",
    "scenario_2040",
    "scenario_2050",
    "decision",
    "decision_rationale",
    "tripwires",
    "synthesis_confidence",
  ],
  properties: {
    scenario_2030: { type: "string" },
    scenario_2040: { type: "string" },
    scenario_2050: { type: "string" },
    decision: {
      type: "string",
      enum: ["PROCEED", "PROCEED WITH MODIFICATIONS", "DELAY OR SEEK ALTERNATIVE"],
    },
    decision_rationale: { type: "string" },
    tripwires: { type: "array", items: { type: "string" } },
    synthesis_confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} as const;

const heraldSchema = {
  type: "object",
  additionalProperties: false,
  required: ["script"],
  properties: { script: { type: "string" } },
} as const;

// Atlas has no real financial/economic dataset behind it, so dollar
// figures, payback periods, and funding-mix percentages were previously
// fabricated with false precision. The schema now asks only for qualitative
// strategic reasoning — which funding pools are plausible and why, not how
// much of each.
const atlasSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "funding_sources",
    "cross_sector_synergies",
    "overlooked_factors",
    "quick_wins",
  ],
  properties: {
    headline: { type: "string" },
    funding_sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "rationale"],
        properties: {
          source: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
    cross_sector_synergies: { type: "array", items: { type: "string" } },
    overlooked_factors: { type: "array", items: { type: "string" } },
    quick_wins: { type: "array", items: { type: "string" } },
  },
} as const;

export type AtlasOutput = {
  headline: string;
  funding_sources: { source: string; rationale: string }[];
  cross_sector_synergies: string[];
  overlooked_factors: string[];
  quick_wins: string[];
};

export async function runAtlas(opts: {
  region: string;
  sector: string;
  terra: unknown;
  echo: unknown;
  sage: unknown;
  oracle: unknown;
}) {
  return callClaudeJSON<AtlasOutput>({
    model: "claude-opus-5",
    featureLabel: "AI briefing",
    // Atlas is the last agent in the chain (sees Terra+Echo+Sage+Oracle as
    // input) and has the most complex schema — measured runs put it at
    // 3600-3700 of a 4096 max_tokens budget, with adaptive-thinking spend
    // alone varying by over 1000 tokens run-to-run. Give real headroom.
    maxTokens: 8192,
    schema: atlasSchema,
    system:
      "You are Atlas, Grip's resource allocation and capital strategist. Given the region's physical, ecosystem, community and oracle outputs, you design a concrete funding & resource STRATEGY, not a financial model. Grip has no real financial/economic dataset behind specific figures, so NEVER state a CapEx amount, payback period, or percentage share for any funding source — that would be fabricated precision. Always name SPECIFIC, region-appropriate funding pools: local tax bases, dominant industries (e.g. Dubai = tourism levies, real-estate transfer fees, DEWA tariffs, sovereign wealth like ICD/Mubadala), multilateral instruments (GCF, World Bank IBRD, AIIB, EIB, IDB), sector cross-subsidies (e.g. cruise port fees funding mangrove restoration), blended finance, catastrophe bonds, parametric insurance, carbon credits, debt-for-nature swaps. funding_sources should list 3-5 sources, each with a one-sentence rationale — no numbers attached. cross_sector_synergies are non-obvious links (e.g. desalination brine → lithium recovery → battery storage revenue). overlooked_factors are 3-5 risks/opportunities a normal climate brief misses (permitting timelines, grid interconnection queues, labor mobility, insurance retreat, indigenous consent, sand mining bans, religious water rights). quick_wins are 90-day no-regret actions.",
    user: `Region: ${opts.region}. Sector: ${opts.sector}.
TERRA: ${JSON.stringify(opts.terra)}
ECHO: ${JSON.stringify(opts.echo)}
SAGE: ${JSON.stringify(opts.sage)}
ORACLE: ${JSON.stringify(opts.oracle)}`,
  });
}

// ───────────────────────────── Agents ─────────────────────────────

export type HazardSnapshot = {
  flood: { now: number; y2050: number };
  heat: { now: number; y2050: number };
  water: { now: number; y2050: number };
  wildfire: { now: number; y2050: number };
  sea_level: { now: number; y2050: number };
  wind: { now: number; y2050: number };
  composite_now: number;
  composite_2050: number;
};

export async function runTerra(opts: {
  region: string;
  lat: number;
  lon: number;
  scores: HazardSnapshot;
}) {
  return callClaudeJSON<{ primary_driver: string; risk_narrative: string }>({
    model: "claude-sonnet-5",
    featureLabel: "AI briefing",
    schema: terraSchema,
    system:
      "You are Terra, Grip's physical climate risk specialist. You ground every claim in the supplied NASA POWER, WRI Aqueduct, NASA FIRMS, and IPCC AR6 numbers. Never use 'significant' without a number. 2-3 sentences for risk_narrative, citing the specific scores given.",
    user: `Region: ${opts.region} (${opts.lat.toFixed(2)}, ${opts.lon.toFixed(2)}).
Hazard scores (0-100, now / 2050 SSP2-4.5):
- Flood: ${opts.scores.flood.now} / ${opts.scores.flood.y2050}
- Heat: ${opts.scores.heat.now} / ${opts.scores.heat.y2050}
- Water stress: ${opts.scores.water.now} / ${opts.scores.water.y2050}
- Wildfire: ${opts.scores.wildfire.now} / ${opts.scores.wildfire.y2050}
- Sea level: ${opts.scores.sea_level.now} / ${opts.scores.sea_level.y2050}
- Wind/storm: ${opts.scores.wind.now} / ${opts.scores.wind.y2050}
Composite: ${opts.scores.composite_now} now → ${opts.scores.composite_2050} in 2050.
Return primary_driver (the highest-scoring hazard by name) and risk_narrative.`,
  });
}

export async function runEcho(opts: {
  region: string;
  lat: number;
  lon: number;
  hazards: HazardSnapshot;
}) {
  return callClaudeJSON<{ ecosystem_narrative: string }>({
    model: "claude-sonnet-5",
    featureLabel: "AI briefing",
    schema: echoSchema,
    system:
      "You are Echo, Grip's ecosystem-risk interpreter. You have NO live biodiversity, deforestation, or habitat-designation dataset. NEVER state a specific species name, protected-area name, migration-corridor name, deforestation percentage, or an invented ecosystem health score — Grip has no data to back any of that and stating one would be fabricated. Instead, reason qualitatively from the REAL physical hazard scores you are given about the kind of ecosystem stress they imply — e.g. a high wildfire score implies fire-adapted ecosystem pressure, high water stress implies riparian/wetland pressure, high heat implies thermal stress on temperature-sensitive species. Cite the actual scores you were given. 2-3 sentences, no invented figures.",
    user: `Region: ${opts.region} at (${opts.lat.toFixed(2)}, ${opts.lon.toFixed(2)}).
Real hazard scores (0-100, now): flood ${opts.hazards.flood.now}, heat ${opts.hazards.heat.now}, water stress ${opts.hazards.water.now}, wildfire ${opts.hazards.wildfire.now}, sea level ${opts.hazards.sea_level.now}.`,
  });
}

export async function runSage(opts: {
  region: string;
  lat: number;
  lon: number;
  waterStressScore: number;
  plannedWaterDemandM3Daily: number;
  population: number | null;
  rciScore: number;
  rciFlag: boolean;
}) {
  return callClaudeJSON<{ rci_explanation: string; community_narrative: string }>({
    model: "claude-sonnet-5",
    featureLabel: "AI briefing",
    schema: sageSchema,
    system:
      "You are Sage, Grip's community and social risk specialist. The Resource Competition Index (RCI) is already computed for you — do not recompute or restate a different number, just explain what it means. You have NO demographic, food-security, or employment dataset: never invent a population figure — if one is given below, you may cite exactly that number; if it says unavailable, say plainly that demographic data is unavailable for this location rather than estimating one. Never invent a watershed-availability total, a food-security phase, or a jobs figure. 2-3 sentences in community_narrative.",
    user: `Region: ${opts.region} (${opts.lat.toFixed(2)}, ${opts.lon.toFixed(2)}).
Local water-stress score (0-100, Grip baseline): ${opts.waterStressScore}.
Planned business water demand: ${opts.plannedWaterDemandM3Daily} m³/day.
Computed RCI: ${opts.rciScore}/100 (${opts.rciFlag ? "FLAGGED — demand materially competes with local use" : "not flagged"}).
Population: ${opts.population != null ? opts.population.toLocaleString() : "not available — do not invent one"}.`,
  });
}

export async function runOracle(opts: {
  region: string;
  terra: unknown;
  echo: unknown;
  sage: unknown;
  scenario: "SSP1-2.6" | "SSP2-4.5" | "SSP5-8.5";
}) {
  return callClaudeJSON<{
    scenario_2030: string;
    scenario_2040: string;
    scenario_2050: string;
    decision: "PROCEED" | "PROCEED WITH MODIFICATIONS" | "DELAY OR SEEK ALTERNATIVE";
    decision_rationale: string;
    tripwires: string[];
    synthesis_confidence: "low" | "medium" | "high";
  }>({
    model: "claude-opus-5",
    featureLabel: "AI briefing",
    // Same headroom reasoning as Atlas — Oracle synthesizes all three
    // upstream agents and runs adaptive thinking on Opus 5.
    maxTokens: 8192,
    schema: oracleSchema,
    system:
      "You are Oracle, Grip's synthesis intelligence. You receive Terra (physical), Echo (ecosystem), Sage (community) outputs and produce forward narratives, a decision, and exactly 3 measurable tripwires. Cite the agents by name. 2-sentence scenarios.",
    user: `Region: ${opts.region}. Scenario pathway: ${opts.scenario}.
TERRA: ${JSON.stringify(opts.terra)}
ECHO: ${JSON.stringify(opts.echo)}
SAGE: ${JSON.stringify(opts.sage)}`,
  });
}

export async function runHerald(opts: {
  region: string;
  oracle: any;
  terra: any;
  echo: any;
  sage: any;
}) {
  const { script } = await callClaudeJSON<{ script: string }>({
    model: "claude-sonnet-5",
    featureLabel: "AI briefing",
    schema: heraldSchema,
    system:
      "You are Herald, Grip's voice briefing writer. Produce a ~150-word spoken briefing. Active voice. Never 'significant' without a number. No 'may'/'could' — use 'is projected to' / 'data indicates'. Exact structure: 'Briefing: [Region]. [physical risk + number]. [ecosystem indicator + value]. [community dimension]. [Oracle decision]. [most important tripwire]. Ask me anything specific about this region.'",
    user: `Region: ${opts.region}
TERRA: ${JSON.stringify(opts.terra)}
ECHO: ${JSON.stringify(opts.echo)}
SAGE: ${JSON.stringify(opts.sage)}
ORACLE: ${JSON.stringify(opts.oracle)}`,
  });
  return script;
}
