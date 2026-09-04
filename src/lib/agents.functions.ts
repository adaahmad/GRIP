import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BriefingInput = z.object({
  region: z.string().min(1),
  lat: z.number(),
  lon: z.number(),
  sector: z.string().default("other"),
  scenario: z.enum(["SSP1-2.6", "SSP2-4.5", "SSP5-8.5"]).default("SSP2-4.5"),
  planned_water_demand_m3_daily: z.number().nonnegative().default(500),
  /** Real population figure when known (e.g. from geocoding search) — never
   *  invented downstream if omitted. */
  population: z.number().nullable().optional(),
});

export const getBriefingFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BriefingInput.parse(d))
  .handler(async ({ data }) => {
    const { scoreAsset } = await import("./hazards.server");
    const { runTerra, runEcho, runSage, runOracle, runHerald, runAtlas, computeRci } =
      await import("./agents.server");

    const bundle = await scoreAsset({
      lat: data.lat,
      lon: data.lon,
      sector: data.sector,
      replacement_value_usd: null,
    });

    const snapshot = {
      flood: { now: bundle.flood.score, y2050: bundle.flood.score2050 },
      heat: { now: bundle.heat.score, y2050: bundle.heat.score2050 },
      water: { now: bundle.water.score, y2050: bundle.water.score2050 },
      wildfire: { now: bundle.wildfire.score, y2050: bundle.wildfire.score2050 },
      sea_level: { now: bundle.sea_level.score, y2050: bundle.sea_level.score2050 },
      wind: { now: bundle.wind.score, y2050: bundle.wind.score2050 },
      composite_now: bundle.composite_now,
      composite_2050: bundle.composite_2050,
    };

    // RCI is deterministic — computed here, not asked of the model — so
    // Sage only ever explains a real number, never invents its own.
    const rci = computeRci(snapshot.water.now, data.planned_water_demand_m3_daily);

    // Terra and Echo in parallel; Sage needs Terra's water score (already in snapshot).
    const [terra, echo, sageOut] = await Promise.all([
      runTerra({ region: data.region, lat: data.lat, lon: data.lon, scores: snapshot }),
      runEcho({ region: data.region, lat: data.lat, lon: data.lon, hazards: snapshot }),
      runSage({
        region: data.region,
        lat: data.lat,
        lon: data.lon,
        waterStressScore: snapshot.water.now,
        plannedWaterDemandM3Daily: data.planned_water_demand_m3_daily,
        population: data.population ?? null,
        rciScore: rci.score,
        rciFlag: rci.flag,
      }),
    ]);
    const sage = { rci_score: rci.score, rci_flag: rci.flag, ...sageOut };

    const oracle = await runOracle({
      region: data.region,
      terra,
      echo,
      sage,
      scenario: data.scenario,
    });
    const [atlas, herald_script] = await Promise.all([
      runAtlas({ region: data.region, sector: data.sector, terra, echo, sage, oracle }),
      runHerald({ region: data.region, terra, echo, sage, oracle }),
    ]);

    return { scores: snapshot, terra, echo, sage, oracle, atlas, herald_script };
  });
