'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Ticket,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Settings,
  Clock,
  BookOpenText,
  FileText,
  Workflow,
  ClipboardList,
  ListChecks,
  SlidersHorizontal,
  BookMarked,
  Table2,
  ClipboardCheck,
  TextSearch,
  Download,
  Database,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import api, { API_URL } from '@/lib/api';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

type BadgeKey = 'knowledge' | 'pdfCandidates' | 'pageFix';

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: BadgeKey;
  external?: boolean;
}[] = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/admin/tickets-export', label: 'Tickets export', icon: Download },
  { href: '/dashboard/admin/history', label: 'History', icon: Clock },
  { href: '/dashboard/admin/knowledge', label: 'Knowledge base', icon: BookOpenText, badgeKey: 'knowledge' },
  { href: '/dashboard/admin/knowledge-docs', label: 'PDF Library', icon: FileText, badgeKey: 'pdfCandidates' },
  { href: '/dashboard/admin/extraction-feedback', label: 'Extraction feedback', icon: ClipboardList },
  { href: '/dashboard/admin/pipeline-config', label: 'Pipeline env', icon: SlidersHorizontal },
  { href: '/dashboard/admin/database-inventory', label: 'DB inventory', icon: Table2 },
  { href: '/dashboard/admin/success-criteria', label: 'Success criteria', icon: ClipboardCheck },
  { href: '/dashboard/admin/troubleshooting-extraction', label: 'Troubleshooting extraction', icon: TextSearch },
  { href: '/dashboard/admin/problems-solutions-export', label: 'Problems export', icon: Download },
  { href: '/dashboard/admin/rag-stored-data', label: 'RAG stored data', icon: Database },
  { href: '/dashboard/admin/page-fix-queue', label: 'Page fix queue', icon: ListChecks, badgeKey: 'pageFix' },
  { href: '/dashboard/admin/manual-pipeline', label: 'Pipeline hub', icon: Workflow },
  {
    href: `${API_URL}/api/docs`,
    label: 'API (Swagger)',
    icon: BookMarked,
    external: true,
  },
];

export default function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [counts, setCounts] = useState({ knowledge: 0, pdfCandidates: 0, pageFix: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [pipe, know] = await Promise.all([
          api.get<{ pageFixOpen: number; extractionCandidatesPending: number }>(
            '/knowledge-documents/admin-pipeline-counts',
          ),
          api.get<{ count: number }>('/knowledge/pending-review/count'),
        ]);
        setCounts({
          pageFix: pipe.data.pageFixOpen ?? 0,
          pdfCandidates: pipe.data.extractionCandidatesPending ?? 0,
          knowledge: know.data.count ?? 0,
        });
      } catch {
        // ignore (e.g. not admin)
      }
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const badgeFor = (key?: BadgeKey) => {
    if (!key) return 0;
    if (key === 'knowledge') return counts.knowledge;
    if (key === 'pdfCandidates') return counts.pdfCandidates;
    return counts.pageFix;
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-border/40 bg-card transition-[width] duration-300 ease-in-out shrink-0',
        isOpen ? 'w-56' : 'w-[4.25rem]'
      )}
    >
      {/* Header: toggle + brand */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-border/40 shrink-0',
          isOpen ? 'gap-2 px-3' : 'justify-center px-0'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="shrink-0 h-9 w-9"
        >
          {isOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeft className="h-5 w-5" />
          )}
        </Button>
        {isOpen && (
          <div className="flex flex-1 justify-center pr-6">
            <span className="font-semibold text-foreground truncate">
              SmartMaint
            </span>
          </div>
        )}
      </div>

      {/* Nav links - always visible, labels only when open */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badgeKey, external }) => {
          // Dashboard (admin root): active only when exactly on /dashboard/admin
          const isActive = external
            ? false
            : href === '/dashboard/admin'
              ? pathname === '/dashboard/admin'
              : pathname === href || pathname.startsWith(href + '/');
          const n = badgeKey ? badgeFor(badgeKey) : 0;
          const className = cn(
            'flex items-center rounded-lg font-medium transition-colors',
            isOpen ? 'gap-3 px-3 py-2.5 text-base' : 'justify-center p-2.5',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/90 hover:bg-accent hover:text-foreground',
          );
          const inner = (
            <>
              <Icon className="h-5 w-5 shrink-0" />
              {isOpen && (
                <>
                  <span className="truncate flex-1 text-left">{label}</span>
                  {n > 0 && (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums min-w-[1.25rem] text-center',
                        isActive ? 'bg-background/25 text-primary-foreground' : 'bg-destructive/15 text-destructive',
                      )}
                    >
                      {n > 99 ? '99+' : n}
                    </span>
                  )}
                </>
              )}
            </>
          );
          if (external) {
            return (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={!isOpen ? label : undefined}
                className={className}
              >
                {inner}
              </a>
            );
          }
          return (
            <Link key={href} href={href} title={!isOpen ? label : undefined} className={className}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Settings + Logout at bottom */}
      <div className="border-t border-border/40 p-2 shrink-0 space-y-0.5">
        <Link
          href="/dashboard/settings"
          title={!isOpen ? 'Settings' : undefined}
          className={cn(
            'flex items-center rounded-lg font-medium transition-colors text-foreground/90 hover:bg-accent hover:text-foreground',
            isOpen ? 'gap-3 px-3 py-2.5 text-base' : 'justify-center p-2.5',
            pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')
              ? 'bg-accent text-foreground'
              : ''
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {isOpen && <span className="text-base font-medium">Settings</span>}
        </Link>
        <Button
          variant="ghost"
          className={cn(
            'w-full text-foreground/90 hover:bg-destructive/10 hover:text-destructive text-base',
            isOpen ? 'justify-start gap-3 px-3 py-2.5' : 'justify-center p-2.5'
          )}
          onClick={handleLogout}
          title={!isOpen ? 'Log out' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isOpen && <span className="text-base font-medium">Log out</span>}
        </Button>
      </div>
    </aside>
  );
}
