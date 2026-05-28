import { useState, useMemo, type ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

/* ── Column definition ────────────────────────────── */

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => ReactNode;
}

/* ── Props ────────────────────────────────────────── */

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}

type SortDir = "asc" | "desc" | null;

/* ── Skeleton row ─────────────────────────────────── */

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-outline-variant/30">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-surface-container-high rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

/* ── Table Component ──────────────────────────────── */

export function Table<T>({
  columns,
  data,
  loading = false,
  emptyTitle = "Không có dữ liệu",
  emptyDescription = "Chưa có dữ liệu nào để hiển thị.",
  selectable = false,
  selectedKeys,
  onSelectionChange,
  rowKey = (_r: T, i?: number) => String(i),
  onRowClick,
  className,
}: TableProps<T> & { rowKey?: (row: T, index: number) => string }) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  /* Sort toggle */
  const handleSort = (key: string) => {
    if (sortCol === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortCol(null);
        setSortDir(null);
      }
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
  };

  /* Sorted data (only basic string / number sort if no custom render) */
  const sortedData = useMemo(() => {
    if (!sortCol || !sortDir) return data;
    return [...data].sort((a, b) => {
      const av = (a as any)[sortCol];
      const bv = (b as any)[sortCol];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortCol, sortDir]);

  /* Selection helpers */
  const allSelected = selectable && data.length > 0 && selectedKeys?.size === data.length;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map((r, i) => rowKey(r, i))));
    }
  };

  const toggleRow = (key: string) => {
    if (!onSelectionChange || !selectedKeys) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const alignClass = (a?: string) =>
    a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

  const totalCols = columns.length + (selectable ? 1 : 0);

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-outline-variant/60 bg-surface",
        className
      )}
    >
      <table className="w-full border-collapse min-w-[600px]">
        {/* ── Head ─────────────────────────── */}
        <thead>
          <tr className="bg-surface-container/60">
            {selectable && (
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-outline accent-primary cursor-pointer"
                  aria-label="Chọn tất cả"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "px-4 py-3 text-[12px] font-semibold text-on-surface-variant uppercase tracking-[0.06em]",
                  alignClass(col.align),
                  col.sortable && "cursor-pointer select-none hover:text-on-surface"
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1.5">
                  {col.header}
                  {col.sortable && (
                    <span className="text-on-surface-variant/60">
                      {sortCol === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ─────────────────────────── */}
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={totalCols} />
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={totalCols} className="py-16">
                <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center">
                    <Inbox className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold">{emptyTitle}</p>
                    <p className="text-[13px] mt-0.5">{emptyDescription}</p>
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            sortedData.map((row, i) => {
              const key = rowKey(row, i);
              const isSelected = selectedKeys?.has(key);

              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-outline-variant/30 transition-colors last:border-0",
                    onRowClick && "cursor-pointer",
                    isSelected
                      ? "bg-primary-container/30"
                      : "hover:bg-surface-container/50"
                  )}
                >
                  {selectable && (
                    <td className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-outline accent-primary cursor-pointer"
                        aria-label={`Chọn dòng ${i + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-[14px] text-on-surface",
                        alignClass(col.align)
                      )}
                    >
                      {col.render
                        ? col.render(row, i)
                        : (row as any)[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
