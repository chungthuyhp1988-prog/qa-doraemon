import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate range of page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);
      
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-1 select-none", className)}>
      <div className="flex items-center gap-4 text-sm text-on-surface-variant font-medium">
        <span>
          Hiển thị <strong>{totalItems === 0 ? 0 : startItem}</strong> - <strong>{endItem}</strong> trong số <strong>{totalItems}</strong> dòng
        </span>
        
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Số dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-surface-container border border-outline-variant/60 rounded-lg text-xs font-semibold px-2 py-1 focus:outline-none focus:border-primary"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* First Page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 rounded-lg cursor-pointer"
          aria-label="Trang đầu"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>

        {/* Prev Page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0 rounded-lg cursor-pointer"
          aria-label="Trang trước"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Page Numbers */}
        {getPageNumbers().map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => handlePageChange(page)}
            className={cn(
              "h-8 w-8 p-0 rounded-lg cursor-pointer text-xs font-bold",
              page === currentPage 
                ? "bg-primary text-on-primary shadow-sm" 
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            )}
          >
            {page}
          </Button>
        ))}

        {/* Next Page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 rounded-lg cursor-pointer"
          aria-label="Trang sau"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0 rounded-lg cursor-pointer"
          aria-label="Trang cuối"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
