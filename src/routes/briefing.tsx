import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ClientOnly } from "@/components/ClientOnly";
import { RiskGlobe } from "@/components/RiskGlobe";
import { getBriefingFn } from "@/lib/agents.functions";
import { geocodeRegion } from "@/lib/geocode.functions";
import {
  HOTSPOTS as BASE_HOTSPOTS,
  type Hotspot,
  type Continent,
  CONTINENTS,
  CONTINENT_LABEL,
  deriveContinent,
} from "@/lib/hotspots";
import { GroundingBadge } from "@/components/GroundingBadge";
import {
  Activity,
  Flame,
  Droplets,
  Waves,
  ThermometerSun,
  Wind,
  Leaf,
  Users,
  Sparkles,
  Volume2,
  Play,
  Loader2,
  AlertTriangle,
  Globe2,
  Coins,
  Eye,
  Zap,
  Search,
  MapPin,
} from "lucide-react";

const TIER_BADGE: Record<Hotspot["tier"], string> = {
  critical: "bg-risk-critical/15 text-risk-critical border-risk-critical/40",
  high: "bg-risk-high/15 text-risk-high border-risk-high/40",
  medium: "bg-risk-medium/15 text-risk-medium border-risk-medium/40",
};
const TIER_DOT: Record<Hotspot["tier"], string> = {
  critical: "bg-risk-critical shadow-[0_0_12px_rgba(220,38,38,.9)]",
  high: "bg-risk-high shadow-[0_0_10px_rgba(249,115,22,.8)]",
  medium: "bg-risk-medium shadow-[0_0_10px_rgba(56,189,248,.8)]",
};

type Scenario = "SSP1-2.6" | "SSP2-4.5" | "SSP5-8.5";
type BriefingData = Awaited<ReturnType<typeof getBriefingFn>>;

function HazardRow({
  label,
  icon: Icon,
  now,
  future,
}: {
  label: string;
  icon: any;
  now: number;
  future: number;
}) {
  const color = (s: number) =>
    s >= 76
      ? "text-risk-critical"
      : s >= 51
        ? "text-risk-high"
        : s >= 26
          ? "text-risk-medium"
          : "text-risk-low";
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 font-mono tabular-nums">
        <span className={color(now)}>{Math.round(now)}</span>
        <span className="text-muted-foreground/60">→</span>
        <span className={color(future)}>{Math.round(future)}</span>
      </div>
    </div>
  );
}

function GlobeStage({
  hotspots,
  selectedId,
  onSelect,
}: {
  hotspots: Hotspot[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 600 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      // Square the globe to the smaller dimension so the whole sphere is visible and centered.
      const s = Math.max(280, Math.floor(Math.min(r.width, r.height)));
      setSize({ w: s, h: s });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="absolute inset-0 flex items-start justify-center overflow-hidden pt-2"
    >
      <ClientOnly
        fallback={
          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading globe…
          </div>
        }
      >
        <div style={{ width: size.w, height: size.h }} className="flex items-center justify-center">
          <RiskGlobe
            hotspots={hotspots}
            selectedId={selectedId}
            onSelect={onSelect}
            width={size.w}
            height={size.h}
          />
        </div>
      </ClientOnly>
    </div>
  );
}

function RegionSearch({ onPick }: { onPick: (h: Hotspot) => void }) {
  const geo = useServerFn(geocodeRegion);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await geo({ data: { query } });
      if (!r) {
        setErr("No matching region found.");
        return;
      }
      const id = `s-${Date.now()}`;
      const h: Hotspot = {
        id,
        name: r.country ? `${r.name}, ${r.country}` : r.name,
        lat: r.lat,
        lng: r.lon,
        lon: r.lon,
        sector: "other",
        tag: "SEARCHED",
        tier: "medium",
        score: 50,
        population: r.population,
      };
      onPick(h);
      setQ("");
    } catch (e: any) {
      setErr(e?.message ?? "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search any region (e.g. Cairo, Hanoi)"
          className="pl-7 h-8 text-xs"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={loading || !q.trim()}
        className="w-full h-7 text-[11px]"
      >
        {loading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
            Locating…
          </>
        ) : (
          <>
            <MapPin className="w-3 h-3 mr-1.5" />
            Brief this region
          </>
        )}
      </Button>
      {err && <div className="text-[10px] text-risk-critical">{err}</div>}
    </form>
  );
}

function ContinentChips({
  hotspots,
  value,
  onChange,
}: {
  hotspots: Hotspot[];
  value: Continent | "all";
  onChange: (c: Continent | "all") => void;
}) {
  const counts = useMemo(() => {
    const c: Record<Continent, number> = { africa: 0, asia: 0, europe: 0, americas: 0, oceania: 0 };
    for (const h of hotspots) c[deriveContinent(h.lat, h.lng)]++;
    return c;
  }, [hotspots]);

  const chipClass = (active: boolean) =>
    `text-[10px] font-medium py-1.5 rounded-md border transition-colors truncate ${
      active
        ? "bg-primary text-primary-foreground border-primary"
        : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <div className="grid grid-cols-3 gap-1">
      <button onClick={() => onChange("all")} className={chipClass(value === "all")}>
        All {hotspots.length}
      </button>
      {CONTINENTS.map((c) => (
        <button key={c} onClick={() => onChange(c)} className={chipClass(value === c)}>
          {CONTINENT_LABEL[c]} {counts[c]}
        </button>
      ))}
    </div>
  );
}

/** Sidebar controls only — scenario, water demand, run button, inline error.
 *  The generated briefing itself renders in <BriefingOutput> below the fold;
 *  see BriefingPage, which owns the shared run/loading/data state. */
function BriefingControls({
  hotspot,
  scenario,
  setScenario,
  demand,
  setDemand,
  loading,
  err,
  onRun,
}: {
  hotspot: Hotspot;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  demand: number;
  setDemand: (n: number) => void;
  loading: boolean;
  err: string | null;
  onRun: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${TIER_DOT[hotspot.tier]}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{hotspot.name}</div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {hotspot.lat.toFixed(2)}, {hotspot.lon.toFixed(2)} · {hotspot.tag}
          </div>
        </div>
        <span
          className="text-2xl font-mono font-bold tabular-nums"
          style={{
            color:
              hotspot.tier === "critical"
                ? "hsl(var(--risk-critical))"
                : hotspot.tier === "high"
                  ? "hsl(var(--risk-high))"
                  : "hsl(var(--risk-medium))",
          }}
        >
          {hotspot.score}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {(["SSP1-2.6", "SSP2-4.5", "SSP5-8.5"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${scenario === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">Water demand</span>
          <span className="font-mono">{demand} m³/d</span>
        </div>
        <Slider
          value={[demand]}
          onValueChange={(v) => setDemand(v[0])}
          min={0}
          max={5000}
          step={50}
        />
      </div>
      <Button onClick={onRun} disabled={loading} size="sm" className="w-full">
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
            Running agents…
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 mr-2" />
            Generate briefing
          </>
        )}
      </Button>
      {err && (
        <div className="flex items-start gap-2 text-[11px] text-risk-critical p-2 rounded bg-risk-critical/10">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          {err}
        </div>
      )}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card/40 p-4 space-y-2 ${className}`}>
      {children}
    </div>
  );
}

/** Full-width briefing output, rendered below the globe/hotspot-list/legend
 *  row. Owns none of the run/loading state — that's lifted to BriefingPage
 *  so the sidebar controls and this section can share it. */
function BriefingOutput({
  hotspot,
  data,
  loading,
  speak,
  ttsLoading,
  audioUrl,
  audioRef,
}: {
  hotspot: Hotspot;
  data: BriefingData | null;
  loading: boolean;
  speak: () => void;
  ttsLoading: boolean;
  audioUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
  if (loading) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <div className="text-sm">Running the 5-agent briefing for {hotspot.name}…</div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Intelligence briefing — {hotspot.name}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hotspot.lat.toFixed(2)}, {hotspot.lon.toFixed(2)} · {hotspot.tag} · composite score{" "}
          {hotspot.score}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        <Card>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Hazards · now → 2050
          </div>
          <HazardRow
            label="Flood"
            icon={Waves}
            now={data.scores.flood.now}
            future={data.scores.flood.y2050}
          />
          <HazardRow
            label="Heat"
            icon={ThermometerSun}
            now={data.scores.heat.now}
            future={data.scores.heat.y2050}
          />
          <HazardRow
            label="Water"
            icon={Droplets}
            now={data.scores.water.now}
            future={data.scores.water.y2050}
          />
          <HazardRow
            label="Wildfire"
            icon={Flame}
            now={data.scores.wildfire.now}
            future={data.scores.wildfire.y2050}
          />
          <HazardRow
            label="Sea level"
            icon={Waves}
            now={data.scores.sea_level.now}
            future={data.scores.sea_level.y2050}
          />
          <HazardRow
            label="Wind"
            icon={Wind}
            now={data.scores.wind.now}
            future={data.scores.wind.y2050}
          />
        </Card>

        <Card>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Activity className="w-3.5 h-3.5" /> Terra · physical
          </div>
          <p className="text-sm leading-relaxed">{data.terra.risk_narrative}</p>
          <GroundingBadge kind="grounded" />
        </Card>

        <Card>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Leaf className="w-3.5 h-3.5" /> Echo · ecosystem
          </div>
          <p className="text-sm leading-relaxed">{data.echo.ecosystem_narrative}</p>
          <GroundingBadge kind="ai" label="AI analysis — no biodiversity dataset" />
        </Card>

        <Card>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground flex-wrap">
            <Users className="w-3.5 h-3.5" /> Sage · community
            <span className="font-mono text-foreground">
              RCI {data.sage.rci_score}/100{data.sage.rci_flag ? " · flagged" : ""}
            </span>
            <GroundingBadge kind="grounded" label="RCI: data-grounded" />
          </div>
          <p className="text-sm leading-relaxed">{data.sage.community_narrative}</p>
          <GroundingBadge kind="ai" label="Narrative: AI analysis" />
        </Card>

        <Card className="border-primary/40 bg-primary/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
            <Sparkles className="w-3.5 h-3.5" /> Oracle · decision
          </div>
          <div className="text-sm font-semibold">{data.oracle.decision}</div>
          <p className="text-sm leading-relaxed">{data.oracle.decision_rationale}</p>
          <GroundingBadge kind="ai" label="Synthesis — AI analysis" />
        </Card>

        {data.atlas && (
          <Card className="border-amber-500/40 bg-amber-500/5 md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-500">
                <Coins className="w-3.5 h-3.5" /> Atlas · resource allocation
              </div>
              <GroundingBadge kind="ai" label="Strategic reasoning — no financial dataset" />
            </div>
            <p className="text-sm font-medium leading-relaxed">{data.atlas.headline}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-1">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Funding mix
                </div>
                <div className="space-y-1.5">
                  {data.atlas.funding_sources.map((f, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium">{f.source}</span>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {f.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {data.atlas.cross_sector_synergies.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <Zap className="w-3.5 h-3.5" /> Cross-sector synergies
                  </div>
                  <ul className="text-xs space-y-0.5 list-disc list-inside marker:text-amber-500/60">
                    {data.atlas.cross_sector_synergies.map((s, i) => (
                      <li key={i} className="leading-snug">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.atlas.overlooked_factors.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    <Eye className="w-3.5 h-3.5" /> Overlooked factors
                  </div>
                  <ul className="text-xs space-y-0.5 list-disc list-inside marker:text-amber-500/60">
                    {data.atlas.overlooked_factors.map((s, i) => (
                      <li key={i} className="leading-snug">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.atlas.quick_wins.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    90-day quick wins
                  </div>
                  <ul className="text-xs space-y-0.5 list-disc list-inside marker:text-amber-500/60">
                    {data.atlas.quick_wins.map((s, i) => (
                      <li key={i} className="leading-snug">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Volume2 className="w-3.5 h-3.5" /> Herald · voice
          </div>
          <p className="text-sm italic text-muted-foreground leading-relaxed">
            "{data.herald_script}"
          </p>
          <GroundingBadge kind="ai" label="AI summary of the above" />
          <Button
            size="sm"
            variant="outline"
            onClick={speak}
            disabled={ttsLoading}
            className="w-full"
          >
            {ttsLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                Synthesising…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-2" />
                Play briefing
              </>
            )}
          </Button>
          {audioUrl && <audio ref={audioRef} src={audioUrl} controls className="w-full mt-1" />}
        </Card>
      </div>
    </div>
  );
}

function LegendKey() {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Risk tiers
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-risk-critical border border-risk-critical" />
            <span>
              <span className="text-risk-critical font-semibold">Critical</span> (76–100) ·
              immediate action
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-risk-high border border-risk-high" />
            <span>
              <span className="text-risk-high font-semibold">High</span> (51–75) · adapt within 5y
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-risk-medium border border-risk-medium" />
            <span>
              <span className="text-risk-medium font-semibold">Medium</span> (26–50) · monitor
            </span>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Factors scored
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Waves className="w-3 h-3 text-muted-foreground" /> Flood
          </span>
          <span className="flex items-center gap-1.5">
            <ThermometerSun className="w-3 h-3 text-muted-foreground" /> Heat
          </span>
          <span className="flex items-center gap-1.5">
            <Droplets className="w-3 h-3 text-muted-foreground" /> Water stress
          </span>
          <span className="flex items-center gap-1.5">
            <Flame className="w-3 h-3 text-muted-foreground" /> Wildfire
          </span>
          <span className="flex items-center gap-1.5">
            <Waves className="w-3 h-3 text-muted-foreground" /> Sea level
          </span>
          <span className="flex items-center gap-1.5">
            <Wind className="w-3 h-3 text-muted-foreground" /> Wind / storm
          </span>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
        Bar height & ring speed scale with composite risk. Click any hotspot to fly in and generate
        a 5-agent intelligence briefing.
      </div>
    </div>
  );
}

function BriefingPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>(BASE_HOTSPOTS);
  const [selectedId, setSelectedId] = useState<string>(BASE_HOTSPOTS[0].id);
  const selected = hotspots.find((h) => h.id === selectedId) ?? hotspots[0];
  const [continentFilter, setContinentFilter] = useState<Continent | "all">("all");

  const sortedHotspots = useMemo(() => [...hotspots].sort((a, b) => b.score - a.score), [hotspots]);
  const visibleHotspots = useMemo(
    () =>
      continentFilter === "all"
        ? sortedHotspots
        : sortedHotspots.filter((h) => deriveContinent(h.lat, h.lng) === continentFilter),
    [sortedHotspots, continentFilter],
  );

  const addSearched = (h: Hotspot) => {
    setHotspots((prev) => {
      const existing = prev.find((p) => p.name.toLowerCase() === h.name.toLowerCase());
      if (existing) {
        setSelectedId(existing.id);
        return prev;
      }
      return [h, ...prev];
    });
    setSelectedId(h.id);
  };

  // ---- Briefing generation state, shared between the sidebar controls and
  // the full-width output section below the fold. ----
  const briefingFn = useServerFn(getBriefingFn);
  const [scenario, setScenario] = useState<Scenario>("SSP2-4.5");
  const [demand, setDemand] = useState(500);
  const [data, setData] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Reset generation state whenever the selected hotspot changes.
  useEffect(() => {
    setData(null);
    setErr(null);
    setAudioUrl(null);
    setScenario("SSP2-4.5");
    setDemand(500);
  }, [selected.id]);

  const run = async () => {
    setLoading(true);
    setErr(null);
    setData(null);
    setAudioUrl(null);
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const out = await briefingFn({
        data: {
          region: selected.name,
          lat: selected.lat,
          lon: selected.lon,
          sector: selected.sector,
          scenario,
          planned_water_demand_m3_daily: demand,
          population: selected.population ?? null,
        },
      });
      setData(out);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-run for searched regions so the AI brief appears without an extra click.
  useEffect(() => {
    if (selected.tag === "SEARCHED") {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  const speak = async () => {
    if (!data?.herald_script) return;
    setTtsLoading(true);
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.herald_script }),
      });
      if (!r.ok) throw new Error(`TTS ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      requestAnimationFrame(() => audioRef.current?.play().catch(() => {}));
    } catch (e: any) {
      setErr(`Voice: ${e?.message ?? String(e)}`);
    } finally {
      setTtsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.08),_transparent_60%)]">
      <header className="border-b border-border px-6 py-4">
        <Breadcrumb items={["Grip", "Globe intelligence"]} />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-primary" /> Global risk globe
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live hotspots ranked by composite physical risk. Search any region or click a marker for
          the 5-agent briefing.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] h-[600px]">
        {/* Left: search + continent filter + hotspot list */}
        <aside className="border-r border-border bg-card/30 overflow-y-auto p-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 px-0.5">
              Search region
            </div>
            <RegionSearch onPick={addSearched} />
          </div>
          <div className="border-t border-border/60 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-0.5 mb-1.5">
              Continent
            </div>
            <ContinentChips
              hotspots={hotspots}
              value={continentFilter}
              onChange={setContinentFilter}
            />
          </div>
          <div className="border-t border-border/60 pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-0.5 mb-1.5">
              Active hotspots ({visibleHotspots.length})
            </div>
            <div className="space-y-1.5">
              {visibleHotspots.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className={`w-full text-left rounded-md border p-2 transition-all ${selectedId === h.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[h.tier]}`} />
                    <span className="flex-1 text-xs font-medium truncate">{h.name}</span>
                    <span className="text-xs font-mono tabular-nums">{h.score}</span>
                  </div>
                  <div
                    className={`mt-1 inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border ${TIER_BADGE[h.tier]}`}
                  >
                    {h.tag}
                  </div>
                </button>
              ))}
              {visibleHotspots.length === 0 && (
                <div className="text-[11px] text-muted-foreground px-1 py-3 text-center">
                  No hotspots on this continent yet.
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center: globe */}
        <div className="relative min-h-[500px] overflow-hidden">
          <GlobeStage hotspots={hotspots} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="absolute top-4 left-4 rounded-md border border-border/60 bg-card/80 backdrop-blur px-3 py-2 text-[10px] text-muted-foreground pointer-events-none">
            Drag to rotate · scroll to zoom
          </div>
        </div>

        {/* Right: legend + briefing controls (output moved out of the sidebar — see below) */}
        <aside className="border-l border-border bg-card/30 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Legend
            </div>
            <LegendKey />
          </div>
          <div className="border-t border-border pt-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Selected region
            </div>
            <BriefingControls
              hotspot={selected}
              scenario={scenario}
              setScenario={setScenario}
              demand={demand}
              setDemand={setDemand}
              loading={loading}
              err={err}
              onRun={run}
            />
          </div>
        </aside>
      </div>

      {/* Full-width briefing output, below the globe row */}
      <div ref={outputRef} className="border-t border-border p-6 scroll-mt-4">
        {loading || data ? (
          <BriefingOutput
            hotspot={selected}
            data={data}
            loading={loading}
            speak={speak}
            ttsLoading={ttsLoading}
            audioUrl={audioUrl}
            audioRef={audioRef}
          />
        ) : (
          <div className="text-sm text-muted-foreground text-center py-10">
            Select a hotspot and click "Generate briefing" to see the full 5-agent intelligence
            report here.
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/briefing")({ component: BriefingPage });
