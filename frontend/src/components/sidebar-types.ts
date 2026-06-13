export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export function sidebarShellClassName(
  isOpen: boolean,
  mobileOpen?: boolean,
): string {
  const mobileVisible = mobileOpen ? 'translate-x-0' : '-translate-x-full';
  const desktopWidth = isOpen ? 'md:w-56' : 'md:w-[4.25rem]';

  return [
    'flex h-screen flex-col border-r border-border bg-card shrink-0',
    'transition-[transform,width] duration-300 ease-in-out',
    'fixed inset-y-0 left-0 z-50 w-56 md:relative md:z-auto md:sticky md:top-0',
    mobileVisible,
    'md:translate-x-0',
    desktopWidth,
  ].join(' ');
}
