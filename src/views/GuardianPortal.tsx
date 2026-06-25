import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  CalendarCheck,
  DollarSign,
  Heart,
  Star,
  UtensilsCrossed,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { formatDate, formatCurrency, getStatusLabel, getGradeName } from "../lib/formatters";
import { Badge, Skeleton, Tabs } from "../components/ui";
import { Avatar } from "../components/ui/Avatar";

type GuardianTab = "overview" | "attendance" | "fees" | "health";

export function GuardianPortal() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<GuardianTab>("overview");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Get guardian's students
  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ["guardian-students", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("guardians")
        .select("student_id, relationship, students(id, full_name, student_code, date_of_birth, gender, status, avatar_url)")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g.students,
        relationship: g.relationship,
      }));
    },
    enabled: !!user?.id,
  });

  const activeStudent = selectedStudentId || students?.[0]?.id;

  // Attendance for selected student (last 30 days)
  const { data: attendance, isLoading: loadingAttendance } = useQuery({
    queryKey: ["guardian-attendance", activeStudent],
    queryFn: async () => {
      if (!activeStudent) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("attendance")
        .select("id, date, status, note")
        .eq("student_id", activeStudent)
        .gte("date", thirtyDaysAgo.toISOString().slice(0, 10))
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeStudent && (tab === "overview" || tab === "attendance"),
  });

  // Fees for selected student
  const { data: fees, isLoading: loadingFees } = useQuery({
    queryKey: ["guardian-fees", activeStudent],
    queryFn: async () => {
      if (!activeStudent) return [];
      const { data, error } = await supabase
        .from("tuition_fees")
        .select("id, month, year, total_amount, paid_amount, status, due_date, paid_date")
        .eq("student_id", activeStudent)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeStudent && (tab === "overview" || tab === "fees"),
  });

  // Health records for selected student
  const { data: healthRecords, isLoading: loadingHealth } = useQuery({
    queryKey: ["guardian-health", activeStudent],
    queryFn: async () => {
      if (!activeStudent) return [];
      const { data, error } = await supabase
        .from("health_records")
        .select("id, check_date, height_cm, weight_kg, health_status, notes")
        .eq("student_id", activeStudent)
        .order("check_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeStudent && (tab === "overview" || tab === "health"),
  });

  const currentStudent = students?.find((s: any) => s.id === activeStudent);

  const attendanceStats = attendance
    ? {
        present: attendance.filter((a: any) => a.status === "present").length,
        excused: attendance.filter((a: any) => a.status === "absent_excused").length,
        unexcused: attendance.filter((a: any) => a.status === "absent_unexcused").length,
        total: attendance.length,
      }
    : null;

  const feeStats = fees
    ? {
        totalDue: fees.reduce((s: number, f: any) => s + (f.total_amount || 0), 0),
        totalPaid: fees.reduce((s: number, f: any) => s + (f.paid_amount || 0), 0),
        overdue: fees.filter((f: any) => f.status === "overdue").length,
      }
    : null;

  if (loadingStudents) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Baby className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-playfair text-on-surface">
            Cổng Phụ huynh
          </h1>
          <p className="text-sm text-on-surface-variant">
            Xin chào, {user?.full_name || user?.email}
          </p>
        </div>
      </div>

      {/* Student selector (if multiple children) */}
      {students && students.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {students.map((s: any) => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentId(s.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all shrink-0",
                activeStudent === s.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-outline-variant/40 bg-surface hover:bg-surface-container-low"
              )}
            >
              <Avatar name={s.full_name} src={s.avatar_url} size="sm" />
              <div className="text-left">
                <p className="text-sm font-medium text-on-surface">{s.full_name}</p>
                <p className="text-xs text-on-surface-variant">{s.student_code}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Student info card */}
      {currentStudent && (
        <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-outline-variant/40">
          <Avatar name={currentStudent.full_name} src={currentStudent.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-on-surface">{currentStudent.full_name}</h2>
            <p className="text-sm text-on-surface-variant">
              Mã HS: {currentStudent.student_code} — Ngày sinh:{" "}
              {formatDate(currentStudent.date_of_birth)}
            </p>
          </div>
          <Badge variant={currentStudent.status === "active" ? "success" : "warning"}>
            {getStatusLabel(currentStudent.status)}
          </Badge>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: "overview", label: "Tổng quan" },
          { id: "attendance", label: "Điểm danh" },
          { id: "fees", label: "Học phí" },
          { id: "health", label: "Sức khoẻ" },
        ]}
        activeTab={tab}
        onChange={(v) => setTab(v as GuardianTab)}
      />

      {/* Overview tab */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Attendance summary */}
          <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-on-surface-variant">Điểm danh 30 ngày</span>
            </div>
            {loadingAttendance ? (
              <Skeleton className="h-8 w-20 rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold text-on-surface">
                  {attendanceStats?.present ?? 0}
                  <span className="text-sm font-normal text-on-surface-variant">
                    /{attendanceStats?.total ?? 0} ngày
                  </span>
                </p>
                {(attendanceStats?.unexcused ?? 0) > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {attendanceStats?.unexcused} ngày vắng không phép
                  </p>
                )}
              </>
            )}
          </div>

          {/* Fee summary */}
          <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-on-surface-variant">Học phí</span>
            </div>
            {loadingFees ? (
              <Skeleton className="h-8 w-32 rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold text-on-surface">
                  {formatCurrency(feeStats?.totalPaid ?? 0)}
                </p>
                {(feeStats?.overdue ?? 0) > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    {feeStats?.overdue} khoản quá hạn
                  </p>
                )}
              </>
            )}
          </div>

          {/* Health summary */}
          <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-pink-600" />
              <span className="text-sm font-medium text-on-surface-variant">Sức khoẻ</span>
            </div>
            {loadingHealth ? (
              <Skeleton className="h-8 w-20 rounded" />
            ) : healthRecords && healthRecords.length > 0 ? (
              <>
                <p className="text-lg font-bold text-on-surface">
                  {(healthRecords[0] as any).height_cm}cm / {(healthRecords[0] as any).weight_kg}kg
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  Khám: {formatDate((healthRecords[0] as any).check_date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">Chưa có dữ liệu</p>
            )}
          </div>

          {/* Quick info */}
          <div className="p-4 bg-surface rounded-xl border border-outline-variant/40">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-on-surface-variant">Quan hệ</span>
            </div>
            <p className="text-lg font-bold text-on-surface capitalize">
              {currentStudent?.relationship || "Phụ huynh"}
            </p>
          </div>
        </div>
      )}

      {/* Attendance detail tab */}
      {tab === "attendance" && (
        <div className="space-y-2">
          {loadingAttendance ? (
            Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))
          ) : attendance && attendance.length > 0 ? (
            attendance.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-outline-variant/40"
              >
                <span className="text-sm font-medium text-on-surface w-24">
                  {formatDate(a.date)}
                </span>
                <Badge
                  variant={
                    a.status === "present"
                      ? "success"
                      : a.status === "absent_excused"
                      ? "warning"
                      : "error"
                  }
                >
                  {a.status === "present"
                    ? "Có mặt"
                    : a.status === "absent_excused"
                    ? "Vắng CP"
                    : "Vắng KP"}
                </Badge>
                {a.note && (
                  <span className="text-sm text-on-surface-variant truncate">
                    {a.note}
                  </span>
                )}
              </div>
            ))
          ) : (
            <p className="text-center py-8 text-on-surface-variant">
              Chưa có dữ liệu điểm danh
            </p>
          )}
        </div>
      )}

      {/* Fees detail tab */}
      {tab === "fees" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b border-outline-variant/40">
                <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Tháng</th>
                <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Tổng</th>
                <th className="text-right py-3 px-4 font-medium text-on-surface-variant" scope="col">Đã đóng</th>
                <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Hạn</th>
                <th className="text-left py-3 px-4 font-medium text-on-surface-variant" scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {loadingFees ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="py-3 px-4">
                      <Skeleton className="h-5 rounded" />
                    </td>
                  </tr>
                ))
              ) : fees && fees.length > 0 ? (
                fees.map((f: any) => (
                  <tr
                    key={f.id}
                    className="border-b border-outline-variant/20 hover:bg-surface-container-low"
                  >
                    <td className="py-3 px-4 text-on-surface">
                      T{f.month}/{f.year}
                    </td>
                    <td className="py-3 px-4 text-right text-on-surface">
                      {formatCurrency(f.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600">
                      {formatCurrency(f.paid_amount)}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant">
                      {formatDate(f.due_date)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          f.status === "paid"
                            ? "success"
                            : f.status === "overdue"
                            ? "error"
                            : f.status === "partial"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {getStatusLabel(f.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                    Chưa có dữ liệu học phí
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Health detail tab */}
      {tab === "health" && (
        <div className="space-y-3">
          {loadingHealth ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : healthRecords && healthRecords.length > 0 ? (
            healthRecords.map((h: any) => (
              <div
                key={h.id}
                className="p-4 bg-surface rounded-xl border border-outline-variant/40"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-on-surface">
                    {formatDate(h.check_date)}
                  </span>
                  <Badge variant={h.health_status === "normal" ? "success" : "warning"}>
                    {h.health_status === "normal" ? "Bình thường" : h.health_status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-on-surface-variant">Chiều cao:</span>{" "}
                    <span className="font-medium text-on-surface">{h.height_cm} cm</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant">Cân nặng:</span>{" "}
                    <span className="font-medium text-on-surface">{h.weight_kg} kg</span>
                  </div>
                </div>
                {h.notes && (
                  <p className="text-sm text-on-surface-variant mt-2">{h.notes}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-center py-8 text-on-surface-variant">
              Chưa có dữ liệu sức khoẻ
            </p>
          )}
        </div>
      )}
    </div>
  );
}
