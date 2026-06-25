import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Filter,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  Database,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/formatters";
import { Button, Badge, Select, Skeleton, Pagination } from "../components/ui";

const TABLE_OPTIONS = [
  { value: "", label: "Tất cả bảng" },
  { value: "students", label: "Học sinh" },
  { value: "users", label: "Người dùng" },
  { value: "tuition_fees", label: "Học phí" },
  { value: "classes", label: "Lớp học" },
  { value: "attendance", label: "Điểm danh" },
];

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: "Thêm mới",
  UPDATE: "Cập nhật",
  DELETE: "Xoá",
};

const TABLE_LABELS: Record<string, string> = {
  students: "Học sinh",
  users: "Người dùng",
  tuition_fees: "Học phí",
  classes: "Lớp học",
  attendance: "Điểm danh",
};

interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

const PAGE_SIZE = 20;

export function AuditLog() {
  const [filterTable, setFilterTable] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", filterTable, page],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_audit_log", {
        p_table_name: filterTable || null,
        p_user_id: null,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
      });
      if (error) throw error;
      return data as { data: AuditEntry[]; total: number };
    },
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-playfair text-on-surface">
              Nhật ký hoạt động
            </h1>
            <p className="text-sm text-on-surface-variant">
              Theo dõi tất cả thao tác thêm, sửa, xoá trong hệ thống
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant/40">
        <Filter className="w-4 h-4 text-on-surface-variant" />
        <Select
          value={filterTable}
          onChange={(e) => {
            setFilterTable(e.target.value);
            setPage(1);
          }}
          options={TABLE_OPTIONS}
        />
        <span className="text-sm text-on-surface-variant ml-auto">
          {total} bản ghi
        </span>
      </div>

      {/* Log entries */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-4 bg-surface rounded-xl border border-outline-variant/40"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-16 h-6 rounded-full" />
                <Skeleton className="w-20 h-5 rounded" />
                <Skeleton className="w-32 h-5 rounded flex-1" />
                <Skeleton className="w-40 h-4 rounded" />
              </div>
            </div>
          ))
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Chưa có bản ghi nào</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-surface rounded-xl border border-outline-variant/40 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-container-low transition-colors"
              >
                {expandedId === entry.id ? (
                  <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0" />
                )}

                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                    ACTION_COLORS[entry.action] || "bg-gray-100 text-gray-700"
                  )}
                >
                  {ACTION_LABELS[entry.action] || entry.action}
                </span>

                <Badge variant="neutral" className="shrink-0">
                  {TABLE_LABELS[entry.table_name] || entry.table_name}
                </Badge>

                <span className="text-sm text-on-surface truncate flex-1">
                  {entry.record_id?.slice(0, 8)}...
                </span>

                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant shrink-0">
                  <User className="w-3 h-3" />
                  {entry.user_name || entry.user_email || "Hệ thống"}
                </span>

                <span className="flex items-center gap-1.5 text-xs text-on-surface-variant shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatDate(entry.created_at, {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </button>

              {expandedId === entry.id && (
                <div className="px-4 pb-4 border-t border-outline-variant/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {entry.old_data && (
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant mb-1">
                          Dữ liệu cũ
                        </p>
                        <pre className="text-xs bg-surface-container-high p-3 rounded-lg overflow-x-auto max-h-48 text-on-surface">
                          {JSON.stringify(entry.old_data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {entry.new_data && (
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant mb-1">
                          Dữ liệu mới
                        </p>
                        <pre className="text-xs bg-surface-container-high p-3 rounded-lg overflow-x-auto max-h-48 text-on-surface">
                          {JSON.stringify(entry.new_data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalItems={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
