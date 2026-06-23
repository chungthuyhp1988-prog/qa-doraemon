import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  retryText?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Đã xảy ra lỗi',
  description = 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.',
  icon,
  retryText = 'Thử lại',
  onRetry,
  className,
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 border border-dashed border-error/30 rounded-2xl bg-error-container/5 select-none", className)}>
      <div className="text-error/60 bg-error-container/20 p-4 rounded-full mb-4">
        {icon || <AlertTriangle className="w-10 h-10" />}
      </div>
      <h3 className="text-base font-bold text-on-surface leading-tight font-inter">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-on-surface-variant max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-6 rounded-xl cursor-pointer"
        >
          {retryText}
        </Button>
      )}
    </div>
  );
};
