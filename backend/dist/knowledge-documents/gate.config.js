"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGateTier1AcceptAbove = getGateTier1AcceptAbove;
exports.getGateTier1RejectBelow = getGateTier1RejectBelow;
exports.getGateTier2WorkSimMin = getGateTier2WorkSimMin;
exports.getGateTier2NonWorkSimMin = getGateTier2NonWorkSimMin;
exports.getGateTier2PageCount = getGateTier2PageCount;
exports.getGateHeuristicPageCount = getGateHeuristicPageCount;
exports.getGateLlmCharLimit = getGateLlmCharLimit;
exports.getOllamaGateModel = getOllamaGateModel;
function parseFloatEnv(key, fallback) {
    const raw = process.env[key];
    if (raw == null || String(raw).trim() === '')
        return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}
function parseIntEnv(key, fallback, min, max) {
    const raw = process.env[key];
    if (raw == null || String(raw).trim() === '')
        return fallback;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
function getGateTier1AcceptAbove() {
    return parseFloatEnv('GATE_TIER1_ACCEPT_ABOVE', 0.75);
}
function getGateTier1RejectBelow() {
    return parseFloatEnv('GATE_TIER1_REJECT_BELOW', 0.25);
}
function getGateTier2WorkSimMin() {
    return parseFloatEnv('GATE_TIER2_WORK_SIM_MIN', 0.8);
}
function getGateTier2NonWorkSimMin() {
    return parseFloatEnv('GATE_TIER2_NONWORK_SIM_MIN', 0.8);
}
function getGateTier2PageCount() {
    return parseIntEnv('GATE_TIER2_PAGE_COUNT', 3, 1, 50);
}
function getGateHeuristicPageCount() {
    return parseIntEnv('GATE_HEURISTIC_PAGE_COUNT', 10, 1, 50);
}
function getGateLlmCharLimit() {
    return parseIntEnv('GATE_LLM_CHAR_LIMIT', 9000, 500, 100_000);
}
function getOllamaGateModel() {
    const m = process.env.OLLAMA_GATE_MODEL?.trim();
    return m && m.length > 0 ? m : undefined;
}
//# sourceMappingURL=gate.config.js.map