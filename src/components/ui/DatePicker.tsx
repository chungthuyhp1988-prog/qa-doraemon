import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export interface DatePickerProps {
  mode?: 'single' | 'range' | 'month';
  value: any; // Date | { start: Date; end: Date } | string (YYYY-MM-DD or YYYY-MM)
  onChange: (value: any) => void;
  label?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  minDate?: string;
  maxDate?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  mode = 'single',
  value,
  onChange,
  label,
  error,
  helperText,
  disabled = false,
  className,
  minDate,
  maxDate,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const handleIconClick = () => {
    if (disabled) return;
    if (mode === 'range') {
      startRef.current?.showPicker();
    } else {
      inputRef.current?.showPicker();
    }
  };

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val ? new Date(val) : null);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // "YYYY-MM"
    onChange(val || null);
  };

  const handleRangeChange = (type: 'start' | 'end', val: string) => {
    const currentRange = value || { start: null, end: null };
    const dateVal = val ? new Date(val) : null;
    
    if (type === 'start') {
      onChange({ ...currentRange, start: dateVal });
    } else {
      onChange({ ...currentRange, end: dateVal });
    }
  };

  // Convert Date object to YYYY-MM-DD string for native inputs
  const formatDateString = (date: any): string => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  };

  const formatMonthString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val; // Already "YYYY-MM"
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <div className={cn("flex flex-col gap-1.5 select-none", className)}>
      {label && (
        <span className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
          {label}
        </span>
      )}

      {mode === 'range' ? (
        <div className="flex items-center gap-2">
          {/* Start Date */}
          <div className="relative flex-1">
            <input
              type="date"
              ref={startRef}
              disabled={disabled}
              min={minDate}
              max={maxDate}
              value={formatDateString(value?.start)}
              onChange={(e) => handleRangeChange('start', e.target.value)}
              className={cn(
                "w-full rounded-xl border bg-surface-container-lowest font-inter text-sm h-10 px-3 pl-10 text-on-surface",
                "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
                error ? "border-error" : "border-outline-variant hover:border-outline",
                disabled && "opacity-50 cursor-not-allowed bg-surface-container"
              )}
            />
            <span 
              onClick={handleIconClick}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
            </span>
          </div>

          <span className="text-xs text-on-surface-variant font-medium">đến</span>

          {/* End Date */}
          <div className="relative flex-1">
            <input
              type="date"
              ref={endRef}
              disabled={disabled}
              min={minDate ? minDate : (value?.start ? formatDateString(value.start) : undefined)}
              max={maxDate}
              value={formatDateString(value?.end)}
              onChange={(e) => handleRangeChange('end', e.target.value)}
              className={cn(
                "w-full rounded-xl border bg-surface-container-lowest font-inter text-sm h-10 px-3 pl-10 text-on-surface",
                "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
                error ? "border-error" : "border-outline-variant hover:border-outline",
                disabled && "opacity-50 cursor-not-allowed bg-surface-container"
              )}
            />
            <span 
              onClick={() => !disabled && endRef.current?.showPicker()}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
            </span>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            type={mode === 'month' ? 'month' : 'date'}
            ref={inputRef}
            disabled={disabled}
            min={minDate}
            max={maxDate}
            value={mode === 'month' ? formatMonthString(value) : formatDateString(value)}
            onChange={mode === 'month' ? handleMonthChange : handleSingleChange}
            className={cn(
              "w-full rounded-xl border bg-surface-container-lowest font-inter text-sm h-10 px-3 pl-10 text-on-surface",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all",
              error ? "border-error" : "border-outline-variant hover:border-outline",
              disabled && "opacity-50 cursor-not-allowed bg-surface-container"
            )}
          />
          <span 
            onClick={handleIconClick}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
          </span>
        </div>
      )}

      {error && (
        <p className="text-[12px] text-error font-medium" role="alert">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p className="text-[12px] text-on-surface-variant">
          {helperText}
        </p>
      )}
    </div>
  );
};
