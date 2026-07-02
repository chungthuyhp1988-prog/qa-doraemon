import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, checked, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 select-none">
        <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-on-surface">
          <div className="relative">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={checked}
              ref={ref}
              {...props}
            />
            <div
              className={cn(
                'w-5 h-5 rounded-lg border border-outline-variant bg-white transition-all flex items-center justify-center',
                'peer-focus-visible:ring-3 peer-focus-visible:ring-primary/12 peer-focus-visible:border-primary',
                'peer-checked:bg-primary peer-checked:border-primary',
                'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
                className
              )}
            >
              <Check
                className={cn(
                  'w-3.5 h-3.5 text-white scale-0 transition-transform duration-200 stroke-[3]',
                  checked && 'scale-100'
                )}
              />
            </div>
          </div>
          {label && <span>{label}</span>}
        </label>
        {error && <span className="text-xs text-error font-medium">{error}</span>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
