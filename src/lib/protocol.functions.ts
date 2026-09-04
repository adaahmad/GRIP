import { createServerFn } from "@tanstack/react-start";
import {
  SEED_HOTSPOTS,
  ARCS,
  HAZARD_KEYS,
  TAG_OF,
  classifySeed,
  compositeOf,
  type SeedHotspot,
  type HotspotKind,
  type HazardKey,
  type HazardScores,
} from "./protocol-seed";

export type LiveHotspot = SeedHotspot & {
  scores: HazardScores;
  source: string;
  note: string;
  live: boolean;
};

export type ProtocolSignals = {
  hotspots: LiveHotspot[];
  arcs: typeof ARCS;
  /** Share of signals in the top tier vs the seeded baseline, for the Δ readout. */
  deltaPct: number;
  computedAt: string;
  lastUpdated: string;
  nextRefreshAt: string;
  warnings: string[];
};

let CACHE: { value: ProtocolSignals; expiresAt: number } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;
const TOP_N = 30;
const MIN_PER_CATEGORY = 4;

type Observation = {
  maxTemp7d: number | null;
  precip7d: number | null;
  /** Days in the next 7 with < 1mm precipitation — dryness proxy. */
  dryDays: number | null;
};

// Single keyless fetch feeding several hazard channels.
async function observe(lat: number, lon: number): Promise<Observation | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,precipitation_sum&forecast_days=7&timezone=UTC`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j: any = await r.json();
    const tmax: number[] = j?.daily?.temperature_2m_max ?? [];
    const psum: number[] = j?.daily?.precipitation_sum ?? [];
    return {
      maxTemp7d: tmax.length ? Math.max(...tmax) : null,
      precip7d: psum.length ? psum.reduce((a, b) => a + b, 0) : null,
      dryDays: psum.length ? psum.filter((p) => p < 1).length : null,
    };
  } catch {
    return null;
  }
}

/**
 * Per-hazard live providers. Each returns a 0-100 score or null to fall back to
 * the region's seeded baseline. Swapping a channel for a dedicated live source
 * (NASA FIRMS for fire, Copernicus CDS for sea level / flood modelling) means
 * replacing one function here — nothing downstream changes.
 */
const HAZARD_PROVIDERS: Record<HazardKey, (o: Observation | null) => number | null> = {
  heat: (o) =>
    o?.maxTemp7d == null ? null : clamp(((o.maxTemp7d - 22) / 22) * 100),
  flood: (o) =>
    o?.precip7d == null ? null : clamp((o.precip7d / 140) * 100),
  drought: (o) =>
    o?.dryDays == null ? null : clamp((o.dryDays / 7) * 85),
  // TODO: NASA FIRMS area CSV — active thermal anomaly density.
  fire: () => null,
  // TODO: Copernicus CDS — relative sea-level / surge reanalysis.
  sea_level: () => null,
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Live observations can only push a channel up from its structural baseline. */
function blend(baseline: HazardScores, o: Observation | null): HazardScores {
  const out = { ...baseline };
  for (const k of HAZARD_KEYS) {
    const live = HAZARD_PROVIDERS[k](o);
    if (live == null) continue;
    out[k] = clamp(Math.max(baseline[k], baseline[k] * 0.6 + live * 0.4));
  }
  return out;
}

/** Keep the feed representative: fill every category before topping up by score. */
function rank(all: LiveHotspot[]): LiveHotspot[] {
  const byScore = [...all].sort((a, b) => b.score - a.score);
  const picked = new Set<string>();
  const out: LiveHotspot[] = [];

  for (const kind of [...HAZARD_KEYS, "compound"] as HotspotKind[]) {
    for (const h of byScore.filter((x) => x.kind === kind).slice(0, MIN_PER_CATEGORY)) {
      picked.add(h.id);
      out.push(h);
    }
  }
  for (const h of byScore) {
    if (out.length >= TOP_N) break;
    if (!picked.has(h.id)) { picked.add(h.id); out.push(h); }
  }
  return out.sort((a, b) => b.score - a.score);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

export const getProtocolSignals = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProtocolSignals> => {
    if (CACHE && CACHE.expiresAt > Date.now()) return CACHE.value;

    const warnings: string[] = [];

    const enriched = await mapWithConcurrency(SEED_HOTSPOTS, 6, async (h): Promise<LiveHotspot> => {
      const o = await observe(h.lat, h.lng);
      if (!o) warnings.push(`${h.id}: live observation unavailable, using baseline`);
      const scores = blend(h.baseline, o);
      const kind = classifySeed(scores);
      const score = compositeOf(scores);
      const parts = HAZARD_KEYS.map((k) => `${TAG_OF[k].toLowerCase()} ${scores[k]}`).join(" · ");
      return {
        ...h,
        scores,
        kind,
        tag: TAG_OF[kind],
        score,
        source: o
          ? "Open-Meteo forecast (heat / flood / drought channels) + regional hazard baselines"
          : "Regional hazard baselines (live feed unavailable)",
        note: `${h.context} Channels: ${parts}.`,
        live: !!o,
      };
    });

    const ranked = rank(enriched);
    const baselineAvg =
      ranked.reduce((s, h) => s + compositeOf(h.baseline), 0) / Math.max(1, ranked.length);
    const liveAvg = ranked.reduce((s, h) => s + h.score, 0) / Math.max(1, ranked.length);
    const deltaPct = Math.round(((liveAvg - baselineAvg) / Math.max(1, baselineAvg)) * 1000) / 10;

    const now = new Date();
    const value: ProtocolSignals = {
      hotspots: ranked,
      arcs: ARCS,
      deltaPct,
      computedAt: now.toISOString(),
      lastUpdated: now.toISOString(),
      nextRefreshAt: new Date(now.getTime() + TTL_MS).toISOString(),
      warnings,
    };
    CACHE = { value, expiresAt: now.getTime() + TTL_MS };
    return value;
  },
);
