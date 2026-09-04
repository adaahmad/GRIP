import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, MapPin, Loader2, Info, ChevronDown, Database } from "lucide-react";

import {
  listRegions,
  getRegionMetrics,
  listAdaptationStrategies,
  listRegionAggregates,
  type RegionRow,
} from "@/lib/regions.functions";
import { getLiveClimateMetrics, type LiveClimateMetrics } from "@/lib/openmeteo-live.functions";
import {
  TOPOGRAPHY_LABEL,
  TOPOGRAPHY_COLOR,
  TOPOGRAPHY_METRICS,
  TIER_COLOR,
  composite,
  tier,
  type Topography,
} from "@/lib/topography";
import type { GlobeHotspot } from "@/components/RiskGlobe";
import { ClientOnly } from "@/components/ClientOnly";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const RiskGlobe = lazy(() =>
  import("@/components/RiskGlobe").then((m) => ({ default: m.RiskGlobe })),
);

export const Route = createFileRoute("/regions")({
  head: () => ({
    meta: [
      { title: "Regions — Grip" },
      {
        name: "description",
        content:
          "Topography-aware physical climate risk explorer for alpine, desert, coastal, delta, savanna and boreal regions.",
      },
    ],
  }),
  component: RegionsPage,
});

const TOPO_ORDER: Topography[] = [
  "alpine",
  "desert",
  "coastal",
  "tropical-delta",
  "savanna",
  "boreal",
];

const SCENARIOS = ["SSP2-4.5", "SSP5-8.5"] as const;
const YEARS = [2040, 2050, 2060] as const;

function GlobeStage({
  hotspots,
  selectedId,
  onSelect,
}: {
  hotspots: GlobeHotspot[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setSize({ w: Math.max(280, cr.width), h: Math.max(360, cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative h-full w-full">
      <ClientOnly fallback={<div className="h-full w-full" />}>
        <Suspense fallback={<div className="h-full w-full" />}>
          <RiskGlobe
            hotspots={hotspots}
            selectedId={selectedId}
            onSelect={onSelect}
            width={size.w}
            height={size.h}
          />
        </Suspense>
      </ClientOnly>
    </div>
  );
}

function RegionsPage() {
  const listRegionsFn = useServerFn(listRegions);
  const getMetricsFn = useServerFn(getRegionMetrics);
  const listStrategiesFn = useServerFn(listAdaptationStrategies);
  const listAggregatesFn = useServerFn(listRegionAggregates);
  const getLiveFn = useServerFn(getLiveClimateMetrics);

  const regionsQ = useQuery({
    queryKey: ["regions"],
    queryFn: () => listRegionsFn(),
  });

  const [filter, setFilter] = useState<Topography | "all">("all");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [scenario, setScenario] =
    useState<(typeof SCENARIOS)[number]>("SSP5-8.5");
  const [year, setYear] = useState<(typeof YEARS)[number]>(2050);

  const regions = regionsQ.data ?? [];
  const filtered = useMemo(
    () => (filter === "all" ? regions : regions.filter((r) => r.topography === filter)),
    [regions, filter],
  );

  useEffect(() => {
    if (!selectedSlug && filtered[0]) setSelectedSlug(filtered[0].slug);
  }, [filtered, selectedSlug]);

  const selected = regions.find((r) => r.slug === selectedSlug) ?? null;

  // Bulk aggregates for every region under the current scenario/year — drives globe markers.
  const aggregatesQ = useQuery({
    queryKey: ["region-aggregates", scenario, year],
    queryFn: () => listAggregatesFn({ data: { scenario, year } }),
    staleTime: 5 * 60_000,
  });

  const metricsQ = useQuery({
    queryKey: ["region-metrics", selected?.slug, scenario, year],
    queryFn: () =>
      getMetricsFn({ data: { slug: selected!.slug, scenario, year } }),
    enabled: !!selected,
    staleTime: 60_000,
  });

  const strategiesQ = useQuery({
    queryKey: ["strategies", selected?.topography],
    queryFn: () =>
      listStrategiesFn({ data: { topography: selected!.topography } }),
    enabled: !!selected,
  });

  const liveQ = useQuery({
    queryKey: ["live-climate", selected?.slug],
    queryFn: () =>
      getLiveFn({ data: { lat: selected!.lat, lon: selected!.lon } }),
    enabled: !!selected,
    staleTime: 30 * 60_000,
  });

  // Globe hotspots from real region aggregates (composite scores per region).
  const hotspots: GlobeHotspot[] = useMemo(() => {
    const aggMap = new Map((aggregatesQ.data ?? []).map((a) => [a.slug, a]));
    return filtered.map((r) => {
      const agg = aggMap.get(r.slug);
      const score = agg?.score ?? 0;
      const t = agg?.tier ?? "medium";
      const topo = r.topography as Topography;
      return {
        id: r.slug,
        name: r.name,
        lat: r.lat,
        lng: r.lon,
        tier: t === "low" ? "medium" : t,
        score,
        tag: `${TOPOGRAPHY_LABEL[topo] ?? r.topography} · ${score}`,
        color: TOPOGRAPHY_COLOR[topo],
      };
    });
  }, [filtered, aggregatesQ.data]);

  return (
    <div className="h-[calc(100vh-3.5rem)] grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-3 p-3">
      {/* LEFT — region list */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Topography
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            {TOPO_ORDER.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={filter === t ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                style={
                  filter === t
                    ? { backgroundColor: TOPOGRAPHY_COLOR[t], color: "#0a0c14" }
                    : { borderColor: `${TOPOGRAPHY_COLOR[t]}55`, color: TOPOGRAPHY_COLOR[t] }
                }
                onClick={() => setFilter(t)}
              >
                {TOPOGRAPHY_LABEL[t]}
              </Button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {regionsQ.isLoading && (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading regions…
            </div>
          )}
          {filtered.map((r) => (
            <button
              key={r.slug}
              onClick={() => setSelectedSlug(r.slug)}
              className={`w-full text-left px-3 py-2.5 hover:bg-secondary/60 transition-colors ${
                selectedSlug === r.slug ? "bg-secondary" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: TOPOGRAPHY_COLOR[r.topography as Topography] }}
                />
                <span className="text-sm font-medium">{r.name}</span>
              </div>
              <div className="text-[11px] text-muted-foreground ml-4 mt-0.5">
                {r.country} · {TOPOGRAPHY_LABEL[r.topography as Topography] ?? r.topography}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* CENTER — globe */}
      <Card className="overflow-hidden relative">
        <GlobeStage
          hotspots={hotspots}
          selectedId={selectedSlug ?? undefined}
          onSelect={setSelectedSlug}
        />
        {selected && (
          <div className="absolute top-3 left-3 bg-card/85 backdrop-blur border border-border rounded-md px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <MapPin className="w-3 h-3" />
              {selected.name}
            </div>
            <div className="text-muted-foreground">
              {selected.country} · {TOPOGRAPHY_LABEL[selected.topography as Topography]}
            </div>
          </div>
        )}
      </Card>

      {/* RIGHT — controls + metrics + strategies */}
      <div className="flex flex-col gap-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Card className="p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Scenario
          </div>
          <div className="flex gap-1.5 mb-3">
            {SCENARIOS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={scenario === s ? "default" : "outline"}
                className="h-7 px-2 text-xs flex-1"
                onClick={() => setScenario(s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Year
          </div>
          <div className="flex gap-1.5">
            {YEARS.map((y) => (
              <Button
                key={y}
                size="sm"
                variant={year === y ? "default" : "outline"}
                className="h-7 px-2 text-xs flex-1"
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
        </Card>

        {selected && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Hazard metrics
              </div>
              {metricsQ.isFetching && (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              )}
            </div>
            {selected.description && (
              <p className="text-xs text-muted-foreground mb-3">{selected.description}</p>
            )}
            <LiveClimateTiles data={liveQ.data} loading={liveQ.isLoading} />
            <MetricGrid
              topography={selected.topography as Topography}
              metrics={(metricsQ.data?.metrics ?? {}) as Record<string, number | null>}
            />
            {liveQ.data?.source && (
              <div className="text-[10px] text-muted-foreground mt-3">
                Live: {liveQ.data.source}
              </div>
            )}
            {metricsQ.data?.source && (
              <div className="text-[10px] text-muted-foreground mt-3">
                Sources: {metricsQ.data.source}
              </div>
            )}
          </Card>
        )}

        {selected && <DataSourcesPanel />}



        {selected && (
          <Card className="p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Adaptation strategies
            </div>
            <div className="space-y-2">
              {(strategiesQ.data ?? []).slice(0, 6).map((s: any) => (
                <div
                  key={s.id}
                  className="border border-border rounded-md p-2 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${TIER_COLOR.high}22`,
                        color: TIER_COLOR.high,
                      }}
                    >
                      {s.effectiveness}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {s.description}
                  </div>
                  <div className="flex gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    <span>{"$".repeat(s.cost_tier)}</span>
                    <span>·</span>
                    <span>{s.timeline_years}y</span>
                    {s.hazards?.length ? (
                      <>
                        <span>·</span>
                        <span>{s.hazards.slice(0, 2).join(", ")}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function LiveClimateTiles({
  data,
  loading,
}: {
  data: LiveClimateMetrics | undefined;
  loading: boolean;
}) {
  const fmt = (v: number | null | undefined, digits = 2, suffix = "") =>
    v == null ? "—" : `${v.toFixed(digits)}${suffix}`;
  const items = [
    {
      label: "Temp anomaly vs 1990",
      value: loading ? "…" : fmt(data?.temp_anomaly_c, 2, "°C"),
      hint: data
        ? `Baseline ${fmt(data.baseline_temp_c, 1, "°C")} → recent ${fmt(data.recent_temp_c, 1, "°C")}`
        : "Open-Meteo ERA5",
      source: "Open-Meteo Climate API · ERA5 reanalysis",
    },
    {
      label: "Days > 40°C / yr",
      value: loading
        ? "…"
        : data?.days_over_40c_per_year == null
          ? "—"
          : String(data.days_over_40c_per_year),
      hint: "Mean 2015–2024",
      source: "Open-Meteo Historical Climate",
    },
    {
      label: "Soil moisture idx",
      value: loading ? "…" : fmt(data?.soil_moisture_index, 3, ""),
      hint: "0–10 cm, m³/m³",
      source: "Open-Meteo Climate API",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="border border-border rounded-md p-2 bg-secondary/30"
          title={it.hint}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <span className="truncate">{it.label}</span>
            <Info className="w-2.5 h-2.5 opacity-60 shrink-0" aria-label={it.source}>
              <title>{it.source}</title>
            </Info>
          </div>
          <div className="text-base font-semibold tabular-nums">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

const DATA_SOURCES: Array<{ metric: string; source: string; updated: string }> = [
  { metric: "Temperature anomaly", source: "Open-Meteo Climate API", updated: "Monthly" },
  { metric: "Days above 40°C", source: "Open-Meteo Historical Climate", updated: "Monthly" },
  { metric: "Soil moisture change", source: "Open-Meteo Climate API", updated: "Monthly" },
  { metric: "Solar potential", source: "NASA POWER API", updated: "Annually" },
  {
    metric: "Composite risk score",
    source: "IPCC AR6 Regional Factsheets",
    updated: "Per IPCC assessment cycle",
  },
];

function DataSourcesPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Data sources
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium py-1.5 pr-2">Metric</th>
                <th className="text-left font-medium py-1.5 pr-2">Source</th>
                <th className="text-left font-medium py-1.5">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {DATA_SOURCES.map((row) => (
                <tr key={row.metric} className="align-top">
                  <td className="py-1.5 pr-2 font-medium text-foreground">{row.metric}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{row.source}</td>
                  <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                    {row.updated}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}



function MetricGrid({
  topography,
  metrics,
}: {
  topography: Topography;
  metrics: Record<string, number | null>;
}) {
  const defs = TOPOGRAPHY_METRICS[topography] ?? [];
  const score = composite(topography, metrics);
  const t = tier(score);
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Composite risk
          </div>
          <div
            className="text-3xl font-bold tabular-nums"
            style={{ color: TIER_COLOR[t] }}
          >
            {score}
          </div>
        </div>
        <div
          className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded"
          style={{ backgroundColor: `${TIER_COLOR[t]}22`, color: TIER_COLOR[t] }}
        >
          {t}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {defs.map((d) => {
          const v = metrics[d.key];
          const display =
            typeof v === "number"
              ? Number.isInteger(v)
                ? v
                : v.toFixed(2)
              : "—";
          return (
            <div
              key={d.key}
              className="border border-border rounded-md p-2"
              title={d.hint}
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <span className="truncate">{d.label}</span>
                <Info className="w-2.5 h-2.5 opacity-60 shrink-0">
                  <title>{d.hint ?? d.label}</title>
                </Info>
              </div>

              <div className="text-base font-semibold tabular-nums">
                {display}
                <span className="text-[10px] text-muted-foreground ml-1">
                  {d.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
