import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type CsvRow = Record<string, string>;

/** Parse `;`-separated CSV with header row; strips all cell values. */
export function parseSemicolonCsv(filePath: string): CsvRow[] {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const headerCells = lines[0].split(';').map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(';').map((c) => c.trim());
    const row: CsvRow = {};
    for (let j = 0; j < headerCells.length; j++) {
      const key = headerCells[j];
      if (!key) continue;
      row[key] = cells[j] ?? '';
    }
    rows.push(row);
  }
  return rows;
}

export function resolveOrderDataDir(): string {
  const fromEnv = process.env.ORDER_TECHO_DATA_DIR?.trim();
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    join(process.cwd(), 'data', 'order-techo'),
    join(process.cwd(), 'backend', 'data', 'order-techo'),
    join(__dirname, '..', '..', 'data', 'order-techo'),
    join(__dirname, '..', '..', '..', 'data', 'order-techo'),
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'data_plus.csv'))) return p;
  }
  return candidates[0];
}

export function splitCsvList(value: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
