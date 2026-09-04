import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Satellite, Network } from "lucide-react";
import { ClientOnly } from "../components/ClientOnly";
import { getProtocolSignals } from "../lib/protocol.functions";
import type { Arc as SeedArc, HazardKey, HazardScores } from "../lib/protocol-seed";
const ProtocolGlobe = lazy(() =>
  import("../components/ProtocolGlobe").then((m) => ({ default: m.ProtocolGlobe })),
);

const signalsQuery = queryOptions({
  queryKey: ["protocol-signals"],
  queryFn: () => getProtocolSignals(),
  staleTime: 24 * 60 * 60 * 1000,
});

export const Route = createFileRoute("/protocol")({
  component: ProtocolPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(signalsQuery),
  head: () => ({
    meta: [
      { title: "Intelligence Protocol — Planetary Resilience HUD" },
      {
        name: "description",
        content:
          "Tactical planetary resilience and ESG intelligence dashboard with a real-time 3D globe of supply chains, ESG stress, and geopolitical risk.",
      },
    ],
  }),
});

// ---------- Types ----------
export type HotspotKind = "heat" | "flood" | "fire" | "drought" | "sea_level" | "compound";
export type Hotspot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: HotspotKind;
  score: number;
  tag: string;
  iso?: string;
  source?: string;
  note?: string;
  live?: boolean;
  /** Real per-channel scores (0-100) from the protocol pipeline — the same
   *  values `note`'s "Channels: ..." text is built from server-side. The
   *  detail panel must read this directly, never re-derive a channel score
   *  from the composite scalar. */
  scores: HazardScores;
};

export type Severity = "low" | "moderate" | "high" | "severe";
const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#f97316",
  severe: "#ef4444",
};
const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};
/** 0-39 Low, 40-69 Moderate, 70-89 High, 90-100 Severe. Single source of
 *  truth for every severity badge/bar-color on the signal detail panel. */
function severityOf(score: number): { level: Severity; label: string; color: string } {
  const level: Severity =
    score >= 90 ? "severe" : score >= 70 ? "high" : score >= 40 ? "moderate" : "low";
  return { level, label: SEVERITY_LABEL[level], color: SEVERITY_COLOR[level] };
}
export type Arc = SeedArc;

// ---------- Page ----------
const KIND_COLOR: Record<HotspotKind, string> = {
  heat: "#f97316",
  flood: "#38bdf8",
  fire: "#ef4444",
  drought: "#eab308",
  sea_level: "#a78bfa",
  compound: "#ec4899",
};
const KIND_LABEL: Record<HotspotKind | "all", string> = {
  all: "All",
  heat: "Heat",
  flood: "Flood",
  fire: "Fire",
  drought: "Drought",
  sea_level: "Sea Level",
  compound: "Compound",
};
const HAZARD_ROWS: Array<{ key: HazardKey; label: string }> = [
  { key: "heat", label: "Heat" },
  { key: "flood", label: "Flood" },
  { key: "fire", label: "Fire" },
  { key: "drought", label: "Drought" },
  { key: "sea_level", label: "Sea Level" },
];

function ProtocolPage() {
  const { data: signals } = useSuspenseQuery(signalsQuery);
  const HOTSPOTS = signals.hotspots as unknown as Hotspot[];
  const ARCS = signals.arcs;

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [filter, setFilter] = useState<"all" | HotspotKind>("all");

  const [texture, setTexture] = useState<"terrain" | "satellite">("satellite");
  // Rendered only after mount — a ticking clock cannot match SSR output.
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const countsByKind = useMemo(() => {
    const c = { heat: 0, flood: 0, fire: 0, drought: 0, sea_level: 0, compound: 0 } as Record<
      HotspotKind,
      number
    >;
    for (const h of HOTSPOTS) c[h.kind] = (c[h.kind] ?? 0) + 1;
    return c;
  }, [HOTSPOTS]);

  const filtered = useMemo(
    () => (filter === "all" ? HOTSPOTS : HOTSPOTS.filter((h) => h.kind === filter)),
    [filter, HOTSPOTS],
  );
  const selected = HOTSPOTS.find((h) => h.id === selectedId);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => b.score - a.score), [filtered]);

  const stressVectors = useMemo(() => {
    if (!selected) return [];
    // Real per-channel scores — the same values selected.note's
    // "Channels: ..." text is built from server-side — plus the SAME
    // composite the header shows, reused verbatim rather than recomputed.
    return [
      ...HAZARD_ROWS.map((h) => ({ label: h.label, score: selected.scores[h.key] })),
      { label: "Composite", score: selected.score },
    ];
  }, [selected]);

  return (
    <div className="h-screen w-full bg-[#0a0c10] text-slate-300 overflow-hidden flex flex-col font-[Inter,system-ui,sans-serif] relative">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(94,234,212,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 20%, rgba(56,189,248,0.07), transparent 70%)",
        }}
      />

      <header className="relative z-30 px-6 py-4 flex justify-between items-start border-b border-white/5">
        <div>
          <h1 className="text-[11px] font-medium tracking-[0.3em] uppercase text-[#ca5c4d] mb-1">
            Intelligence Protocol
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xl font-light tracking-tight text-white">
              Global Vector Analysis
            </span>
          </div>
        </div>
        <div className="flex gap-8 items-start">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Feed Updated</p>
            <p className="text-sm font-mono text-slate-300">
              {new Date(signals.lastUpdated).toISOString().replace("T", " ").slice(0, 19)} UTC
            </p>
            <p className="text-[9px] font-mono text-slate-500 mt-0.5">
              refresh every 24h · {HOTSPOTS.length} live signals
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">UTC</p>
            <p className="text-sm font-mono text-slate-300">
              {time ? time.toISOString().slice(11, 19) : "--:--:--"}
            </p>
          </div>
        </div>
      </header>

      <div ref={wrapRef} className="relative flex-1 min-h-0">
        <div className="absolute inset-0 flex items-center justify-center">
          <ClientOnly
            fallback={
              <div className="text-slate-600 font-mono text-xs">INITIALIZING ORBITAL FEED…</div>
            }
          >
            <Suspense
              fallback={
                <div className="text-slate-600 font-mono text-xs">INITIALIZING ORBITAL FEED…</div>
              }
            >
              <ProtocolGlobe
                hotspots={filtered}
                arcs={ARCS}
                selectedId={selectedId}
                onSelect={setSelectedId}
                width={size.w}
                height={size.h}
                offsetX={0}
                altitude={2.2}
                texture={texture}
              />
            </Suspense>
          </ClientOnly>
        </div>

        <div className="relative z-10 h-full flex p-6 gap-6 pointer-events-none">
          <aside className="w-72 flex flex-col pointer-events-auto">
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 p-4 flex-1 flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  Active Signals
                </h3>
                <span className="font-mono text-[10px] text-slate-400">
                  {filtered.length}/{filter === "all" ? HOTSPOTS.length : countsByKind[filter]}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 mb-3">
                {(
                  ["all", "heat", "flood", "fire", "drought", "sea_level", "compound"] as const
                ).map((k) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`text-[9px] font-medium uppercase tracking-wider py-1.5 rounded-md transition-colors ${
                      filter === k
                        ? "bg-[#ca5c4d]/15 text-[#ca5c4d] border border-[#ca5c4d]/30"
                        : "text-slate-500 border border-transparent hover:text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {KIND_LABEL[k]} {k === "all" ? HOTSPOTS.length : countsByKind[k]}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {sortedFiltered.map((h) => {
                  const active = selectedId === h.id;
                  const color = KIND_COLOR[h.kind];
                  return (
                    <button
                      key={h.id}
                      onClick={() => setSelectedId(h.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        active
                          ? "bg-white/[0.06] border-white/20"
                          : "bg-transparent border-transparent hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-mono" style={{ color }}>
                          {h.id.toUpperCase()}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest" style={{ color }}>
                          {KIND_LABEL[h.kind]}
                        </span>
                      </div>
                      <p className={`text-sm ${active ? "text-white" : "text-slate-300"}`}>
                        {h.name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">score {h.score}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="flex-1" />

          <aside className="w-80 flex flex-col pointer-events-auto">
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
              {selected ? (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-10 h-10 rounded-lg border flex items-center justify-center"
                      style={{
                        backgroundColor: `${KIND_COLOR[selected.kind]}1a`,
                        borderColor: `${KIND_COLOR[selected.kind]}40`,
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: KIND_COLOR[selected.kind] }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{selected.name}</h4>
                      <p className="text-[10px] font-mono text-slate-500 uppercase">
                        {selected.tag}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
                        <span>Composite Score</span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-200 tabular-nums font-mono">
                            {selected.score}
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: severityOf(selected.score).color }}
                          >
                            {severityOf(selected.score).label}
                          </span>
                        </span>
                      </div>
                      <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          key={selected.id}
                          initial={{ width: 0 }}
                          animate={{ width: `${selected.score}%` }}
                          transition={{ duration: 0.6 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: severityOf(selected.score).color }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <Stat
                        label="Primary Hazard"
                        value={KIND_LABEL[selected.kind].toUpperCase()}
                      />
                      <Stat
                        label="Tier"
                        value={
                          selected.score >= 90
                            ? "TIER-1"
                            : selected.score >= 75
                              ? "TIER-2"
                              : "TIER-3"
                        }
                      />
                    </div>

                    <div className="pt-2">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                        Stress Decomposition
                      </div>
                      <div className="space-y-2">
                        {stressVectors.map((v) => (
                          <Bar key={v.label} label={v.label} score={v.score} />
                        ))}
                      </div>
                    </div>

                    {selected.source && (
                      <div className="pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">
                            Source
                          </span>
                          <span
                            className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${selected.live ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}
                          >
                            {selected.live ? "LIVE" : "STATIC"}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          {selected.source}
                        </p>
                        {selected.note && (
                          <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                            {selected.note}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 font-mono py-8 text-center">
                  SELECT A NODE
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <div className="relative z-30 px-6 py-4 flex justify-between items-center border-t border-white/5">
        <div className="flex gap-4 items-center">
          <div className="flex rounded-full bg-white/5 border border-white/10 p-0.5">
            {(["satellite", "terrain"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTexture(t)}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  texture === t
                    ? "bg-teal-300/20 text-teal-200"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-[10px] flex-wrap justify-center">
          <Legend color={KIND_COLOR.heat} label="Heat" count={countsByKind.heat} />
          <Legend color={KIND_COLOR.flood} label="Flood" count={countsByKind.flood} />
          <Legend color={KIND_COLOR.fire} label="Fire" count={countsByKind.fire} />
          <Legend color={KIND_COLOR.drought} label="Drought" count={countsByKind.drought} />
          <Legend color={KIND_COLOR.sea_level} label="Sea Level" count={countsByKind.sea_level} />
          <Legend color={KIND_COLOR.compound} label="Compound" count={countsByKind.compound} />
          <Legend
            color="#60a5fa"
            label="Trade arcs"
            count={ARCS.length}
            icon={<Network className="w-3 h-3" />}
          />
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Satellite className="w-3 h-3" /> ORBIT-LINK
          </span>
          <span className="text-slate-500">|</span>
          <span
            className={`flex items-center gap-1.5 ${signals.deltaPct >= 0 ? "text-amber-400" : "text-emerald-400"}`}
          >
            <AlertTriangle className="w-3 h-3" /> {signals.deltaPct >= 0 ? "+" : ""}
            {signals.deltaPct}% Δ
          </span>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <p className="text-sm font-mono text-slate-200">{value}</p>
    </div>
  );
}

function Bar({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const sev = severityOf(pct);
  return (
    <div>
      <div className="flex justify-between items-center text-[10px] mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="text-slate-300 font-mono tabular-nums">{pct.toFixed(0)}</span>
          <span
            className="text-[9px] uppercase tracking-wider font-semibold"
            style={{ color: sev.color }}
          >
            {sev.label}
          </span>
        </span>
      </div>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className="h-full rounded-full"
          style={{ background: sev.color }}
        />
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  count,
  icon,
}: {
  color: string;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon ?? (
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
        />
      )}
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-500 tabular-nums">{count}</span>
    </div>
  );
}
