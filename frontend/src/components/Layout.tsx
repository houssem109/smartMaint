'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';
import { useThemeStore } from '@/store/theme-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AdminSidebar from './AdminSidebar';
import TechnicianSidebar from './TechnicianSidebar';
import WorkerSidebar from './WorkerSidebar';
import { Sun, Moon, Bell, Inbox, Menu } from 'lucide-react';
import api from '@/lib/api';
import {
  buildNotificationPreview,
  formatNotificationTime,
  type AppRole,
  type NotificationEntryInput,
} from '@/lib/notification-display';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showSidebar?: boolean; // kept for backwards compatibility, now ignored
}

type NotificationEntry = NotificationEntryInput;

export default function Layout({ children, title }: LayoutProps) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      const mobile = !mq.matches;
      setIsMobile(mobile);
      if (!mobile) setMobileNavOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const sidebarProps = {
    isOpen: isMobile ? true : sidebarOpen,
    onToggle: () => {
      if (isMobile) {
        setMobileNavOpen(false);
      } else {
        setSidebarOpen((open) => !open);
      }
    },
    mobileOpen: mobileNavOpen,
    onNavigate: () => setMobileNavOpen(false),
  };

  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [previewNotifications, setPreviewNotifications] = useState<NotificationEntry[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notificationsOpen]);

  const notificationsViewAllHref =
    user?.role === 'technician'
      ? '/dashboard/technician/notifications'
      : user?.role === 'worker'
        ? '/dashboard/worker/notifications'
        : '/dashboard/admin/history';

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
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {user?.role === 'worker' && <WorkerSidebar {...sidebarProps} />}
      {user?.role === 'technician' && <TechnicianSidebar {...sidebarProps} />}
      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <AdminSidebar {...sidebarProps} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-card border-b border-border">
          <div className="accent-band-top" aria-hidden />
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {title}
            </h1>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {notificationsEnabled && (
              <div className="relative" ref={notificationsRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'relative h-9 w-9 rounded-lg transition-colors',
                    notificationsOpen || hasUnreadNotifications
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90 hover:text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/10 hover:text-accent',
                  )}
                  onClick={handleNotificationsClick}
                  title="Notifications"
                  aria-expanded={notificationsOpen}
                  aria-haspopup="true"
                >
                  <Bell className="h-4 w-4" />
                  {hasUnreadNotifications && !notificationsOpen && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
                  )}
                </Button>

                {notificationsOpen && (
                  <div
                    className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border/80 bg-card shadow-xl ring-1 ring-border/60"
                    role="menu"
                  >
                    <div className="accent-band-top h-1 shrink-0" aria-hidden />
                    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                          <Bell className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold tracking-tight text-foreground">
                          Notifications
                        </span>
                      </div>
                      <Link
                        href={notificationsViewAllHref}
                        className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        View all
                      </Link>
                    </div>
                    <div className="max-h-[min(18rem,50vh)] overflow-y-auto p-2">
                      {previewLoading ? (
                        <div className="space-y-2 px-1 py-2">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="animate-pulse rounded-lg bg-muted/60 px-3 py-3"
                            >
                              <div className="h-3 w-3/4 rounded bg-muted" />
                              <div className="mt-2 h-2 w-1/3 rounded bg-muted" />
                            </div>
                          ))}
                        </div>
                      ) : previewNotifications.length === 0 ? (
                        <div className="flex flex-col items-center px-4 py-8 text-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <Inbox className="h-5 w-5" />
                          </div>
                          <p className="mt-3 text-sm font-medium text-foreground">All caught up</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            No recent activity to show.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-0.5">
                          {previewNotifications.map((n) => {
                            const role = (user?.role ?? 'worker') as AppRole;
                            const item = buildNotificationPreview(n, role);
                            const rowClass =
                              'group block rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/70';

                            const inner = (
                              <>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge
                                    variant={item.actionVariant}
                                    className="text-[10px] font-normal capitalize"
                                  >
                                    {item.actionLabel}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatNotificationTime(n.timestamp)}
                                  </span>
                                </div>
                                <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                                  {item.headline}
                                </p>
                                <p className="mt-0.5 text-sm font-medium text-foreground/90 line-clamp-1">
                                  {item.entityLabel}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                  {item.detail}
                                </p>
                              </>
                            );

                            return (
                              <li key={n.id}>
                                {item.linkable ? (
                                  <Link
                                    href={item.href}
                                    role="menuitem"
                                    className={rowClass}
                                    onClick={() => setNotificationsOpen(false)}
                                  >
                                    {inner}
                                  </Link>
                                ) : (
                                  <div role="menuitem" className={cn(rowClass, 'cursor-default')}>
                                    {inner}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-border">
              <span className="text-sm font-medium text-foreground">
                {user?.fullName || user?.email}
              </span>
              <Badge variant="outline" className="font-normal capitalize text-xs border-accent/40 text-accent">
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
          </div>
        </header>

        <main className="flex-1 bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
