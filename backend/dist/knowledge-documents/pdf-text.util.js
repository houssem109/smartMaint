"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePdfWithPoppler = parsePdfWithPoppler;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
async function parsePdfWithPoppler(buffer) {
    const workDir = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), 'smartmaint-poppler-'));
    const pdfPath = (0, path_1.join)(workDir, 'source.pdf');
    (0, fs_1.writeFileSync)(pdfPath, buffer);
    try {
        const pdftotext = process.env.PDFTOTEXT_PATH?.trim() || 'pdftotext';
        const pdfinfo = process.env.PDFINFO_PATH?.trim() || 'pdfinfo';
        const fullRes = await execFileAsync(pdftotext, ['-enc', 'UTF-8', '-layout', pdfPath, '-'], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
        const fullTextRaw = String(fullRes.stdout ?? '');
        let numpages = 0;
        try {
            const infoRes = await execFileAsync(pdfinfo, [pdfPath], {
                windowsHide: true,
                maxBuffer: 4 * 1024 * 1024,
            });
            const m = String(infoRes.stdout ?? '').match(/^Pages:\s+(\d+)/m);
            if (m?.[1])
                numpages = parseInt(m[1], 10) || 0;
        }
        catch {
            numpages = 0;
        }
        const pages = [];
        if (numpages > 0) {
            for (let i = 1; i <= numpages; i++) {
                try {
                    const pageRes = await execFileAsync(pdftotext, ['-f', String(i), '-l', String(i), '-enc', 'UTF-8', '-layout', pdfPath, '-'], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
                    pages.push(String(pageRes.stdout ?? ''));
                }
                catch {
                    pages.push('');
                }
            }
        }
        const fallbackPages = fullTextRaw.split('\f');
        const finalPages = pages.length > 0 ? pages : fallbackPages;
        const text = finalPages.join('\f');
        const finalPageCount = numpages > 0 ? numpages : Math.max(1, fallbackPages.length);
        return { text, numpages: finalPageCount, pages: finalPages };
    }
    finally {
        try {
            (0, fs_1.rmSync)(workDir, { recursive: true, force: true });
        }
        catch {
        }
    }
}
//# sourceMappingURL=pdf-text.util.js.map