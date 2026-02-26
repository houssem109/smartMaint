'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin/users', label: 'Users', icon: Users },
  { href: '/dashboard/admin/tickets', label: 'Tickets', icon: Ticket },
];

export default function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
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
        {navItems.map(({ href, label, icon: Icon }) => {
          // Dashboard (admin root): active only when exactly on /dashboard/admin
          const isActive =
            href === '/dashboard/admin'
              ? pathname === '/dashboard/admin'
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={!isOpen ? label : undefined}
              className={cn(
                'flex items-center rounded-lg font-medium transition-colors',
                isOpen ? 'gap-3 px-3 py-2.5 text-base' : 'justify-center p-2.5',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/90 hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {isOpen && <span className="truncate">{label}</span>}
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
