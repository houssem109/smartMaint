'use client';

import Link from 'next/link';
import { API_URL } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  BookOpenText,
  Wrench,
  ImageIcon,
  ListChecks,
  Cpu,
  MessageCircle,
  Layers,
  ScrollText,
  SlidersHorizontal,
  BookMarked,
  Database,
  ClipboardCheck,
  TextSearch,
  Download,
} from 'lucide-react';

const sections: {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof FileText;
  cta: string;
  external?: boolean;
}[] = [
  {
    id: '1-2',
    title: 'Ingestion & upload gate',
    description: 'Validate PDFs, work-related gate, queue for processing.',
    href: '/dashboard/admin/knowledge-docs',
    icon: FileText,
    cta: 'PDF Library',
  },
  {
    id: '3',
    title: 'Machine profiles',
    description: 'Auto-detected profiles; list + create, then Manage for counts (PDF FK + name-matched knowledge) and PATCH edit.',
    href: '/dashboard/admin/machine-profiles',
    icon: Cpu,
    cta: 'Machine profiles',
  },
  {
    id: '5-6',
    title: 'Page quality, OCR & vision',
    description: 'Per-page analysis, Run OCR / Run vision on a document detail.',
    href: '/dashboard/admin/knowledge-docs',
    icon: Wrench,
    cta: 'Open a PDF → detail',
  },
  {
    id: '7-8',
    title: 'Extraction & admin review',
    description: 'LLM candidates, approve/reject into the knowledge base.',
    href: '/dashboard/admin/knowledge-docs',
    icon: ListChecks,
    cta: 'PDF Library',
  },
  {
    id: '9',
    title: 'Technician experience (admin)',
    description: 'Pending review, field metadata, CSV/Excel export.',
    href: '/dashboard/admin/knowledge',
    icon: BookOpenText,
    cta: 'Knowledge base (admin)',
  },
  {
    id: '9-tech',
    title: 'Technician experience',
    description: 'Submit experiences and PDF manual suggestions.',
    href: '/dashboard/technician/knowledge',
    icon: BookOpenText,
    cta: 'Technician knowledge',
  },
  {
    id: '10',
    title: 'Field photos & chat',
    description: 'Photos on knowledge rows; Techo chat image attach (floating widget).',
    href: '/dashboard/admin/knowledge',
    icon: ImageIcon,
    cta: 'Knowledge + use Techo chat',
  },
  {
    id: 'fix',
    title: 'Admin page fix queue',
    description: 'Unreadable pages needing typed replacement text.',
    href: '/dashboard/admin/page-fix-queue',
    icon: ListChecks,
    cta: 'Page fix queue',
  },
  {
    id: '16',
    title: 'Pipeline environment',
    description:
      'Read-only view of effective gate, OCR, vision, extraction, Ollama, Qdrant, and Bull job options from running config.',
    href: '/dashboard/admin/pipeline-config',
    icon: SlidersHorizontal,
    cta: 'Pipeline env',
  },
  {
    id: '14',
    title: 'Extraction feedback log',
    description:
      'Analytics rows on candidate approve / approve with edits / reject. Filterable table; link to PDF document.',
    href: '/dashboard/admin/extraction-feedback',
    icon: ScrollText,
    cta: 'Extraction feedback',
  },
  {
    id: '11',
    title: 'Cross-document dedup & supersede',
    description:
      'Fingerprint duplicate block, optional supersedesDocumentId chain, predecessor RAG vectors purged. PDF Library: “Show superseded” for history.',
    href: '/dashboard/admin/knowledge-docs',
    icon: FileText,
    cta: 'PDF Library',
  },
  {
    id: '12',
    title: 'Embedding & Qdrant',
    description:
      'Chunk payloads include section/pages/title/confidence; chat returns sources. Use Techo (floating button) to see “Sources used” on each reply.',
    href: '/dashboard/admin',
    icon: Layers,
    cta: 'Dashboard → Techo',
  },
  {
    id: '18',
    title: 'HTTP API reference',
    description:
      'Canonical route list lives in PDF_KNOWLEDGE_ARCHITECTURE (section 18). Live OpenAPI UI: authorize with a JWT from login, then try endpoints.',
    href: `${API_URL}/api/docs`,
    icon: BookMarked,
    cta: 'Open Swagger (new tab)',
    external: true,
  },
  {
    id: '19',
    title: 'Database tables',
    description:
      'PostgreSQL tables for PDF ingestion, page analysis, jobs, vectors, machine names, page-fix queue, and chat-related FKs. Admin table + API inventory.',
    href: '/dashboard/admin/database-inventory',
    icon: Database,
    cta: 'DB inventory',
  },
  {
    id: '20',
    title: 'Success criteria / QA',
    description:
      'Original goals vs shipped, partial, gap, or aspirational — same matrix as the architecture doc (section 20). Use for release reviews.',
    href: '/dashboard/admin/success-criteria',
    icon: ClipboardCheck,
    cta: 'QA checklist',
  },
  {
    id: '22',
    title: 'Troubleshooting / P→S extraction',
    description:
      'Where structured candidates are built (service, Bull queue, DB table, slice heuristic). Read-only API mirror of the architecture doc.',
    href: '/dashboard/admin/troubleshooting-extraction',
    icon: TextSearch,
    cta: 'Troubleshooting reference',
  },
  {
    id: '23',
    title: 'Problems & solutions export',
    description:
      'Curated Excel/CSV from approved knowledge_entries; filters incl. PDF documentId after FK migration. Raw dumps: Knowledge page export/csv|xlsx.',
    href: '/dashboard/admin/problems-solutions-export',
    icon: Download,
    cta: 'Export UI',
  },
];

export default function ManualPipelineHubPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <Layout title="Manual & knowledge pipeline" showSidebar={true}>
        <div className="space-y-6 max-w-4xl">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Manual pipeline hub</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Map of PDF_KNOWLEDGE_ARCHITECTURE 1–23 features and where to run them in the UI. Techo chat
              (10 Type 2) opens from the floating button on any dashboard page.
            </p>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Techo chat
              </CardTitle>
              <CardDescription>
                Use the floating chat button — attach a JPEG/PNG/WebP with your question when vision is enabled
                on the server.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.id} className="border-border/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {s.title}
                    </CardTitle>
                    <CardDescription>{s.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {s.external ? (
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {s.cta} →
                      </a>
                    ) : (
                      <Link href={s.href} className="text-sm font-medium text-primary hover:underline">
                        {s.cta} →
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
