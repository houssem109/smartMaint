'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import InstallQrCard from '@/components/InstallQrCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminMobileInstallPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Phone install">
        <div className="mx-auto max-w-3xl space-y-6">
          <InstallQrCard />

          {/* <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
              <CardDescription className="text-xs">
                No cloud hosting — workers connect to this PC over Wi‑Fi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                1. Keep Docker running on this PC (<code className="text-foreground">docker compose up -d</code>).
              </p>
              <p>
                2. Show this QR code to workers — they scan it with their phone camera.
              </p>
              <p>
                3. They follow the install steps, then log in with their worker account.
              </p>
              <p>
                4. On your PC, keep using <code className="text-foreground">http://localhost:3000</code> — no change needed.
              </p>
            </CardContent>
          </Card> */}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
