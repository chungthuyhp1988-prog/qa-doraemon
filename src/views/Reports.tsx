import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  Users,
  GraduationCap,
  DollarSign,
  CalendarCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { formatCurrency, getGradeName } from "../lib/formatters";
import { useAppStore } from "../stores/appStore";
import { toast } from "../stores/toastStore";
import { Button, Select, Skeleton, Tabs, Badge } from "../components/ui";
import * as XLSX from "xlsx";

type ReportTab = "students" | "attendance" | "finance";

const MONTHS = [
  { value: "", label: "Cả năm" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `Tháng ${i + 1}`,
  })),
];

const TABS: { value: ReportTab; label: string; icon: typeof Users }[] = [
  { value: "students", label: "Học sinh", icon: Users },
  { value: "attendance", label: "Điểm danh", icon: CalendarCheck },
  { value: "finance", label: "Tài chính", icon: DollarSign },
];

export function Reports() {
  const selectedAcademicYearId = useAppStore((s) => s.selectedAcademicYearId);
  const [tab, setTab] = useState<ReportTab>("students");
  const [month, setMonth] = useState("");

  // ── Student summary ──
  const { data: studentReport, isLoading: loadingStudents } = useQuery({
    queryKey: ["report-students", selectedAcademicYearId],
    queryFn: async () => {
      if (!selectedAcademicYearId) return null;
      const { data, error } = await api.callRpc<any>(
        "report_students_summary",
        { p_academic_year_id: selectedAcademicYearId }
      );
      if (error) throw new Error(error);
      return data as {
        by_grade: { grade_level: string; total: number; active: number; male: number; female: number }[];
        by_class: { class_id: string; class_name: string; grade_level: string; teacher_name: string; total: number; active: number }[];
        total_active: number;
      };
    },
    enabled: tab === "students" && !!selectedAcademicYearId,
  });

  // ── Attendance report ──
  const { data: attendanceReport, isLoading: loadingAttendance } = useQuery({
    queryKey: ["report-attendance", selectedAcademicYearId, month],
    queryFn: async () => {
      if (!selectedAcademicYearId) return null;
      const { data, error } = await api.callRpc<any>(
        "report_attendance",
        {
          p_academic_year_id: selectedAcademicYearId,
          p_month: month ? parseInt(month) : null,
          p_class_id: null,
        }
      );
      if (error) throw new Error(error);
      return data as {
        class_id: string;
        class_name: string;
        grade_level: string;
        total_students: number;
        present_count: number;
        excused_count: number;
        unexcused_count: number;
        total_records: number;
        attendance_rate: number;
      }[];
    },
    enabled: tab === "attendance" && !!selectedAcademicYearId,
  });

  // ── Finance report ──
  const { data: financeReport, isLoading: loadingFinance } = useQuery({
    queryKey: ["report-finance", selectedAcademicYearId, month],
    queryFn: async () => {
      if (!selectedAcademicYearId) return null;
      const { data, error } = await api.callRpc<any>("report_finance", {
        p_academic_year_id: selectedAcademicYearId,
        p_month: month ? parseInt(month) : null,
        p_class_id: null,
      });
      if (error) throw new Error(error);
      return data as {
        class_id: string;
        class_name: string;
        grade_level: string;
        total_students: number;
        total_expected: number;
        total_paid: number;
        total_remaining: number;
        paid_count: number;
        unpaid_count: number;
        overdue_count: number;
        partial_count: number;
        collection_rate: number;
      }[];
    },
    enabled: tab === "finance" && !!selectedAcademicYearId,
  });

  // ── Export Excel ──
  function exportExcel() {
    let sheetData: Record<string, unknown>[] = [];
    let sheetName = "";

    if (tab === "students" && studentReport?.by_class) {
      sheetName = "Hoc_sinh";
      sheetData = studentReport.by_class.map((c) => ({
        "Lớp": c.class_name,
        "Khối": getGradeName(c.grade_level),
        "GV chủ nhiệm": c.teacher_name || "",
        "Tổng HS": c.total,
        "Đang học": c.active,
      }));
    } else if (tab === "attendance" && attendanceReport) {
      sheetName = "Diem_danh";
      sheetData = attendanceReport.map((r) => ({
        "Lớp": r.class_name,
        "Khối": getGradeName(r.grade_level),
        "Tổng HS": r.total_students,
        "Có mặt": r.present_count,
        "Vắng CP": r.excused_count,
        "Vắng KP": r.unexcused_count,
        "Tỷ lệ (%)": r.attendance_rate ?? 0,
      }));
    } else if (tab === "finance" && financeReport) {
      sheetName = "Tai_chinh";
      sheetData = financeReport.map((r) => ({
        "Lớp": r.class_name,
        "Khối": getGradeName(r.grade_level),
        "Tổng HS": r.total_students,
        "Dự kiến thu": r.total_expected,
        "Đã thu": r.total_paid,
        "Còn thiếu": r.total_remaining,
        "Đã đóng": r.paid_count,
        "Chưa đóng": r.unpaid_count,
        "Quá hạn": r.overdue_count,
        "Tỷ lệ thu (%)": r.collection_rate ?? 0,
      }));
    }

    if (sheetData.length === 0) {
      toast.warning("Không có dữ liệu để xuất");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Bao_cao_${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Đã xuất file Excel");
  }

  const isLoading =
    (tab === "students" && loadingStudents) ||
    (tab === "attendance" && loadingAttendance) ||
    (tab === "finance" && loadingFinance);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-playfair text-on-surface">
              Báo cáo & Thống kê
            </h1>
            <p className="text-sm text-on-surface-variant">
              Báo cáo tổng hợp theo lớp, khối, năm học
            </p>
          </div>
        </div>
        <Button onClick={exportExcel} leftIcon={<Download className="w-4 h-4" />}>
          Xuất Excel
        </Button>
      </div>

      {/* Tabs + Month filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <Tabs
          tabs={TABS.map((t) => ({ id: t.value, label: t.label }))}
          activeTab={tab}
          onChange={(v) => setTab(v as ReportTab)}
        />
        {tab !== "students" && (
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            options={MONTHS}
          />
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Students tab */}
          {tab === "students" && studentReport && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
                  <p className="text-sm text-on-surface-variant">Tổng HS đang học</p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {studentReport.total_active}
                  </p>
                </div>
                {studentReport.by_grade?.map((g) => (
                  <div
                    key={g.grade_level}
                    className="p-4 bg-surface rounded-xl border border-outline-variant/40"
                  >
                    <p className="text-sm text-on-surface-variant">
                      {getGradeName(g.grade_level)}
                    </p>
                    <p className="text-2xl font-bold text-on-surface mt-1">
                      {g.active}
                      <span className="text-sm font-normal text-on-surface-variant ml-1">
                        / {g.total}
                      </span>
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      Nam: {g.male} — Nữ: {g.female}
                    </p>
                  </div>
                ))}
              </div>

              {/* Class table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Lớp</th>
                      <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Khối</th>
                      <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">GV chủ nhiệm</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Tổng HS</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Đang học</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentReport.by_class?.map((c) => (
                      <tr
                        key={c.class_id}
                        className="border-b border-outline-variant/20 hover:bg-surface-container-low"
                      >
                        <td className="py-3 px-4 font-medium text-on-surface">{c.class_name}</td>
                        <td className="py-3 px-4 text-on-surface-variant">{getGradeName(c.grade_level)}</td>
                        <td className="py-3 px-4 text-on-surface-variant">{c.teacher_name || "—"}</td>
                        <td className="py-3 px-4 text-right text-on-surface">{c.total}</td>
                        <td className="py-3 px-4 text-right text-primary font-medium">{c.active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Attendance tab */}
          {tab === "attendance" && attendanceReport && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-outline-variant/40">
                    <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Lớp</th>
                    <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Khối</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Tổng HS</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Có mặt</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Vắng CP</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Vắng KP</th>
                    <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Tỷ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceReport.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                        Chưa có dữ liệu điểm danh
                      </td>
                    </tr>
                  ) : (
                    attendanceReport.map((r) => (
                      <tr
                        key={r.class_id}
                        className="border-b border-outline-variant/20 hover:bg-surface-container-low"
                      >
                        <td className="py-3 px-4 font-medium text-on-surface">{r.class_name}</td>
                        <td className="py-3 px-4 text-on-surface-variant">{getGradeName(r.grade_level)}</td>
                        <td className="py-3 px-4 text-right text-on-surface">{r.total_students}</td>
                        <td className="py-3 px-4 text-right text-green-600">{r.present_count}</td>
                        <td className="py-3 px-4 text-right text-yellow-600">{r.excused_count}</td>
                        <td className="py-3 px-4 text-right text-red-600">{r.unexcused_count}</td>
                        <td className="py-3 px-4 text-right">
                          <Badge
                            variant={
                              r.attendance_rate >= 90
                                ? "success"
                                : r.attendance_rate >= 70
                                ? "warning"
                                : "error"
                            }
                          >
                            {r.attendance_rate ?? 0}%
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Finance tab */}
          {tab === "finance" && financeReport && (
            <div className="space-y-4">
              {/* Summary */}
              {financeReport.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
                    <p className="text-sm text-on-surface-variant">Dự kiến thu</p>
                    <p className="text-lg font-bold text-on-surface mt-1">
                      {formatCurrency(
                        financeReport.reduce((s, r) => s + (r.total_expected || 0), 0)
                      )}
                    </p>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
                    <p className="text-sm text-on-surface-variant">Đã thu</p>
                    <p className="text-lg font-bold text-green-600 mt-1">
                      {formatCurrency(
                        financeReport.reduce((s, r) => s + (r.total_paid || 0), 0)
                      )}
                    </p>
                  </div>
                  <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
                    <p className="text-sm text-on-surface-variant">Còn thiếu</p>
                    <p className="text-lg font-bold text-red-600 mt-1">
                      {formatCurrency(
                        financeReport.reduce((s, r) => s + (r.total_remaining || 0), 0)
                      )}
                    </p>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-outline-variant/40">
                      <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Lớp</th>
                      <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Khối</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Dự kiến</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Đã thu</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Còn thiếu</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Quá hạn</th>
                      <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financeReport.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                          Chưa có dữ liệu tài chính
                        </td>
                      </tr>
                    ) : (
                      financeReport.map((r) => (
                        <tr
                          key={r.class_id}
                          className="border-b border-outline-variant/20 hover:bg-surface-container-low"
                        >
                          <td className="py-3 px-4 font-medium text-on-surface">{r.class_name}</td>
                          <td className="py-3 px-4 text-on-surface-variant">{getGradeName(r.grade_level)}</td>
                          <td className="py-3 px-4 text-right text-on-surface">{formatCurrency(r.total_expected)}</td>
                          <td className="py-3 px-4 text-right text-green-600">{formatCurrency(r.total_paid)}</td>
                          <td className="py-3 px-4 text-right text-red-600">{formatCurrency(r.total_remaining)}</td>
                          <td className="py-3 px-4 text-right">
                            {r.overdue_count > 0 && (
                              <Badge variant="error">{r.overdue_count}</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge
                              variant={
                                r.collection_rate >= 90
                                  ? "success"
                                  : r.collection_rate >= 70
                                  ? "warning"
                                  : "error"
                              }
                            >
                              {r.collection_rate ?? 0}%
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
