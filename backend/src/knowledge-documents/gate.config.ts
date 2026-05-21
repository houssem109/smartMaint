/** 2 Upload gate — Tier 1/2 thresholds and sample sizes (env-tunable). */

function parseFloatEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

function parseIntEnv(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Tier 1: accept when heuristic score is strictly above this (default 0.75). */
export function getGateTier1AcceptAbove(): number {
  return parseFloatEnv('GATE_TIER1_ACCEPT_ABOVE', 0.75);
}

/** Tier 1: reject when heuristic score is strictly below this (default 0.25). */
export function getGateTier1RejectBelow(): number {
  return parseFloatEnv('GATE_TIER1_REJECT_BELOW', 0.25);
}

/** Tier 2: cosine similarity to work profile must exceed this to auto-accept (default 0.8). */
export function getGateTier2WorkSimMin(): number {
  return parseFloatEnv('GATE_TIER2_WORK_SIM_MIN', 0.8);
}

/** Tier 2: cosine similarity to non-work profile must exceed this to auto-reject (default 0.8). */
export function getGateTier2NonWorkSimMin(): number {
  return parseFloatEnv('GATE_TIER2_NONWORK_SIM_MIN', 0.8);
}

/** Number of leading pages joined for Tier 2 embedding (default 3 — architecture 2). */
export function getGateTier2PageCount(): number {
  return parseIntEnv('GATE_TIER2_PAGE_COUNT', 3, 1, 50);
}

/** Pages joined for Tier 1 heuristic + Tier 3 LLM sample + machine profile sample (default 10). */
export function getGateHeuristicPageCount(): number {
  return parseIntEnv('GATE_HEURISTIC_PAGE_COUNT', 10, 1, 50);
}

/** Max characters of joined page text sent to Tier 3 LLM (default 9000). */
export function getGateLlmCharLimit(): number {
  return parseIntEnv('GATE_LLM_CHAR_LIMIT', 9000, 500, 100_000);
}

/** Optional Ollama model for gate Tier 3 only; falls back to `OLLAMA_MODEL` in AiService. */
export function getOllamaGateModel(): string | undefined {
  const m = process.env.OLLAMA_GATE_MODEL?.trim();
  return m && m.length > 0 ? m : undefined;
}
