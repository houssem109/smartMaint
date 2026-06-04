import { cn } from '@/lib/utils';

/** Green top stripe for popovers, dropdowns, and modal panels. */
export function AccentBand({ className }: { className?: string }) {
  return <div className={cn('accent-band-top', className)} aria-hidden />;
}
