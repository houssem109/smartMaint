'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect old worker-only URL to shared create-ticket page
export default function WorkerCreateTicketRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/create-ticket');
  }, [router]);
  return null;
}
