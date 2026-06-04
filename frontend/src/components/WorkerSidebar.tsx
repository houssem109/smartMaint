'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  Settings,
  Bell,
  BookOpen,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface WorkerSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: '/dashboard/worker', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/worker/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { href: '/dashboard/worker/knowledge-pdfs', label: 'PDF library', icon: FileText },
  { href: '/dashboard/techo', label: 'Techo chat', icon: MessageCircle },
  { href: '/dashboard/worker/notifications', label: 'Notifications', icon: Bell },
];

export default function WorkerSidebar({ isOpen, onToggle }: WorkerSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out shrink-0',
        isOpen ? 'w-56' : 'w-[4.25rem]',
      )}
    >
      <div className="accent-band-top" aria-hidden />

      <div
        className={cn(
          'flex h-14 items-center border-b border-border shrink-0',
          isOpen ? 'gap-2 px-3' : 'justify-center px-0',
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

      <nav className="sidebar-scroll flex flex-1 flex-col gap-0.5 p-2 pr-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/dashboard/worker'
              ? pathname === '/dashboard/worker'
              : pathname === href || pathname.startsWith(href + '/');
          const isTecho = href === '/dashboard/techo';
          return (
            <Link
              key={href}
              href={href}
              title={!isOpen ? label : undefined}
              className={cn(
                'sidebar-nav-link',
                isOpen ? 'gap-3 px-3 py-2 text-sm' : 'justify-center p-2.5',
                isActive && 'sidebar-nav-link-active',
                isActive && isTecho && 'ring-1 ring-accent/30',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

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

