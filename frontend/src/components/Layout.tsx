'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AdminSidebar from './AdminSidebar';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showSidebar?: boolean;
}

export default function Layout({ children, title, showSidebar = false }: LayoutProps) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Start with sidebar open by default

  return (
    <div className="min-h-screen bg-background transition-colors flex">
      {/* Sidebar (only if enabled) - Now at the top level */}
      {showSidebar && (
        <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      )}

      {/* Main content area with top nav */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <nav className="bg-card shadow-sm border-b sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Left side - Page title */}
              <div className="flex items-center">
                <span className="font-semibold">{title}</span>
              </div>

              {/* Right side - User info and theme toggle */}
              <div className="flex items-center gap-6">
                <span className="text-base font-semibold">
                  {user?.fullName || user?.email} ({user?.role})
                </span>
                <Button
                  variant="outline"
                  size="default"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  className="ml-auto"
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className={cn(
          'flex-1 transition-all duration-300'
        )}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
