import React from 'react';
import { AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  variant?: 'danger' | 'warning' | 'info';
  isConfirming?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  onConfirm,
  onClose,
  variant = 'info',
  isConfirming = false,
}) => {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  const icons = {
    danger: <AlertTriangle className="w-10 h-10 text-rose-500 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-2xl" />,
    warning: <AlertCircle className="w-10 h-10 text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-2xl" />,
    info: <HelpCircle className="w-10 h-10 text-sky-500 bg-sky-50 dark:bg-sky-950/30 p-2 rounded-2xl" />,
  };

  const confirmButtonVariants = {
    danger: 'danger' as const,
    warning: 'secondary' as const, // Or warning style if supported, otherwise primary
    info: 'primary' as const,
  };

  return (
    <Modal
      open={open}
      onClose={loading || isConfirming ? () => {} : onClose}
      size="sm"
      showCloseButton={!(loading || isConfirming)}
    >
      <div className="flex flex-col items-center text-center p-2 select-none">
        {icons[variant]}
        <h3 className="mt-4 text-base font-bold text-on-surface leading-tight font-inter">
          {title}
        </h3>
        <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
          {message}
        </p>
        
        <div className="flex items-center justify-center gap-3 w-full mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading || isConfirming}
            className="flex-1 rounded-xl cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading || isConfirming}
            disabled={loading || isConfirming}
            className="flex-1 rounded-xl cursor-pointer"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
