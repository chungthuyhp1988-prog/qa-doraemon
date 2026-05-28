import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-secondary-container text-on-secondary-container border-secondary-container",
  error: "bg-error-container text-on-error-container border-error-container",
  info: "bg-primary-container text-on-primary-container border-primary-container",
  neutral: "bg-surface-container-high text-on-surface-variant border-outline-variant",
};

const dotColors: Record<NonNullable<BadgeProps["variant"]>, string> = {
  success: "bg-emerald-500",
  warning: "bg-secondary",
  error: "bg-error",
  info: "bg-primary",
  neutral: "bg-on-surface-variant",
};

const sizeStyles: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-[12px] px-2.5 py-1 gap-1.5",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border whitespace-nowrap",
        "tracking-[0.02em] leading-none select-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "rounded-full shrink-0",
            size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}
