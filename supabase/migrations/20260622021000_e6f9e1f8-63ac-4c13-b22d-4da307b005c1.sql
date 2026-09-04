
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT,
  sector TEXT NOT NULL DEFAULT 'other',
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  annual_revenue_usd NUMERIC,
  replacement_value_usd NUMERIC,
  geocode_status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO anon, authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Public insert assets" ON public.assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update assets" ON public.assets FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete assets" ON public.assets FOR DELETE USING (true);

CREATE TABLE public.hazard_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  flood_now NUMERIC, flood_2050 NUMERIC,
  heat_now NUMERIC, heat_2050 NUMERIC,
  water_now NUMERIC, water_2050 NUMERIC,
  wildfire_now NUMERIC, wildfire_2050 NUMERIC,
  sea_level_now NUMERIC, sea_level_2050 NUMERIC,
  wind_now NUMERIC, wind_2050 NUMERIC,
  composite_now NUMERIC, composite_2050 NUMERIC,
  expected_annual_loss_usd NUMERIC,
  methodology JSONB,
  warnings JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hazard_scores TO anon, authenticated;
GRANT ALL ON public.hazard_scores TO service_role;
ALTER TABLE public.hazard_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read hazard_scores" ON public.hazard_scores FOR SELECT USING (true);
CREATE POLICY "Public insert hazard_scores" ON public.hazard_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update hazard_scores" ON public.hazard_scores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete hazard_scores" ON public.hazard_scores FOR DELETE USING (true);

CREATE INDEX assets_sector_idx ON public.assets(sector);
CREATE INDEX hazard_scores_asset_idx ON public.hazard_scores(asset_id);
