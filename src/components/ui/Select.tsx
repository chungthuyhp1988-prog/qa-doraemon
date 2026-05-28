import { forwardRef, type SelectHTMLAttributes, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  selectSize?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "h-9 text-[13px] pl-3 pr-8",
  md: "h-10 text-[14px] pl-3 pr-9",
  lg: "h-12 text-[15px] pl-4 pr-10",
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      placeholder,
      error,
      helperText,
      options,
      selectSize = "md",
      className,
      id: externalId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = externalId || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-[13px] font-semibold text-on-surface tracking-[0.01em]"
          >
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              "w-full rounded-md border bg-surface-container-lowest font-inter",
              "text-on-surface appearance-none cursor-pointer",
              "transition-all duration-200",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              sizeStyles[selectSize],
              error
                ? "border-error focus:border-error focus:ring-error/20"
                : "border-outline-variant hover:border-outline",
              disabled && "opacity-50 cursor-not-allowed bg-surface-container"
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
        </div>

        {error && (
          <p id={errorId} className="text-[12px] text-error font-medium" role="alert">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-[12px] text-on-surface-variant">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
