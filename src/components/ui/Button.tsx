import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-on-primary shadow-sm hover:bg-primary/90 active:bg-primary/80 focus-visible:ring-primary/40",
  secondary:
    "bg-secondary text-on-secondary shadow-sm hover:bg-secondary/90 active:bg-secondary/80 focus-visible:ring-secondary/40",
  outline:
    "border border-outline bg-transparent text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest focus-visible:ring-primary/40",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface active:bg-surface-container-highest focus-visible:ring-primary/40",
  danger:
    "bg-error text-on-error shadow-sm hover:bg-error/90 active:bg-error/80 focus-visible:ring-error/40",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-[14px] gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base
          "inline-flex items-center justify-center font-semibold tracking-[0.01em] whitespace-nowrap",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "select-none cursor-pointer",
          // Variant & Size
          variantStyles[variant],
          sizeStyles[size],
          // Full width
          fullWidth && "w-full",
          // Disabled
          isDisabled && "opacity-50 pointer-events-none cursor-not-allowed",
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2
            className={cn(
              "animate-spin",
              size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4"
            )}
          />
        ) : (
          leftIcon && (
            <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{leftIcon}</span>
          )
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
