import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

export interface DropdownItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    if (item.disabled) return;
    if (item.onClick) item.onClick();
    setIsOpen(false);
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-[1000] mt-2 w-48 rounded-2xl bg-white border border-outline-variant/60 shadow-md p-1.5 animate-in fade-in slide-in-from-top-2 duration-150',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="flex flex-col gap-0.5" role="menu" aria-orientation="vertical">
            {items.map((item) => (
              <button
                key={item.key}
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                  item.danger
                    ? 'text-error hover:bg-error/5'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                )}
                role="menuitem"
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
