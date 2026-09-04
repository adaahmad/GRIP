// Shared Anthropic Messages API client — server-only. Replaces the old
// Lovable AI Gateway fetch() calls used by agents.server.ts and
// report.functions.ts. One client, one JSON-structured-output helper, one
// place that turns SDK/config errors into a clean user-facing message
// instead of a raw error dump.

import Anthropic, {
  AuthenticationError,
  RateLimitError,
  APIConnectionError,
  APIError,
} from "@anthropic-ai/sdk";

let _client: Anthropic | undefined;

function safeParseJSON<T>(raw: string): T {
  let s = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = s.search(/[[{]/);
  if (start > 0) s = s.slice(start);
  try {
    return JSON.parse(s) as T;
  } catch {
    // Try to recover from truncation by balancing braces/brackets
    let depthObj = 0,
      depthArr = 0,
      inStr = false,
      esc = false,
      lastGood = -1;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === "\\") {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (c === "{") depthObj++;
      else if (c === "}") {
        depthObj--;
        if (depthObj === 0 && depthArr === 0) lastGood = i;
      } else if (c === "[") depthArr++;
      else if (c === "]") {
        depthArr--;
        if (depthObj === 0 && depthArr === 0) lastGood = i;
      }
    }
    if (lastGood > 0) {
      try {
        return JSON.parse(s.slice(0, lastGood + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new Error(`Model returned malformed JSON (len=${raw.length})`);
  }
}

/**
 * Call Claude with a JSON-schema-constrained response (structured outputs —
 * no beta header) and parse the result. Every failure mode (missing key,
 * auth, rate limit, network, refusal, empty/malformed response) surfaces as
 * a clean `"{featureLabel} unavailable — ..."` message — never a raw SDK
 * error dump — so the UI has something safe to show directly.
 */
export async function callClaudeJSON<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Shown in the user-facing error, e.g. "AI briefing", "Report generation". */
  featureLabel?: string;
}): Promise<T> {
  const label = opts.featureLabel ?? "AI request";
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      `${label} unavailable — check API configuration (ANTHROPIC_API_KEY is not set).`,
    );
  }
  if (!_client) _client = new Anthropic({ apiKey: key });

  let message: Anthropic.Message;
  try {
    message = await _client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: { type: "json_schema", schema: opts.schema } },
    });
  } catch (e) {
    if (e instanceof AuthenticationError) {
      throw new Error(
        `${label} unavailable — check API configuration (ANTHROPIC_API_KEY was rejected).`,
      );
    }
    if (e instanceof RateLimitError) {
      throw new Error(`${label} unavailable — rate limit reached. Try again shortly.`);
    }
    if (e instanceof APIConnectionError) {
      throw new Error(`${label} unavailable — could not reach the AI provider. Try again shortly.`);
    }
    if (e instanceof APIError) {
      throw new Error(
        `${label} unavailable — the AI provider returned an error. Try again shortly.`,
      );
    }
    throw new Error(`${label} unavailable — an unexpected error occurred.`);
  }

  if (message.stop_reason === "refusal") {
    throw new Error(`${label} unavailable — the request was declined. Try a different input.`);
  }
  // Adaptive thinking shares the max_tokens budget with the visible response
  // (thinking spend varies run-to-run), so a response can be cut off
  // mid-JSON well before the text itself looks unreasonably long. Catch that
  // here with a specific message instead of falling through to a generic
  // "malformed JSON" error that gives no hint of the real cause.
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `${label} unavailable — the response was cut off before completion (max_tokens reached). Increase maxTokens for this call.`,
    );
  }
  const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock || !textBlock.text.trim()) {
    throw new Error(`${label} unavailable — the model returned an empty response.`);
  }
  return safeParseJSON<T>(textBlock.text);
}
