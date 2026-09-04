import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });
        const body = await request.json().catch(() => null) as { text?: string; voice?: string } | null;
        const text = body?.text?.trim();
        if (!text) return new Response("text required", { status: 400 });
        const voice = body?.voice ?? "alloy";

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice,
            response_format: "mp3",
          }),
        });
        if (!upstream.ok) {
          const t = await upstream.text().catch(() => "");
          return new Response(`TTS upstream ${upstream.status}: ${t.slice(0, 200)}`, { status: 502 });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
