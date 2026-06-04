'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import TechoChatWorkspace from '@/components/TechoChatWorkspace';

export default function TechoPage() {
  return (
    <ProtectedRoute>
      <Layout title="Techo conversations">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Techo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All your assistant conversations in one place. Mark a thread as done when the issue is resolved.
            </p>
          </div>
          <TechoChatWorkspace />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
