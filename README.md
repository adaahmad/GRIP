# Grip

**Physical climate risk intelligence for business decision-making.**

Grip scores locations against IPCC AR6-aligned physical climate hazards using
live climate data, then turns those scores into AI-grounded intelligence
briefings and disclosure-ready reports — built for teams evaluating the
climate suitability of sourcing locations, facilities, or expansion sites.

🏆 **1st Place (Solo) — Hack for the Futures: AI for Climate Action
Hackathon, London Climate Action Week (LCAW) 2026**

---

## What it does

Grip is a five-page platform, each addressing a different part of the
physical-risk workflow:

- **Intelligence Protocol** (`/protocol`) — a real-time 3D globe visualizing
  global hazard hotspots across five categories (Heat, Flood, Drought, Fire,
  Sea Level) plus a derived Compound signal for locations under simultaneous
  stress, overlaid with global trade-route arcs. Each signal expands into a
  severity-graded stress decomposition panel.

- **Regions** (`/regions`) — a topography-aware risk explorer across six
  landscape types (alpine, desert, coastal, tropical delta, savanna, boreal),
  each scored against a different weighted set of hazard metrics appropriate
  to that terrain, with matched adaptation-strategy recommendations.

- **Scenario Modeller** (`/scenarios`) — compares IPCC AR6 emissions
  pathways (SSP2-4.5 vs. SSP5-8.5) for a region, projecting composite risk
  from today through 2060 and auto-generating forecast flags (heatwave
  intensification, drought stress, wildfire activity, sea-level pressure,
  and more) as thresholds are crossed.

- **AI Briefing** (`/briefing`) — search or browse hotspots by continent,
  select a location, and generate an on-demand intelligence briefing from a
  five-agent AI system, with an optional spoken-voice playback of the
  summary.

- **Intelligence Brief** (`/report`) — generates a structured, six-section
  PDF report per region (profile, physical hazard summary, climate
  projections to 2060, ecosystem & community exposure, adaptation
  strategies, capital & financing options), grounded in the same computed
  metrics shown elsewhere in the app.

## How it's built

**One hazard taxonomy, everywhere.** Every page scores locations against the
same six categories — Heat, Flood, Drought, Fire, Sea Level, and a derived
Compound signal — computed by a single shared pipeline rather than each page
inventing its own scoring logic.

**Every number is labeled by its source.** Metrics are tagged as live,
cached, or static-baseline, and AI-generated commentary is explicitly marked
as either **Data-grounded** (narrating real computed hazard scores) or **AI
analysis** (interpretive reasoning with no dataset behind the specifics) —
so a reader always knows which numbers they could cite and which are
model interpretation. Wildfire scoring is a concrete example: it uses real
NASA FIRMS satellite detections when available, and falls back to a
transparently-labeled modeled fire-weather estimate — never a silent guess
presented as satellite data.

**A five-agent system, not one prompt.** The AI Briefing is produced by five
specialized agents — a physical-risk analyst, an ecosystem-risk interpreter,
a community/resource-competition analyst, a synthesis/decision agent, and a
capital-strategy agent — each constrained to a JSON schema and instructed
not to fabricate figures it has no data source for.

## Data sources

- **Open-Meteo** — Climate API (CMIP6 ensemble projections), Archive API
  (ERA5 historical reanalysis), Flood API (river discharge)
- **NASA POWER** — solar, wind, and temperature climatology
- **NASA FIRMS** — real-time satellite wildfire detection
- **IPCC AR6 WG1** — regional sea-level-rise baseline projections
- **Anthropic Claude** (Opus 5 / Sonnet 5) — the five-agent briefing system
  and the Intelligence Brief report generator, via structured JSON outputs

## Tech stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (full-stack React) — TanStack Router, TanStack Query |
| UI | React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix primitives) |
| 3D globe | react-globe.gl (three.js) |
| Maps | Leaflet / react-leaflet |
| Charts | Recharts |
| Database | Supabase (Postgres) |
| AI | Anthropic Claude — Messages API, structured outputs |
| PDF export | jsPDF |

## Getting started

```sh
git clone https://github.com/adaahmad/climate-risk-compass.git
cd climate-risk-compass
npm install
cp .env.example .env   # fill in your own Supabase project + Anthropic API key
npm run dev
```

See `.env.example` for the full list of required environment variables.
`FIRMS_API_KEY` is optional — wildfire scoring degrades gracefully to a
labeled modeled estimate without it.

## Project structure

```
src/
  routes/           TanStack Start file-based routes (one per page above)
  lib/               Server functions, hazard-scoring pipeline, AI agents
  components/        Shared UI (globe, maps, badges, shadcn primitives)
  integrations/      Supabase client setup
supabase/
  migrations/        Database schema
```

## License

All rights reserved. See [LICENSE](./LICENSE) — this repository is public
for portfolio and demonstration purposes; it is not licensed for reuse.

## Author

Built by [Ada Ahmad](https://github.com/adaahmad). Originally prototyped in
[Lovable](https://lovable.dev) during the hackathon, then continued as a
standalone codebase.
