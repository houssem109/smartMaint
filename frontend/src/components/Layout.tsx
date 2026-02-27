'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AdminSidebar from './AdminSidebar';
import TechnicianSidebar from './TechnicianSidebar';
import WorkerSidebar from './WorkerSidebar';
import { Sun, Moon } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showSidebar?: boolean; // kept for backwards compatibility, now ignored
}

export default function Layout({ children, title }: LayoutProps) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors flex">
      {user?.role === 'worker' && (
        <WorkerSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}
      {user?.role === 'technician' && (
        <TechnicianSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}
      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-base text-muted-foreground">
              <span className="font-medium text-foreground">
                {user?.fullName || user?.email}
              </span>
              <Badge variant="secondary" className="font-normal capitalize">
                {user?.role}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="h-9 w-9"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
