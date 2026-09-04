import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ScoreInput = z.object({
  asset_id: z.string().uuid(),
  lat: z.number(),
  lon: z.number(),
  sector: z.string(),
  replacement_value_usd: z.number().nullable().optional(),
});

export const scoreAssetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ScoreInput.parse(data))
  .handler(async ({ data }) => {
    const { scoreAsset } = await import("./hazards.server");
    const bundle = await scoreAsset({
      lat: data.lat,
      lon: data.lon,
      sector: data.sector,
      replacement_value_usd: data.replacement_value_usd ?? null,
    });

    // Persist via admin client (bypasses RLS, but tables are already public).
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const methodology: Record<string, { score: number; score2050: number; source: string; note: string }> = {};
    for (const k of ["flood","heat","water","wildfire","sea_level","wind"] as const) {
      methodology[k] = {
        score: bundle[k].score,
        score2050: bundle[k].score2050,
        source: bundle[k].source,
        note: bundle[k].note,
      };
    }

    const row = {
      asset_id: data.asset_id,
      flood_now: bundle.flood.score, flood_2050: bundle.flood.score2050,
      heat_now: bundle.heat.score, heat_2050: bundle.heat.score2050,
      water_now: bundle.water.score, water_2050: bundle.water.score2050,
      wildfire_now: bundle.wildfire.score, wildfire_2050: bundle.wildfire.score2050,
      sea_level_now: bundle.sea_level.score, sea_level_2050: bundle.sea_level.score2050,
      wind_now: bundle.wind.score, wind_2050: bundle.wind.score2050,
      composite_now: bundle.composite_now,
      composite_2050: bundle.composite_2050,
      expected_annual_loss_usd: bundle.expected_annual_loss_usd,
      methodology,
      warnings: bundle.warnings,
      computed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("hazard_scores")
      .upsert(row, { onConflict: "asset_id" });
    if (error) throw new Error(`DB upsert failed: ${error.message}`);

    return { ok: true as const, ...bundle };
  });
