import { execFile } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function parsePdfWithPoppler(
  buffer: Buffer,
): Promise<{ text: string; numpages: number; pages: string[] }> {
  const workDir = mkdtempSync(join(tmpdir(), 'smartmaint-poppler-'));
  const pdfPath = join(workDir, 'source.pdf');
  writeFileSync(pdfPath, buffer);

  try {
    const pdftotext = process.env.PDFTOTEXT_PATH?.trim() || 'pdftotext';
    const pdfinfo = process.env.PDFINFO_PATH?.trim() || 'pdfinfo';

    const fullRes = await execFileAsync(
      pdftotext,
      ['-enc', 'UTF-8', '-layout', pdfPath, '-'],
      { windowsHide: true, maxBuffer: 64 * 1024 * 1024 },
    );
    const fullTextRaw = String(fullRes.stdout ?? '');

    let numpages = 0;
    try {
      const infoRes = await execFileAsync(pdfinfo, [pdfPath], {
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      });
      const m = String(infoRes.stdout ?? '').match(/^Pages:\s+(\d+)/m);
      if (m?.[1]) numpages = parseInt(m[1], 10) || 0;
    } catch {
      numpages = 0;
    }

    const pages: string[] = [];
    if (numpages > 0) {
      for (let i = 1; i <= numpages; i++) {
        try {
          const pageRes = await execFileAsync(
            pdftotext,
            ['-f', String(i), '-l', String(i), '-enc', 'UTF-8', '-layout', pdfPath, '-'],
            { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
          );
          pages.push(String(pageRes.stdout ?? ''));
        } catch {
          pages.push('');
        }
      }
    }

    const fallbackPages = fullTextRaw.split('\f');
    const finalPages = pages.length > 0 ? pages : fallbackPages;
    const text = finalPages.join('\f');
    const finalPageCount = numpages > 0 ? numpages : Math.max(1, fallbackPages.length);

    return { text, numpages: finalPageCount, pages: finalPages };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
