import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GeocodeInput = z.object({ query: z.string().min(1).max(120) });

export type GeocodeResult = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  admin?: string;
  /** Real population figure from Open-Meteo's geocoding index, when it has
   *  one for this place. Null when unavailable — never invented downstream. */
  population: number | null;
};

/** Geocode a free-text region/place name via Open-Meteo (no key). */
export const geocodeRegion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GeocodeInput.parse(d))
  .handler(async ({ data }): Promise<GeocodeResult | null> => {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        data.query,
      )}&count=1&language=en&format=json`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) return null;
      const j: any = await res.json();
      const r = j?.results?.[0];
      if (!r) return null;
      return {
        name: r.name,
        country: r.country ?? "",
        admin: r.admin1 ?? undefined,
        lat: Number(r.latitude),
        lon: Number(r.longitude),
        population: typeof r.population === "number" ? r.population : null,
      };
    } catch {
      return null;
    }
  });
