"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSemicolonCsv = parseSemicolonCsv;
exports.resolveOrderDataDir = resolveOrderDataDir;
exports.splitCsvList = splitCsvList;
const fs_1 = require("fs");
const path_1 = require("path");
function parseSemicolonCsv(filePath) {
    const raw = (0, fs_1.readFileSync)(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length)
        return [];
    const headerCells = lines[0].split(';').map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(';').map((c) => c.trim());
        const row = {};
        for (let j = 0; j < headerCells.length; j++) {
            const key = headerCells[j];
            if (!key)
                continue;
            row[key] = cells[j] ?? '';
        }
        rows.push(row);
    }
    return rows;
}
function resolveOrderDataDir() {
    const fromEnv = process.env.ORDER_TECHO_DATA_DIR?.trim();
    if (fromEnv && (0, fs_1.existsSync)(fromEnv))
        return fromEnv;
    const candidates = [
        (0, path_1.join)(process.cwd(), 'data', 'order-techo'),
        (0, path_1.join)(process.cwd(), 'backend', 'data', 'order-techo'),
        (0, path_1.join)(__dirname, '..', '..', 'data', 'order-techo'),
        (0, path_1.join)(__dirname, '..', '..', '..', 'data', 'order-techo'),
    ];
    for (const p of candidates) {
        if ((0, fs_1.existsSync)((0, path_1.join)(p, 'data_plus.csv')))
            return p;
    }
    return candidates[0];
}
function splitCsvList(value) {
    if (!value?.trim())
        return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
//# sourceMappingURL=order-csv.util.js.map