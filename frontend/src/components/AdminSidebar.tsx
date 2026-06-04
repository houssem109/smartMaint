'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
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
  ClipboardList,
  Download,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

type BadgeKey = 'knowledge' | 'pdfCandidates';

const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: BadgeKey;
}[] = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/tickets', label: 'Tickets', icon: Ticket },
  { href: '/dashboard/admin/tickets-export', label: 'Tickets export', icon: Download },
  { href: '/dashboard/admin/history', label: 'History', icon: Clock },
  { href: '/dashboard/techo', label: 'Techo chat', icon: MessageCircle },
  { href: '/dashboard/admin/knowledge', label: 'Knowledge base', icon: BookOpenText, badgeKey: 'knowledge' },
  { href: '/dashboard/admin/knowledge-docs', label: 'PDF Library', icon: FileText, badgeKey: 'pdfCandidates' },
  { href: '/dashboard/admin/extraction-feedback', label: 'PDF review log', icon: ClipboardList },
  { href: '/dashboard/admin/problems-solutions-export', label: 'Problems export', icon: Download },
];

export default function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [counts, setCounts] = useState({ knowledge: 0, pdfCandidates: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [pipe, know] = await Promise.all([
          api.get<{ extractionCandidatesPending: number }>('/knowledge-documents/admin-pipeline-counts'),
          api.get<{ count: number }>('/knowledge/pending-review/count'),
        ]);
        setCounts({
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
    return counts.pdfCandidates;
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out shrink-0',
        isOpen ? 'w-56' : 'w-[4.25rem]'
      )}
    >
      <div className="accent-band-top" aria-hidden />

      {/* Header: toggle + brand */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-border shrink-0',
          isOpen ? 'gap-2 px-3' : 'justify-center px-0'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          {isOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeft className="h-5 w-5" />
          )}
        </Button>
        {isOpen && (
          <div className="flex flex-1 justify-center pr-6">
            <span className="font-semibold text-foreground truncate tracking-tight">
              Smart<span className="text-primary">Maint</span>
            </span>
          </div>
        )}
      </div>

      {/* Nav links - always visible, labels only when open */}
      <nav className="sidebar-scroll flex flex-1 flex-col gap-0.5 p-2 pr-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badgeKey }) => {
          // Dashboard (admin root): active only when exactly on /dashboard/admin
          const isActive =
            href === '/dashboard/admin'
              ? pathname === '/dashboard/admin'
              : pathname === href || pathname.startsWith(href + '/');
          const n = badgeKey ? badgeFor(badgeKey) : 0;
          const isTecho = href === '/dashboard/techo';
          const className = cn(
            'sidebar-nav-link',
            isOpen ? 'gap-3 px-3 py-2 text-sm' : 'justify-center p-2.5',
            isActive && 'sidebar-nav-link-active',
            isActive && isTecho && 'ring-1 ring-accent/30',
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
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      {n > 99 ? '99+' : n}
                    </span>
                  )}
                </>
              )}
            </>
          );
          return (
            <Link key={href} href={href} title={!isOpen ? label : undefined} className={className}>
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Settings + Logout at bottom */}
      <div className="border-t border-border p-2 shrink-0 space-y-0.5">
        <Link
          href="/dashboard/settings"
          title={!isOpen ? 'Settings' : undefined}
          className={cn(
            'sidebar-nav-link',
            isOpen ? 'gap-3 px-3 py-2 text-sm' : 'justify-center p-2.5',
            (pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')) &&
              'sidebar-nav-link-active',
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {isOpen && <span>Settings</span>}
        </Link>
        <Button
          variant="ghost"
          className={cn(
            'w-full text-foreground/80 hover:bg-destructive/10 hover:text-destructive text-sm font-medium',
            isOpen ? 'justify-start gap-3 px-3 py-2 h-auto' : 'justify-center p-2.5 h-auto',
          )}
          onClick={handleLogout}
          title={!isOpen ? 'Log out' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isOpen && <span>Log out</span>}
        </Button>
      </div>
    </aside>
  );
}
