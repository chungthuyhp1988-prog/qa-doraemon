import { forwardRef, type TextareaHTMLAttributes, useId, useState } from "react";
import { cn } from "../../lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showCharacterCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      showCharacterCount = false,
      className,
      id: externalId,
      disabled,
      readOnly,
      maxLength,
      onChange,
      value,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = externalId || generatedId;
    const helperId = `${textareaId}-helper`;
    const errorId = `${textareaId}-error`;

    const [charCount, setCharCount] = useState(
      String(value || defaultValue || '').length
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex justify-between items-baseline select-none">
          {label && (
            <label
              htmlFor={textareaId}
              className="text-[13px] font-semibold text-on-surface tracking-[0.01em]"
            >
              {label}
            </label>
          )}
          {showCharacterCount && maxLength && (
            <span className="text-[11px] text-on-surface-variant font-medium ml-auto">
              {charCount}/{maxLength}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          className={cn(
            // Base
            "w-full rounded-xl border bg-surface-container-lowest font-inter p-3 text-sm min-h-[100px] resize-y",
            "text-on-surface placeholder:text-on-surface-variant/60",
            "transition-all duration-200",
            // Focus
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            // States
            error
              ? "border-error focus:border-error focus:ring-error/20"
              : "border-outline-variant hover:border-outline",
            disabled && "opacity-50 cursor-not-allowed bg-surface-container",
            readOnly && "bg-surface-container cursor-default"
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea";
