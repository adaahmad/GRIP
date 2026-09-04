import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import {
  listRegions,
  getRegionMetrics,
  listAdaptationStrategies,
  type RegionRow,
} from "@/lib/regions.functions";
import {
  TOPOGRAPHY_LABEL,
  TOPOGRAPHY_COLOR,
  TOPOGRAPHY_METRICS,
  composite,
  tier,
  type Topography,
} from "@/lib/topography";
import { generateReport, type GeneratedReport, type ReportSection } from "@/lib/report.functions";
import { GroundingBadge } from "@/components/GroundingBadge";
import {
  FileText,
  Download,
  Loader2,
  AlertTriangle,
  Sparkles,
  MapPin,
  Globe2,
  Activity,
  TrendingUp,
  Leaf,
  ShieldAlert,
  Coins,
} from "lucide-react";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Intelligence Brief — Grip" },
      {
        name: "description",
        content:
          "AI-generated regulator-grade climate risk brief per region — six structured sections covering profile, hazards, projections, exposure, adaptation and capital.",
      },
    ],
  }),
  component: ReportPage,
});

type Scenario = "SSP2-4.5" | "SSP5-8.5";
type Year = 2040 | 2050 | 2060;

const NORM: Record<string, { min: number; max: number; invert?: boolean }> = {
  temp_anomaly_c: { min: 0, max: 6 },
  snowfall_change_pct: { min: -60, max: 0, invert: true },
  ski_season_days: { min: 60, max: 180, invert: true },
  extreme_precip_days: { min: 0, max: 30 },
  extreme_heat_days: { min: 0, max: 180 },
  soil_moisture_change_pct: { min: -40, max: 0, invert: true },
  solar_potential_kwh: { min: 3, max: 8, invert: true },
  sea_level_rise_m: { min: 0, max: 1.2 },
  wind_max_ms: { min: 5, max: 35 },
  flood_return_5yr_m3s: { min: 0, max: 30000 },
  drought_index: { min: -2.5, max: 0, invert: true },
  wildfire_active_count: { min: 0, max: 200 },
  permafrost_loss_pct: { min: 0, max: 80 },
  growing_season_days: { min: 60, max: 240, invert: true },
};

function normalize(key: string, value: number) {
  const n = NORM[key] ?? { min: 0, max: 1 };
  const r = (Math.max(n.min, Math.min(n.max, value)) - n.min) / (n.max - n.min || 1);
  return Math.round((n.invert ? 1 - r : r) * 100);
}

const SSP58_MULT: Record<string, number> = {
  temp_anomaly_c: 1.5,
  extreme_heat_days: 1.7,
  extreme_precip_days: 1.35,
  sea_level_rise_m: 1.45,
  wildfire_active_count: 1.6,
  drought_index: 1.45,
  permafrost_loss_pct: 1.7,
  wind_max_ms: 1.15,
  snowfall_change_pct: 1.5,
  soil_moisture_change_pct: 1.5,
  flood_return_5yr_m3s: 1.3,
  ski_season_days: 0.75,
};

function applyScenario(m: Record<string, number | null> | undefined, s: Scenario) {
  if (!m) return {};
  if (s === "SSP2-4.5") return { ...m };
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v !== "number") {
      out[k] = v;
      continue;
    }
    const mult = SSP58_MULT[k];
    out[k] = mult == null ? v : Number((v * mult).toFixed(3));
  }
  return out;
}

type Brief = {
  region: RegionRow;
  scenario: Scenario;
  year: Year;
  scoreNow: number;
  scoreFuture: number;
  tierNow: ReturnType<typeof tier>;
  tierFuture: ReturnType<typeof tier>;
  metricsNow: Record<string, number | null>;
  metricsFuture: Record<string, number | null>;
  topHazards: Array<{ label: string; score: number; raw: number | null; unit: string }>;
  strategies: any[];
  report: GeneratedReport;
  generatedAt: string;
};

const TIER_COLOR: Record<ReturnType<typeof tier>, string> = {
  critical: "text-risk-critical border-risk-critical/40 bg-risk-critical/10",
  high: "text-risk-high border-risk-high/40 bg-risk-high/10",
  medium: "text-risk-medium border-risk-medium/40 bg-risk-medium/10",
  low: "text-risk-low border-risk-low/40 bg-risk-low/10",
};

function scoreColor(s: number) {
  return s >= 75
    ? "text-risk-critical"
    : s >= 55
      ? "text-risk-high"
      : s >= 35
        ? "text-risk-medium"
        : "text-risk-low";
}

function ReportPage() {
  const listRegionsFn = useServerFn(listRegions);
  const getMetricsFn = useServerFn(getRegionMetrics);
  const listStrategiesFn = useServerFn(listAdaptationStrategies);
  const generateReportFn = useServerFn(generateReport);

  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>("SSP5-8.5");
  const [year, setYear] = useState<Year>(2050);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");

  useEffect(() => {
    setRegionsLoading(true);
    listRegionsFn()
      .then((rs) => {
        setRegions(rs);
        setSelectedSlug((p) => p ?? rs[0]?.slug ?? null);
      })
      .catch((e) => setErr(e?.message ?? String(e)))
      .finally(() => setRegionsLoading(false));
  }, []);

  const region = regions.find((r) => r.slug === selectedSlug) ?? null;

  const generate = async () => {
    if (!region) return;
    setLoading(true);
    setErr(null);
    setBrief(null);
    try {
      setPhase("Pulling live hazard metrics…");
      const [nowRes, futureRes, strategies] = await Promise.all([
        getMetricsFn({ data: { slug: region.slug, scenario: "SSP2-4.5", year: 2040 } }),
        getMetricsFn({ data: { slug: region.slug, scenario, year } }),
        listStrategiesFn({ data: { topography: region.topography } }),
      ]);
      const metricsNow = nowRes.metrics as Record<string, number | null>;
      const metricsFuture = applyScenario(futureRes.metrics as any, scenario);
      const topo = region.topography as Topography;
      const scoreNow = composite(topo, metricsNow);
      const scoreFuture = composite(topo, metricsFuture);
      const defs = TOPOGRAPHY_METRICS[topo];
      const topHazards = defs
        .map((d) => {
          const raw = metricsFuture[d.key];
          return {
            label: d.label,
            score: typeof raw === "number" ? normalize(d.key, raw) : 0,
            raw: typeof raw === "number" ? raw : null,
            unit: d.unit ?? "",
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const stratList = (strategies ?? []).slice(0, 12).map((s: any) => ({
        name: s.name,
        description: s.description,
        effectiveness: s.effectiveness,
        cost_tier: s.cost_tier,
        timeline_years: s.timeline_years,
      }));

      setPhase("Atlas is drafting the six-section brief…");
      const report = await generateReportFn({
        data: {
          region: {
            name: region.name,
            country: region.country,
            topography: region.topography,
            lat: region.lat,
            lon: region.lon,
            population: region.population,
            baseline_revenue_usd: region.baseline_revenue_usd,
            sectors: region.sectors,
          },
          scenario,
          year,
          scoreNow,
          scoreFuture,
          metricsNow,
          metricsFuture,
          topHazards,
          strategies: stratList,
          metricsSource: futureRes.source ?? "",
        },
      });

      setBrief({
        region,
        scenario,
        year,
        scoreNow,
        scoreFuture,
        tierNow: tier(scoreNow),
        tierFuture: tier(scoreFuture),
        metricsNow,
        metricsFuture,
        topHazards,
        strategies: stratList,
        report,
        generatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
      setPhase("");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground min-h-0">
      <header className="border-b border-border px-6 py-4">
        <Breadcrumb items={["Grip", "Generate Report"]} />
        <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Intelligence Brief
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Atlas — the Grip reporting agent — generates a regulator-grade 6-section brief per
              region.
            </p>
          </div>
          {brief && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadPdf(brief)}
              className="gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Download as PDF
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-0">
        <aside className="border-r border-border bg-card/30 p-4 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Region
            </div>
            {regionsLoading && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading regions…
              </div>
            )}
            <div className="space-y-1.5">
              {regions.map((r) => {
                const active = selectedSlug === r.slug;
                return (
                  <button
                    key={r.slug}
                    onClick={() => setSelectedSlug(r.slug)}
                    className={`w-full text-left rounded-md border p-2 transition-all ${
                      active ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: TOPOGRAPHY_COLOR[r.topography as Topography] }}
                      />
                      <span className="text-xs font-medium truncate">{r.name}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-0.5 ml-3.5">
                      {r.country} · {TOPOGRAPHY_LABEL[r.topography as Topography]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Scenario
            </div>
            <div className="flex gap-1">
              {(["SSP2-4.5", "SSP5-8.5"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                    scenario === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Forward year
            </div>
            <div className="flex gap-1">
              {([2040, 2050, 2060] as const).map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                    year === y
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-accent"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} disabled={loading || !region} className="w-full gap-2">
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate brief
              </>
            )}
          </Button>

          {err && (
            <div className="flex items-start gap-2 text-[11px] text-risk-critical p-2 rounded bg-risk-critical/10 border border-risk-critical/30">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              {err}
            </div>
          )}
        </aside>

        <main className="overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.06),_transparent_60%)]">
          {!brief && !loading && (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
              Select a region, scenario and forward year, then generate a regulator-grade brief with
              region profile, physical hazards, projections to 2060, ecosystem &amp; community
              exposure, adaptation strategies and capital / financing options.
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
              <div className="text-sm">{phase || "Generating…"}</div>
            </div>
          )}

          {brief && <BriefView brief={brief} />}
        </main>
      </div>
    </div>
  );
}

const SECTION_ICON: Array<{
  key: keyof GeneratedReport;
  icon: any;
  color: string;
  label: string;
  /** Whether this section is narrating real supplied data, or reasoning
   *  qualitatively without a dataset behind it. Adaptation strategies is
   *  dynamic — grounded only when the strategy library actually had rows. */
  grounded: boolean | ((brief: Brief) => boolean);
}> = [
  {
    key: "region_profile",
    icon: Globe2,
    color: "text-sky-400",
    label: "1 · Region Profile",
    grounded: true,
  },
  {
    key: "physical_hazard_summary",
    icon: Activity,
    color: "text-primary",
    label: "2 · Physical Hazard Summary",
    grounded: true,
  },
  {
    key: "climate_projections_2060",
    icon: TrendingUp,
    color: "text-cyan-400",
    label: "3 · Climate Projections to 2060",
    grounded: true,
  },
  {
    key: "ecosystem_and_community_exposure",
    icon: Leaf,
    color: "text-emerald-400",
    label: "4 · Ecosystem & Community Exposure",
    grounded: false,
  },
  {
    key: "adaptation_strategies",
    icon: ShieldAlert,
    color: "text-amber-400",
    label: "5 · Adaptation Strategies",
    grounded: (b) => b.strategies.length > 0,
  },
  {
    key: "capital_and_financing_options",
    icon: Coins,
    color: "text-violet-400",
    label: "6 · Capital & Financing Options",
    grounded: false,
  },
];

function BriefView({ brief }: { brief: Brief }) {
  const { report, region } = brief;
  const topo = region.topography as Topography;

  return (
    <article className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <header className="rounded-lg border border-border bg-gradient-to-br from-primary/10 to-card/30 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <GripMark /> Grip · Physical Climate Risk Intelligence
            </div>
            <h2 className="text-2xl font-semibold mt-0.5">{region.name}</h2>
            <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {region.lat.toFixed(2)}°, {region.lon.toFixed(2)}° · {region.country} ·{" "}
              {TOPOGRAPHY_LABEL[topo]}
            </div>
          </div>
          <div
            className={`px-3 py-1.5 rounded-md border text-xs font-semibold uppercase ${TIER_COLOR[brief.tierFuture]}`}
          >
            {brief.tierFuture} · {brief.scenario} · {brief.year}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 mt-3 border-t border-border/50">
          <Stat
            label="Composite today"
            value={brief.scoreNow}
            accent={scoreColor(brief.scoreNow)}
          />
          <Stat
            label={`Composite ${brief.year}`}
            value={brief.scoreFuture}
            accent={scoreColor(brief.scoreFuture)}
          />
          <Stat
            label="Δ risk"
            value={`${brief.scoreFuture - brief.scoreNow >= 0 ? "+" : ""}${brief.scoreFuture - brief.scoreNow} pts`}
            accent={brief.scoreFuture > brief.scoreNow ? "text-risk-critical" : "text-risk-low"}
          />
          <Stat label="Generated" value={new Date(brief.generatedAt).toLocaleDateString()} small />
        </div>
      </header>

      {/* Executive summary */}
      <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="text-xs uppercase tracking-widest font-semibold text-primary flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Executive Summary
          <GroundingBadge kind="ai" label="Synthesis — AI analysis" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          {report.executive_summary}
        </p>
      </section>

      {/* Six sections */}
      {SECTION_ICON.map(({ key, icon: Icon, color, label, grounded }) => {
        const sec = report[key] as ReportSection;
        const isGrounded = typeof grounded === "function" ? grounded(brief) : grounded;
        return (
          <section key={key} className="rounded-lg border border-border bg-card/50 p-4">
            <div
              className={`flex items-center gap-2 text-xs uppercase tracking-widest font-semibold ${color}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
              <GroundingBadge kind={isGrounded ? "grounded" : "ai"} />
            </div>
            {sec.heading && <h3 className="mt-2 text-base font-semibold">{sec.heading}</h3>}
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/85">
              {sec.paragraphs?.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {sec.bullets && sec.bullets.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {sec.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-current opacity-60 ${color}`}
                    />
                    <span className="text-foreground/80">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {/* Data sources */}
      <section className="rounded-lg border border-border bg-card/30 p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
          Data sources
          <GroundingBadge kind="grounded" label="Actual sources used for this request" />
        </div>
        <ul className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-1">
          {report.data_sources.map((s, i) => (
            <li key={i}>· {s}</li>
          ))}
        </ul>
      </section>

      <footer className="text-[10px] text-muted-foreground text-center pt-2">
        Generated by Grip · Atlas reporting agent · Claude Opus 5 (Anthropic). Indicative and should
        be paired with local expert review.
      </footer>
    </article>
  );
}

function GripMark() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-primary text-primary-foreground text-[9px] font-black tracking-tight">
      G
    </span>
  );
}

function Stat({
  label,
  value,
  small,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  small?: boolean;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`${small ? "text-sm" : "text-2xl"} font-mono tabular-nums font-semibold ${accent ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------------- PDF EXPORT ---------------- */

async function downloadPdf(brief: Brief) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 40) {
      addFooter();
      doc.addPage();
      y = margin;
    }
  };

  const addFooter = () => {
    const pageNum = doc.getNumberOfPages();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Grip Intelligence Brief · ${brief.region.name} · ${brief.scenario} · ${brief.year}`,
      margin,
      pageH - 24,
    );
    doc.text(`Page ${pageNum}`, pageW - margin, pageH - 24, { align: "right" });
    doc.setTextColor(0);
  };

  // ---- LOGO / HEADER BLOCK ----
  // Logo mark: filled square with "G"
  doc.setFillColor(59, 130, 246);
  doc.roundedRect(margin, y, 32, 32, 4, 4, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("G", margin + 16, y + 23, { align: "center" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Grip", margin + 44, y + 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text("Physical Climate Risk Intelligence", margin + 44, y + 28);
  doc.setTextColor(0);
  // Right-side generated stamp
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(`Generated ${new Date(brief.generatedAt).toLocaleString()}`, pageW - margin, y + 12, {
    align: "right",
  });
  doc.text(`Scenario ${brief.scenario} · Year ${brief.year}`, pageW - margin, y + 24, {
    align: "right",
  });
  doc.setTextColor(0);
  y += 48;

  // Divider
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // Title block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(brief.region.name, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${brief.region.country} · ${TOPOGRAPHY_LABEL[brief.region.topography as Topography]} · ${brief.region.lat.toFixed(2)}°, ${brief.region.lon.toFixed(2)}°`,
    margin,
    y,
  );
  doc.setTextColor(0);
  y += 22;

  // Risk stat strip
  const stats = [
    ["Composite today", `${brief.scoreNow}/100`],
    [`Composite ${brief.year}`, `${brief.scoreFuture}/100`],
    [
      "Δ risk",
      `${brief.scoreFuture - brief.scoreNow >= 0 ? "+" : ""}${brief.scoreFuture - brief.scoreNow} pts`,
    ],
    ["Tier", brief.tierFuture.toUpperCase()],
  ];
  const boxW = contentW / stats.length;
  doc.setDrawColor(220);
  doc.setLineWidth(0.5);
  stats.forEach((s, i) => {
    const x = margin + boxW * i;
    doc.rect(x, y, boxW, 44);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(s[0].toUpperCase(), x + 8, y + 12);
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text(s[1], x + 8, y + 32);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
  });
  y += 62;

  // ---- EXECUTIVE SUMMARY ----
  ensureSpace(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(59, 130, 246);
  doc.text("EXECUTIVE SUMMARY", margin, y);
  y += 14;
  doc.setTextColor(0);
  writeParagraph(doc, brief.report.executive_summary, margin, y, contentW, 10, () =>
    ensureSpace(14),
  );
  y = getY(doc);
  y += 10;

  // ---- 6 SECTIONS ----
  const sections: Array<[string, ReportSection]> = [
    ["1. Region Profile", brief.report.region_profile],
    ["2. Physical Hazard Summary", brief.report.physical_hazard_summary],
    ["3. Climate Projections to 2060", brief.report.climate_projections_2060],
    ["4. Ecosystem & Community Exposure", brief.report.ecosystem_and_community_exposure],
    ["5. Adaptation Strategies", brief.report.adaptation_strategies],
    ["6. Capital & Financing Options", brief.report.capital_and_financing_options],
  ];

  for (const [title, sec] of sections) {
    ensureSpace(50);
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(title, margin, y);
    y += 16;
    if (sec.heading) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(60);
      const hLines = doc.splitTextToSize(sec.heading, contentW);
      ensureSpace(hLines.length * 13);
      doc.text(hLines, margin, y);
      y += hLines.length * 13;
    }
    doc.setTextColor(0);
    for (const p of sec.paragraphs ?? []) {
      writeParagraph(doc, p, margin, y, contentW, 10, () => ensureSpace(14));
      y = getY(doc) + 6;
    }
    if (sec.bullets?.length) {
      for (const b of sec.bullets) {
        ensureSpace(16);
        doc.setFont("helvetica", "bold");
        doc.text("•", margin + 4, y);
        doc.setFont("helvetica", "normal");
        writeParagraph(doc, b, margin + 16, y, contentW - 16, 10, () => ensureSpace(14));
        y = getY(doc) + 3;
      }
    }
    y += 8;
  }

  // ---- DATA SOURCES ----
  ensureSpace(80);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(59, 130, 246);
  doc.text("DATA SOURCES", margin, y);
  y += 14;
  doc.setTextColor(60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const s of brief.report.data_sources) {
    ensureSpace(12);
    const lines = doc.splitTextToSize(`· ${s}`, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 12;
  }

  addFooter();

  const fname = `Grip_${brief.region.slug || brief.region.name.replace(/\s+/g, "_")}_${brief.scenario}_${brief.year}.pdf`;
  doc.save(fname);
}

// jsPDF helpers using an internal cursor tracked in doc's user data.
function getY(doc: any): number {
  return doc.__cursorY ?? 0;
}
function setY(doc: any, y: number) {
  doc.__cursorY = y;
}

function writeParagraph(
  doc: any,
  text: string,
  x: number,
  startY: number,
  width: number,
  fontSize: number,
  _beforeChunk: () => void,
) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lineH = fontSize * 1.35;
  const lines: string[] = doc.splitTextToSize(text ?? "", width);
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = startY;
  for (const line of lines) {
    if (y + lineH > pageH - margin - 40) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, x, y);
    y += lineH;
  }
  setY(doc, y);
}
