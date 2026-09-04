
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  country text,
  topography text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  bbox jsonb,
  sectors text[] NOT NULL DEFAULT '{}',
  population integer,
  annual_visitors integer,
  baseline_revenue_usd numeric,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.regions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regions TO authenticated;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read regions" ON public.regions FOR SELECT USING (true);
CREATE POLICY "Public write regions" ON public.regions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.region_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  scenario text NOT NULL,
  year integer NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (region_id, scenario, year)
);
GRANT SELECT ON public.region_metrics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.region_metrics TO authenticated;
GRANT ALL ON public.region_metrics TO service_role;
ALTER TABLE public.region_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read region_metrics" ON public.region_metrics FOR SELECT USING (true);
CREATE POLICY "Public write region_metrics" ON public.region_metrics FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.adaptation_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  topography text[] NOT NULL DEFAULT '{}',
  hazards text[] NOT NULL DEFAULT '{}',
  cost_tier integer NOT NULL DEFAULT 2,
  timeline_years integer NOT NULL DEFAULT 5,
  effectiveness integer NOT NULL DEFAULT 60,
  co_benefits text[] NOT NULL DEFAULT '{}',
  case_study_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adaptation_strategies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adaptation_strategies TO authenticated;
GRANT ALL ON public.adaptation_strategies TO service_role;
ALTER TABLE public.adaptation_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read adaptation_strategies" ON public.adaptation_strategies FOR SELECT USING (true);
CREATE POLICY "Public write adaptation_strategies" ON public.adaptation_strategies FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_region_metrics_lookup ON public.region_metrics(region_id, scenario, year);
CREATE INDEX idx_regions_topography ON public.regions(topography);
