import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "size"> {
  src?: string;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  status?: "online" | "offline" | "away";
}

const sizeStyles: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-[12px]",
  md: "w-10 h-10 text-[14px]",
  lg: "w-12 h-12 text-[16px]",
  xl: "w-16 h-16 text-[20px]",
};

const statusSizeStyles: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "w-2 h-2 border",
  sm: "w-2.5 h-2.5 border-[1.5px]",
  md: "w-3 h-3 border-2",
  lg: "w-3.5 h-3.5 border-2",
  xl: "w-4 h-4 border-2",
};

const statusColors: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-emerald-500",
  offline: "bg-gray-400",
  away: "bg-secondary",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Deterministic color from name string
const bgColors = [
  "bg-primary",
  "bg-secondary",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgColors[Math.abs(hash) % bgColors.length];
}

export function Avatar({
  src,
  alt,
  name = "",
  size = "md",
  shape = "circle",
  status,
  className,
  ...props
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = src && !imgError;
  const initials = getInitials(name || alt || "?");

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt || name}
          onError={() => setImgError(true)}
          className={cn(
            "object-cover",
            sizeStyles[size],
            shape === "circle" ? "rounded-full" : "rounded-lg"
          )}
          {...props}
        />
      ) : (
        <div
          aria-label={alt || name}
          className={cn(
            "flex items-center justify-center font-bold text-white select-none",
            sizeStyles[size],
            shape === "circle" ? "rounded-full" : "rounded-lg",
            hashColor(name || "default")
          )}
        >
          {initials}
        </div>
      )}

      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-surface",
            statusColors[status],
            statusSizeStyles[size]
          )}
          aria-label={
            status === "online"
              ? "Trực tuyến"
              : status === "away"
              ? "Vắng mặt"
              : "Ngoại tuyến"
          }
        />
      )}
    </div>
  );
}
