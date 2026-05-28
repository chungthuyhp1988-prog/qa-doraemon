import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps {
  className?: string;
  variant?: 'rectangle' | 'circle' | 'text';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangle',
}) => {
  return (
    <div
      className={cn(
        "animate-pulse bg-outline-variant/50 dark:bg-slate-800",
        variant === 'circle' && "rounded-full",
        variant === 'text' && "h-4 rounded-md w-full",
        variant === 'rectangle' && "rounded-xl",
        className
      )}
    />
  );
};
