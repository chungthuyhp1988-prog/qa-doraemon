import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  className,
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 border border-dashed border-outline-variant rounded-2xl bg-surface-container-low/30 select-none", className)}>
      <div className="text-on-surface-variant/40 bg-surface-container-high/40 p-4 rounded-full mb-4">
        {icon || <Inbox className="w-10 h-10" />}
      </div>
      <h3 className="text-base font-bold text-on-surface leading-tight font-inter">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-on-surface-variant max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <Button
          variant="primary"
          onClick={onAction}
          className="mt-6 rounded-xl cursor-pointer"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
};
