'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AdminSidebar from './AdminSidebar';
import TechnicianSidebar from './TechnicianSidebar';
import WorkerSidebar from './WorkerSidebar';
import { Sun, Moon, Bell } from 'lucide-react';
import api from '@/lib/api';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showSidebar?: boolean; // kept for backwards compatibility, now ignored
}

interface NotificationEntry {
  id: string;
  actionType: string;
  entityId: string;
  timestamp: string;
  ticketTitle?: string;
  changes?: Record<string, any> | null;
  entityType?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [previewNotifications, setPreviewNotifications] = useState<NotificationEntry[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const notificationsEnabled =
    user?.role === 'technician' ||
    user?.role === 'worker' ||
    user?.role === 'admin' ||
    user?.role === 'superadmin';

  const storageKey = useMemo(() => {
    if (!user?.id) return null;
    return `notifications_last_seen_${user.role}_${user.id}`;
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!notificationsEnabled || !storageKey) return;

    const checkNotifications = async () => {
      try {
        const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
        const endpoint = isAdminRole ? '/tickets/history' : '/tickets/notifications';

        const res = await api.get<{ timestamp: string }[]>(endpoint, {
          params: { limit: 1 },
        });
        const latest = res.data[0];
        if (!latest) {
          setHasUnreadNotifications(false);
          return;
        }
        const lastSeenRaw = localStorage.getItem(storageKey);
        if (!lastSeenRaw) {
          setHasUnreadNotifications(true);
          return;
        }
        const lastSeen = new Date(lastSeenRaw).getTime();
        const latestTime = new Date(latest.timestamp).getTime();
        setHasUnreadNotifications(latestTime > lastSeen);
      } catch {
        // ignore errors, don't break layout
      }
    };

    checkNotifications();
    const id = setInterval(checkNotifications, 30000);
    return () => clearInterval(id);
  }, [notificationsEnabled, storageKey, user?.role]);

  const loadPreviewNotifications = async () => {
    if (!notificationsEnabled) return;
    setPreviewLoading(true);
    try {
      const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
      const endpoint = isAdminRole ? '/tickets/history' : '/tickets/notifications';

      const res = await api.get<NotificationEntry[]>(endpoint, {
        params: { limit: 5 },
      });
      setPreviewNotifications(res.data);
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleNotificationsClick = () => {
    const nextOpen = !notificationsOpen;
    setNotificationsOpen(nextOpen);

    if (nextOpen) {
      if (storageKey) {
        localStorage.setItem(storageKey, new Date().toISOString());
      }
      setHasUnreadNotifications(false);
      loadPreviewNotifications();
    }
  };

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
            {notificationsEnabled && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9"
                  onClick={handleNotificationsClick}
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {hasUnreadNotifications && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  )}
                </Button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-md border border-border/60 bg-popover shadow-lg z-40">
                    <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Notifications
                      </span>
                      <a
                        href={
                          user?.role === 'technician'
                            ? '/dashboard/technician/notifications'
                            : user?.role === 'worker'
                            ? '/dashboard/worker/notifications'
                            : '/dashboard/admin/history'
                        }
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        View all
                      </a>
                    </div>
                    <div className="max-h-80 overflow-y-auto py-1">
                      {previewLoading ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground">
                          Loading notifications...
                        </div>
                      ) : previewNotifications.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground">
                          No recent notifications.
                        </div>
                      ) : (
                        previewNotifications.map((n) => {
                          const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
                          const isUserEntity = n.entityType === 'user' && isAdminRole;

                          let title = n.ticketTitle;
                          if (!title && n.changes) {
                            const changes = n.changes as any;
                            if (changes.deletedSnapshot?.ticket?.title) {
                              title = changes.deletedSnapshot.ticket.title;
                            } else if (changes.title && typeof changes.title === 'object') {
                              if ('to' in changes.title) {
                                title = String(changes.title.to);
                              } else if ('from' in changes.title) {
                                title = String(changes.title.from);
                              }
                            }
                          }
                          const displayTitle =
                            isUserEntity
                              ? 'User updated'
                              : title || `Ticket ${n.entityId.slice(0, 8)}…`;

                          return (
                            <a
                              key={n.id}
                              href={
                                isUserEntity
                                  ? '/dashboard/admin/users'
                                  : `/dashboard/tickets/${n.entityId}`
                              }
                              className="block px-3 py-2 text-xs hover:bg-accent/60"
                              onClick={() => setNotificationsOpen(false)}
                            >
                              <div className="font-medium text-foreground line-clamp-1">
                                {displayTitle}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(n.timestamp).toLocaleString()}
                              </div>
                            </a>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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
