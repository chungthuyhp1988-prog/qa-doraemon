import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

/* ── Card Root ─────────────────────────────────────── */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
}

const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 md:p-6",
  lg: "p-6 md:p-8",
};

export function Card({
  padding = "md",
  hoverable = false,
  onClick,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as any);
              }
            }
          : undefined
      }
      className={cn(
        "rounded-2xl bg-surface border border-outline-variant/60",
        "transition-all duration-200",
        paddingStyles[padding],
        hoverable &&
          "hover:shadow-md hover:border-outline-variant hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── Card Header ───────────────────────────────────── */

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 mb-4",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <h3 className="text-[16px] font-bold font-playfair text-on-surface leading-snug truncate">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-[13px] text-on-surface-variant mt-0.5 truncate">
            {subtitle}
          </p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Card Body ─────────────────────────────────────── */

export function CardBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-[14px] text-on-surface", className)} {...props}>
      {children}
    </div>
  );
}

/* ── Card Footer ───────────────────────────────────── */

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 mt-4 pt-4 border-t border-outline-variant/40",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
