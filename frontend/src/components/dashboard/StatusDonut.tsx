'use client';

const DEFAULT_STROKE = '#E2E8F0';

export type DonutSegment = {
  label: string;
  value: number;
  stroke: string;
};

export default function StatusDonut({
  segments,
  centerLabel = 'tickets',
}: {
  segments: DonutSegment[];
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 52;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No tickets yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div className="relative shrink-0">
        <svg width={140} height={140} viewBox="0 0 128 128" className="-rotate-90">
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={DEFAULT_STROKE}
            strokeWidth="12"
          />
          {segments.map((seg) => {
            if (seg.value === 0) return null;
            const pct = seg.value / total;
            const dash = pct * circumference;
            const el = (
              <circle
                key={seg.label}
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke={seg.stroke}
                strokeWidth="12"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {centerLabel}
          </span>
        </div>
      </div>
      <ul className="grid w-full max-w-[200px] grid-cols-1 gap-2 text-sm">
        {segments.map((seg) => {
          const pct = total ? Math.round((seg.value / total) * 100) : 0;
          return (
            <li key={seg.label} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.stroke }}
                />
                {seg.label}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {seg.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
