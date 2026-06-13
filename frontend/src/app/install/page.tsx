'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import SmartMaintWordmark from '@/components/SmartMaintWordmark';
import { Button } from '@/components/ui/button';
import { usePwaInstall, isIosSafari, isAndroidChrome } from '@/hooks/usePwaInstall';

export default function InstallPage() {
  const router = useRouter();
  const { canInstall, isStandalone, install } = usePwaInstall();

  useEffect(() => {
    if (isStandalone) {
      router.replace('/login');
    }
  }, [isStandalone, router]);

  const handleInstall = async () => {
    const ok = await install();
    if (ok) {
      toast.success('SmartMaint installed — open it from your home screen');
      router.push('/login');
    }
  };

  if (isStandalone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
        <p className="text-sm text-[#64748B]">Opening SmartMaint…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <div className="accent-band-top h-1 shrink-0" aria-hidden />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] bg-gradient-to-br from-[#1E40AF]/5 to-white px-6 py-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E40AF] text-white shadow-md">
              <Smartphone className="h-8 w-8" />
            </div>
            <h1 className="mt-5">
              <SmartMaintWordmark size="md" variant="login" />
            </h1>
            <p className="mt-2 text-sm text-[#64748B]">Install as an app on your phone</p>
          </div>

          <div className="space-y-5 px-6 py-6 text-sm text-[#475569]">
            <div className="rounded-lg border border-[#1E40AF]/20 bg-[#1E40AF]/5 px-4 py-3 text-xs leading-relaxed text-[#1E293B]">
              <p className="font-semibold">Important</p>
              <p className="mt-1">
                After installing, always open SmartMaint from the <strong>home screen icon</strong>.
                Do not type the address in Chrome — that opens the browser, not the app.
              </p>
            </div>

            {canInstall ? (
              <Button type="button" className="w-full gap-2 text-base h-11" onClick={handleInstall}>
                <Download className="h-5 w-5" />
                Install SmartMaint app
              </Button>
            ) : (
              <div className="space-y-4">
                {isAndroidChrome() && (
                  <div>
                    <p className="font-semibold text-[#1E293B]">Android (Chrome)</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
                      <li>Tap the menu (⋮) at the top right.</li>
                      <li>
                        Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                      </li>
                      <li>Confirm — find the SmartMaint icon on your home screen.</li>
                    </ol>
                  </div>
                )}
                {isIosSafari() && (
                  <div>
                    <p className="font-semibold text-[#1E293B]">iPhone (Safari only)</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
                      <li>Tap the <strong>Share</strong> button (square with arrow).</li>
                      <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
                      <li>Tap <strong>Add</strong> — open SmartMaint from your home screen.</li>
                    </ol>
                  </div>
                )}
                {!isAndroidChrome() && !isIosSafari() && (
                  <div>
                    <p className="font-semibold text-[#1E293B]">Install steps</p>
                    <ul className="mt-2 space-y-2 text-xs leading-relaxed">
                      <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" />
                        <span>
                          <strong>Android:</strong> Chrome → menu (⋮) → Install app / Add to Home screen
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1E40AF]" />
                        <span>
                          <strong>iPhone:</strong> Safari → Share → Add to Home Screen
                        </span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Same Wi‑Fi as the SmartMaint PC, and the PC must stay running.
            </p>

            <Button asChild variant="outline" className="w-full gap-2">
              <Link href="/login">
                Skip — open in browser
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
