import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, ToastItem } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

export const Toast: React.FC<ToastItem> = ({ id, message, type, description }) => {
  const removeToast = useToastStore((state) => state.removeToast);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-500/30',
    error: 'border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-500/30',
    warning: 'border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/30',
    info: 'border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-500/30',
  };

  return (
    <div
      className={cn(
        "flex gap-3 w-full max-w-sm p-4 border rounded-2xl shadow-lg backdrop-blur-md",
        "animate-slide-up transition-all duration-300",
        borderColors[type]
      )}
      role="alert"
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-on-surface select-none">
          {message}
        </h4>
        {description && (
          <p className="mt-1 text-xs text-on-surface-variant leading-relaxed select-none">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => removeToast(id)}
        className="text-on-surface-variant hover:text-on-surface transition-colors rounded-lg p-0.5 self-start hover:bg-surface-container cursor-pointer"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} />
        </div>
      ))}
    </div>
  );
};
