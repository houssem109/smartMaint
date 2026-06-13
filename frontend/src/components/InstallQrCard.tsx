'use client';

import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resolveMobileAppUrl } from '@/lib/runtime-url';

interface InstallQrCardProps {
  /** Override URL (admin page can pass edited value). */
  url?: string;
  compact?: boolean;
}

export default function InstallQrCard({ url, compact = false }: InstallQrCardProps) {
  const installUrl = useMemo(() => {
    const raw = url?.trim() || resolveMobileAppUrl();
    if (!raw) return '';
    return raw.replace(/\/$/, '');
  }, [url]);

  const qrTarget = installUrl ? `${installUrl}/install` : '';

  const copyLink = async () => {
    if (!qrTarget) {
      toast.error('Set NEXT_PUBLIC_MOBILE_APP_URL in .env first');
      return;
    }
    try {
      await navigator.clipboard.writeText(qrTarget);
      toast.success('Install link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className={compact ? 'pb-3' : undefined}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Install on phone</CardTitle>
            <CardDescription className="text-xs">
              Workers scan the QR code to open SmartMaint and add it to their home screen.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {qrTarget ? (
          <>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="rounded-xl border border-border/80 bg-white p-3 shadow-sm">
                <QRCodeSVG value={qrTarget} size={compact ? 160 : 200} level="M" includeMargin />
              </div>
              <div className="min-w-0 flex-1 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Install link
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{qrTarget}</p>
                </div>
                <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
                  <li>Scan with the phone camera {/* (same Wi‑Fi as this PC) */}.</li>
                  <li>Open the page, then tap <strong className="text-foreground">Add to Home Screen</strong>.</li>
                  <li>Log in with worker credentials.</li>
                </ol>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy link
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Mobile URL not configured</p>
            <p className="mt-2 text-xs leading-relaxed">
              Add your PC Wi‑Fi IP to <code className="text-foreground">.env</code>:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 text-[11px] text-foreground">
              NEXT_PUBLIC_MOBILE_APP_URL=http://10.137.193.8:3000
            </pre>
            <p className="mt-2 text-xs">Then restart Docker: <code className="text-foreground">docker compose up -d</code></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
