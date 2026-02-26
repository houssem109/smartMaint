'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, Ticket } from 'lucide-react';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navItems = [
  { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/admin#users', label: 'Users', icon: Users },
  { href: '/dashboard/admin#tickets', label: 'Tickets', icon: Ticket },
];

export default function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
        isOpen ? 'w-56' : 'w-0 overflow-hidden'
      )}
    >
      <div className="flex h-16 items-center border-b px-4">
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar">
          {isOpen ? '◀' : '▶'}
        </Button>
        {isOpen && <span className="ml-2 text-sm font-medium">Admin</span>}
      </div>
      {isOpen && (
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href || pathname.startsWith(href + '/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </aside>
  );
}
