import { cn } from '@/lib/utils';

type SmartMaintWordmarkProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Use fixed login-page colors instead of theme tokens */
  variant?: 'theme' | 'login';
};

const sizeClass: Record<NonNullable<SmartMaintWordmarkProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-xl font-semibold',
  lg: 'text-2xl font-semibold tracking-tight',
};

export default function SmartMaintWordmark({
  className,
  size = 'md',
  variant = 'theme',
}: SmartMaintWordmarkProps) {
  const smartClass =
    variant === 'login' ? 'text-[#0f172a]' : 'text-foreground';
  const maintClass =
    variant === 'login' ? 'text-[#1E40AF]' : 'text-primary';

  return (
    <span
      className={cn('inline-flex items-baseline font-sans tracking-tight', sizeClass[size], className)}
      aria-label="SmartMaint"
    >
      <span className={cn('font-semibold', smartClass)}>Smart</span>
      <span className={cn('font-semibold', maintClass)}>Maint</span>
    </span>
  );
}
