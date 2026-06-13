"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCorsOrigins = parseCorsOrigins;
exports.isDevLanOrigin = isDevLanOrigin;
exports.corsOriginCallback = corsOriginCallback;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
const LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;
function parseCorsOrigins(raw) {
    const value = raw?.trim() || DEFAULT_FRONTEND_ORIGIN;
    const origins = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    if (origins.length === 0)
        return DEFAULT_FRONTEND_ORIGIN;
    return origins.length === 1 ? origins[0] : origins;
}
function isDevLanOrigin(origin) {
    if (!origin)
        return true;
    if (process.env.NODE_ENV !== 'development')
        return false;
    return LAN_ORIGIN.test(origin);
}
function corsOriginCallback(origin, callback) {
    const allowed = parseCorsOrigins(process.env.FRONTEND_URL);
    const list = Array.isArray(allowed) ? allowed : [allowed];
    if (!origin || list.includes(origin) || isDevLanOrigin(origin)) {
        callback(null, true);
        return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
}
//# sourceMappingURL=cors.util.js.map