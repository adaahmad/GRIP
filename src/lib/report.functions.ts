import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callClaudeJSON } from "./anthropic.server";

const Input = z.object({
  region: z.object({
    name: z.string(),
    country: z.string(),
    topography: z.string(),
    lat: z.number(),
    lon: z.number(),
    population: z.number().nullable().optional(),
    baseline_revenue_usd: z.number().nullable().optional(),
    sectors: z.array(z.string()).nullable().optional(),
  }),
  scenario: z.enum(["SSP2-4.5", "SSP5-8.5"]),
  year: z.union([z.literal(2040), z.literal(2050), z.literal(2060)]),
  scoreNow: z.number(),
  scoreFuture: z.number(),
  metricsNow: z.record(z.string(), z.number().nullable()),
  metricsFuture: z.record(z.string(), z.number().nullable()),
  topHazards: z.array(
    z.object({
      label: z.string(),
      score: z.number(),
      raw: z.number().nullable(),
      unit: z.string(),
    }),
  ),
  strategies: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable().optional(),
      effectiveness: z.number().nullable().optional(),
      cost_tier: z.number().nullable().optional(),
      timeline_years: z.number().nullable().optional(),
    }),
  ),
  /** The real `source` string from computeRegionMetrics() for this request
   *  (e.g. "open-meteo:climate,nasa:power,..."). data_sources is built
   *  deterministically from this — the model is never asked to guess it. */
  metricsSource: z.string().default(""),
});

export type ReportSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type GeneratedReport = {
  executive_summary: string;
  region_profile: ReportSection;
  physical_hazard_summary: ReportSection;
  climate_projections_2060: ReportSection;
  ecosystem_and_community_exposure: ReportSection;
  adaptation_strategies: ReportSection;
  capital_and_financing_options: ReportSection;
  data_sources: string[];
};

const SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["heading", "paragraphs", "bullets"],
  properties: {
    heading: { type: "string" },
    paragraphs: { type: "array", items: { type: "string" } },
    bullets: { type: "array", items: { type: "string" } },
  },
} as const;

// data_sources is intentionally NOT part of this schema — the model was
// previously free-listing source names it had no way to verify against
// what was actually used for this request. It's now built deterministically
// in the handler from the real `metricsSource` string. See buildDataSources().
const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executive_summary",
    "region_profile",
    "physical_hazard_summary",
    "climate_projections_2060",
    "ecosystem_and_community_exposure",
    "adaptation_strategies",
    "capital_and_financing_options",
  ],
  properties: {
    executive_summary: { type: "string" },
    region_profile: SECTION_SCHEMA,
    physical_hazard_summary: SECTION_SCHEMA,
    climate_projections_2060: SECTION_SCHEMA,
    ecosystem_and_community_exposure: SECTION_SCHEMA,
    adaptation_strategies: SECTION_SCHEMA,
    capital_and_financing_options: SECTION_SCHEMA,
  },
} as const;

/** Human-readable label for each token in a computeRegionMetrics() `source`
 *  string. Unknown tokens pass through verbatim rather than being dropped. */
const SOURCE_LABELS: Record<string, string> = {
  "open-meteo:climate": "Open-Meteo Climate API (CMIP6 ensemble)",
  "open-meteo:archive": "Open-Meteo Archive API (ERA5 reanalysis baseline)",
  "open-meteo:flood": "Open-Meteo Flood API (river discharge)",
  "nasa:power": "NASA POWER climatology",
  "nasa:firms": "NASA FIRMS VIIRS active-fire detections (live satellite)",
  "fire-weather-index (modeled, no FIRMS)":
    "Modeled fire-weather index (Open-Meteo forecast variables — NASA FIRMS unavailable)",
  "ipcc-ar6:slr-regional-baseline":
    "IPCC AR6 WG1 sea-level-rise regional baseline (static projection)",
};

function buildDataSources(metricsSource: string, hasStrategies: boolean): string[] {
  const tokens = metricsSource
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const labels = tokens.map((t) => SOURCE_LABELS[t] ?? t);
  const out = Array.from(new Set(labels));
  out.push(
    hasStrategies
      ? "Grip adaptation-strategy library"
      : "Grip adaptation-strategy library (no entries on file for this topography)",
  );
  return out;
}

export const generateReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<GeneratedReport> => {
    const compactMetrics = (m: Record<string, number | null>) =>
      Object.entries(m)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
        .join(", ");

    const system = `You are Atlas, the reporting agent of Grip — a physical climate risk intelligence platform.
Write structured, regulator-grade intelligence briefings for fund managers, city planners and asset owners.
Ground every statement in the supplied metrics — never state a specific number (a population figure, a species count, a habitat or corridor name, a CapEx amount, a bond size, a percentage) unless it is directly given to you below or is a trivial derivation from numbers given to you (e.g. a percentage change between two given values). If a section would normally need a real-world dataset you have not been given (biodiversity, demographics, financial markets), write qualitatively about what the hazard data implies instead of inventing a figure to sound precise — a client will read this document and may act on any number in it.
Use IPCC AR6 / IFRS S2 / TCFD terminology. Tone: analytical, decisive, decision-ready. British English. No emojis. No marketing fluff.
Every section must include 1–3 paragraphs and 3–6 concrete bullets.`;

    const user = `Produce a 6-section physical climate risk intelligence brief.

REGION
  Name: ${data.region.name}
  Country: ${data.region.country}
  Topography: ${data.region.topography}
  Coordinates: ${data.region.lat.toFixed(3)}, ${data.region.lon.toFixed(3)}
  Population: ${data.region.population ?? "unknown"}
  Baseline revenue (USD): ${data.region.baseline_revenue_usd ?? "unknown"}
  Key sectors: ${(data.region.sectors ?? []).join(", ") || "unknown"}

SCENARIO
  Pathway: ${data.scenario}
  Forward year: ${data.year}
  Composite risk today: ${data.scoreNow}/100
  Composite risk ${data.year}: ${data.scoreFuture}/100 (Δ ${data.scoreFuture - data.scoreNow})

TOP HAZARDS BY ${data.year}
${data.topHazards.map((h) => `  - ${h.label}: ${h.score}/100 (${h.raw ?? "n/a"} ${h.unit})`).join("\n")}

RAW METRICS TODAY: ${compactMetrics(data.metricsNow)}
RAW METRICS ${data.year}: ${compactMetrics(data.metricsFuture)}

CANDIDATE ADAPTATION STRATEGIES FROM LIBRARY
${
  data.strategies.length
    ? data.strategies
        .map(
          (s) =>
            `  - ${s.name} (eff ${s.effectiveness ?? "?"}%, cost tier ${s.cost_tier ?? "?"}, ${s.timeline_years ?? "?"}y): ${s.description ?? ""}`,
        )
        .join("\n")
    : "  (none on file for this topography)"
}

REQUIRED SECTIONS (return exactly these keys):
  1. region_profile — geography, topography, economic character, exposure baseline. Use only the region facts given above (population/revenue/sectors); if a fact is "unknown", say so rather than estimating it.
  2. physical_hazard_summary — hazard-by-hazard read of the current metrics; call out compound risks.
  3. climate_projections_2060 — trajectory to 2060 under ${data.scenario}, with SSP2-4.5 vs SSP5-8.5 framing where relevant.
  4. ecosystem_and_community_exposure — reason ONLY from the hazard metrics and the population figure given above (if population is "unknown", say so). Do NOT invent species names, habitat designations, deforestation rates, or displacement statistics — Grip has no biodiversity or demographic dataset behind such figures. Describe, qualitatively, the kind of ecosystem and livelihood pressure the hazard scores imply.
  5. adaptation_strategies — prioritise from the library above; rank by hazard match, cost, effectiveness and timeline. Add regulator alignment (IFRS S2 / CSRD) where useful. If the library above says "none on file", state plainly that no strategies are on file for this topography and recommend consulting a local adaptation specialist — do not invent strategies to fill the section.
  6. capital_and_financing_options — discuss green/sustainability-linked bonds, blended finance, adaptation-fund pathways, and insurance & parametric options qualitatively. Do NOT state a specific CapEx dollar amount, bond size, or percentage — Grip has no financial dataset behind such numbers. If baseline revenue is given above, you may frame adaptation spend as a qualitative fraction of it (e.g. "a low-single-digit share of baseline revenue"), never an invented absolute figure.

Also return:
  - executive_summary: a single 4–6 sentence paragraph a fund manager could paste into a memo, using only the real figures given above.`;

    const parsed = await callClaudeJSON<Omit<GeneratedReport, "data_sources">>({
      model: "claude-opus-5",
      featureLabel: "Report generation",
      maxTokens: 8192,
      system,
      user,
      schema: REPORT_SCHEMA,
    });

    return {
      ...parsed,
      data_sources: buildDataSources(data.metricsSource, data.strategies.length > 0),
    };
  });
