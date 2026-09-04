// Small, honest label distinguishing real computed figures from LLM
// interpretation, shown next to every agent section / report section that
// carries AI-generated text. See the /briefing and /report agent-grounding
// audit: some sections narrate real pipeline numbers, others are qualitative
// reasoning with no dataset behind the specifics — the two must never look
// the same to a client reading the output.

export type GroundingKind = "grounded" | "ai";

export function GroundingBadge({ kind, label }: { kind: GroundingKind; label?: string }) {
  const isGrounded = kind === "grounded";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
        isGrounded
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          : "border-sky-500/40 bg-sky-500/10 text-sky-400"
      }`}
      title={
        isGrounded
          ? "Based on real computed data from the hazard pipeline — figures shown can be cited."
          : "AI interpretation/reasoning — may be qualitative or synthesized; not a substitute for a sourced figure."
      }
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isGrounded ? "bg-emerald-400" : "bg-sky-400"}`}
      />
      {label ?? (isGrounded ? "Data-grounded" : "AI analysis")}
    </span>
  );
}
