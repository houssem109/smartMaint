'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import TechoChatWorkspace from '@/components/TechoChatWorkspace';

export default function TechoPage() {
  return (
    <ProtectedRoute>
      <Layout title="Techo conversations">
        <TechoChatWorkspace />
      </Layout>
    </ProtectedRoute>
  );
}
