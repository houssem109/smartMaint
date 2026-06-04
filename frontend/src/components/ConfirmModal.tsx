'use client';

import { AccentBand } from '@/components/ui/accent-band';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmClass =
    type === 'danger'
      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
      : type === 'warning'
        ? 'bg-amber-600 text-white hover:bg-amber-700'
        : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-md overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <AccentBand />
        <div className="p-6">
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cn('rounded-lg px-4 py-2 text-sm font-medium', confirmClass)}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
