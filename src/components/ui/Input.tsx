import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  inputSize?: "sm" | "md" | "lg";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      inputSize = "md",
      className,
      id: externalId,
      disabled,
      readOnly,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = externalId || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const sizeStyles = {
      sm: "h-9 text-[13px]",
      md: "h-10 text-[14px]",
      lg: "h-12 text-[15px]",
    };

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-semibold text-on-surface tracking-[0.01em]"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant [&>svg]:w-4 [&>svg]:h-4 pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              // Base
              "w-full rounded-md border bg-surface-container-lowest font-inter",
              "text-on-surface placeholder:text-on-surface-variant/60",
              "transition-all duration-200",
              // Focus
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
              // Size
              sizeStyles[inputSize],
              // Icons padding
              leftIcon ? "pl-10" : "pl-3",
              rightIcon ? "pr-10" : "pr-3",
              // States
              error
                ? "border-error focus:border-error focus:ring-error/20"
                : "border-outline-variant hover:border-outline",
              disabled && "opacity-50 cursor-not-allowed bg-surface-container",
              readOnly && "bg-surface-container cursor-default"
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant [&>svg]:w-4 [&>svg]:h-4">
              {rightIcon}
            </span>
          )}
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

Input.displayName = "Input";
