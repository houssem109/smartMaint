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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background transition-colors">
      {/* Top Navigation */}
      <nav className="bg-card shadow-sm border-b sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Menu button (only if sidebar is enabled) */}
            <div className="flex items-center">
              {showSidebar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="mr-4"
                >
                  ☰
                </Button>
              )}
              <span className="font-semibold">{title}</span>
            </div>

            {/* Right side - Theme toggle and user info */}
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </Button>
              <span className="text-sm font-semibold">
                {user?.fullName || user?.email} ({user?.role})
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex">
        {/* Sidebar (only if enabled) */}
        {showSidebar && (
          <AdminSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        )}

        {/* Content */}
        <main className={cn(
          'flex-1 transition-all duration-300',
          showSidebar ? 'lg:ml-0' : ''
        )}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
