import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Wallet,
  Receipt,
  MoreVertical,
  Cake,
  Syringe,
  UserCheck
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { format, startOfWeek, addDays } from "date-fns";
import { vi } from "date-fns/locale";
import { Skeleton } from "../components/ui";

interface DashboardStats {
  total_students: number;
  today_present: number;
  today_absent: number;
  today_total_marked: number;
  month_expected: number;
  month_paid: number;
  overdue_fees: {
    id: string;
    total_amount: number;
    paid_amount: number;
    month: number;
    student_name: string;
    class_name: string | null;
  }[];
  weekly_attendance: {
    att_date: string;
    present_count: number;
    total_count: number;
  }[];
  birthday_students: {
    id: string;
    full_name: string;
    date_of_birth: string;
    class_name: string | null;
  }[];
  medical_alerts: {
    id: string;
    full_name: string;
    medical_notes: string;
    class_name: string | null;
  }[];
  unmarked_classes: {
    id: string;
    name: string;
  }[];
}

export function Dashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = today.getMonth() + 1;

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('dashboard_stats', { p_date: todayStr });
      if (error) throw error;
      return data as DashboardStats;
    },
  });

  const totalStudents = stats?.total_students ?? 0;
  const presentCount = stats?.today_present ?? 0;
  const absentCount = stats?.today_absent ?? 0;
  const todayMarked = stats?.today_total_marked ?? 0;
  const expectedAmount = stats?.month_expected ?? 0;
  const paidAmount = stats?.month_paid ?? 0;
  const overdueFeesList = stats?.overdue_fees ?? [];
  const birthdayStudents = stats?.birthday_students ?? [];
  const medicalAlerts = stats?.medical_alerts ?? [];
  const unmarkedClasses = stats?.unmarked_classes ?? [];

  const calculateAge = (dobString: string) => {
    try {
      return today.getFullYear() - new Date(dobString).getFullYear();
    } catch {
      return 3;
    }
  };

  // Build weekly chart bars from RPC data
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekdays = [
    { label: "T2", date: weekStart },
    { label: "T3", date: addDays(weekStart, 1) },
    { label: "T4", date: addDays(weekStart, 2) },
    { label: "T5", date: addDays(weekStart, 3) },
    { label: "T6", date: addDays(weekStart, 4) },
  ];

  const weeklyMap = new Map(
    (stats?.weekly_attendance ?? []).map((w) => [w.att_date, w])
  );

  const chartBars = weekdays.map((day) => {
    const dayStr = format(day.date, 'yyyy-MM-dd');
    const att = weeklyMap.get(dayStr);
    const isToday = dayStr === todayStr;
    const isFuture = day.date > today;

    let rate = 0;
    if (att && att.total_count > 0) {
      rate = Math.round((att.present_count / att.total_count) * 100);
    }

    return {
      label: day.label,
      value: isFuture ? 0 : rate,
      active: isToday,
      dateDisplay: format(day.date, 'dd/MM'),
    };
  });

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-12 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-span-12 md:col-span-6 lg:col-span-3">
              <Skeleton className="h-40 rounded-[32px]" />
            </div>
          ))}
          <div className="col-span-12 lg:col-span-8">
            <Skeleton className="h-80 rounded-[32px]" />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <Skeleton className="h-80 rounded-[32px]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Dashboard Welcome Header */}
      <div className="mb-8">
        <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface tracking-[-0.02em] leading-tight">
          Tổng quan hôm nay
        </h2>
        <p className="text-[14px] md:text-[16px] text-on-surface-variant font-medium mt-1 font-inter">
          {format(today, 'eeee, dd MMMM, yyyy', { locale: vi })}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Stat Widget 1: Attendance */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Học sinh đi học</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[26px] font-extrabold tracking-tight text-on-surface">{presentCount}</span>
                <span className="text-[12px] text-on-surface-variant font-semibold">/ {totalStudents} học sinh</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          {totalStudents > 0 && todayMarked > 0 && (
            <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
              <span className="text-on-surface-variant font-medium">Tỷ lệ đi học</span>
              <span className="text-green-650 font-extrabold">Đã báo: {Math.round((todayMarked / totalStudents) * 100)}%</span>
            </div>
          )}
        </div>

        {/* Stat Widget 2: Absences */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Vắng mặt</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[26px] font-extrabold tracking-tight text-rose-600">{absentCount}</span>
                <span className="text-[12px] text-on-surface-variant font-semibold">học sinh nghỉ</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
              <Activity className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant font-medium">Trạng thái</span>
            <span className="text-rose-600 font-extrabold">Hôm nay</span>
          </div>
        </div>

        {/* Stat Widget 3: Tuition Fees Total */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Học phí cần thu</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[26px] font-extrabold tracking-tight text-on-surface">
                  {(expectedAmount / 1000000).toFixed(1)}
                </span>
                <span className="text-[12px] text-on-surface-variant font-semibold"> Triệu VNĐ</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant font-medium">Kỳ thu phí</span>
            <span className="text-amber-600 font-extrabold">Tháng {currentMonth}</span>
          </div>
        </div>

        {/* Stat Widget 4: Tuition Fees Collected */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Thực thu học phí</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-[26px] font-extrabold tracking-tight text-green-600">
                  {(paidAmount / 1000000).toFixed(1)}
                </span>
                <span className="text-[12px] text-on-surface-variant font-semibold"> Triệu VNĐ</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
              <Receipt className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant font-medium">Tiến độ thu</span>
            {expectedAmount > 0 ? (
              <span className="text-green-600 font-extrabold">Đạt {Math.round((paidAmount / expectedAmount) * 100)}%</span>
            ) : (
              <span className="text-on-surface-variant/50 font-semibold">—</span>
            )}
          </div>
        </div>

        {/* Chart Section */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[20px] font-bold italic font-playfair text-on-surface">Tỷ lệ chuyên cần (Tuần này)</h3>
            <button type="button" className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors cursor-pointer">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Custom Bar Chart View */}
          <div className="h-64 flex items-end justify-between gap-4 pb-6 border-b border-outline-variant/30 relative select-none pl-12 pr-4">
            {/* Y Axis Labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-on-surface-variant/80 pb-6 w-8 text-right pr-2.5 font-semibold font-mono tracking-wider select-none">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div className="absolute left-12 top-0 h-full w-px bg-outline-variant/40 pb-6 z-0"></div>

            {/* Grid Lines */}
            <div className="absolute left-12 right-4 top-0 h-full flex flex-col justify-between z-0 pointer-events-none pb-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-dashed border-outline-variant/50"></div>
              ))}
            </div>
            {/* Bars */}
            {chartBars.map((bar, index) => (
              <div key={index} className="w-1/5 flex flex-col items-center justify-end z-10 group h-full pb-6">
                <div
                  className={cn(
                    "w-12 rounded-t-2xl relative transition-all duration-300 cursor-pointer shadow-sm",
                    bar.value > 0
                      ? "bg-gradient-to-t from-primary to-sky-400 hover:shadow-lg hover:shadow-primary/30 hover:brightness-105"
                      : "bg-transparent border border-dashed border-outline-variant/50 hover:bg-surface-container-low/30",
                    bar.active && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900"
                  )}
                  style={{ height: `${Math.max(bar.value, 4)}%` }}
                >
                  {bar.value > 0 && (
                    <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary font-mono select-none">
                      {bar.value}%
                    </span>
                  )}

                  <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-slate-100/95 text-white dark:text-slate-900 backdrop-blur-md text-[11px] font-bold px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-md shadow-black/10 whitespace-nowrap z-20 translate-y-1 group-hover:translate-y-0">
                    {bar.value > 0 ? `Tỉ lệ: ${bar.value}%` : 'Chưa điểm danh'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-3 text-[12px] text-on-surface-variant pl-12 pr-4">
            {chartBars.map((bar, index) => (
              <div key={index} className="w-1/5 flex flex-col items-center">
                <span className={cn("font-bold transition-colors", bar.active ? "text-primary font-bold" : "text-on-surface-variant/80")}>
                  {bar.label}
                </span>
                <span className="text-[10px] text-on-surface-variant/50 font-medium mt-0.5">{bar.dateDisplay}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Quick Actions Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Overdue/Unpaid Fees alert */}
          <div className="bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-[20px] font-bold italic font-playfair text-on-surface mb-6">Chưa đóng học phí</h3>
              <ul className="space-y-3.5">
                {overdueFeesList.map((fee, i) => (
                  <li key={fee.id || i} className="flex justify-between items-center py-2.5 border-b border-outline-variant/20 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center text-[12px] font-bold font-playfair">
                        {fee.student_name?.substring(0, 2).toUpperCase() || 'HS'}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-on-surface leading-tight font-inter">{fee.student_name}</p>
                        <p className="text-[11px] font-medium text-on-surface-variant mt-0.5">{fee.class_name || 'Chưa xếp lớp'}</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-error font-inter">
                      {((fee.total_amount - fee.paid_amount) / 1000).toLocaleString('vi-VN')}k
                    </span>
                  </li>
                ))}
                {overdueFeesList.length === 0 && (
                  <div className="text-center py-8 text-on-surface-variant/70 italic text-xs font-semibold">
                    Tất cả học sinh đã hoàn tất đóng học phí!
                  </div>
                )}
              </ul>
            </div>
          </div>

          {/* Birthdays & Reminders */}
          <div className="bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex-1 flex flex-col">
            <h3 className="text-[20px] font-bold italic font-playfair text-on-surface mb-6">Cần chú ý hôm nay</h3>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {birthdayStudents.map((student) => (
                <div key={student.id} className="bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl p-4 border-l-4 border-amber-500 border animate-in fade-in">
                  <div className="flex items-start gap-4">
                    <span className="text-amber-600 mt-0.5"><Cake className="w-5 h-5 fill-current" /></span>
                    <div>
                      <p className="text-[13.5px] font-bold text-on-surface leading-tight font-inter">Sinh nhật bé {student.full_name}</p>
                      <p className="text-[11.5px] text-on-surface-variant mt-1 font-semibold">
                        Lớp {student.class_name || 'Chưa xếp lớp'} (Tròn {calculateAge(student.date_of_birth)} tuổi)
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {medicalAlerts.map((student) => (
                <div key={student.id} className="bg-blue-50/50 dark:bg-blue-950/10 rounded-2xl p-4 border-l-4 border-primary border animate-in fade-in">
                  <div className="flex items-start gap-4">
                    <span className="text-primary mt-0.5"><Syringe className="w-5 h-5" /></span>
                    <div>
                      <p className="text-[13.5px] font-bold text-on-surface leading-tight font-inter">Lưu ý y tế: {student.full_name}</p>
                      <p className="text-[11.5px] text-on-surface-variant mt-1 font-semibold">
                        Lớp {student.class_name || 'Chưa xếp lớp'} - {student.medical_notes}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {unmarkedClasses.map((c) => (
                <div key={c.id} className="bg-rose-50/50 dark:bg-rose-950/10 rounded-2xl p-4 border-l-4 border-rose-500 border animate-in fade-in">
                  <div className="flex items-start gap-4">
                    <span className="text-rose-600 mt-0.5"><Activity className="w-5 h-5" /></span>
                    <div>
                      <p className="text-[13.5px] font-bold text-on-surface leading-tight font-inter">Lớp chưa điểm danh</p>
                      <p className="text-[11.5px] text-on-surface-variant mt-1 font-semibold">
                        Lớp {c.name} chưa hoàn tất điểm danh hôm nay.
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {birthdayStudents.length === 0 && medicalAlerts.length === 0 && unmarkedClasses.length === 0 && (
                <div className="text-center py-12 text-on-surface-variant/70 italic text-xs font-semibold">
                  Hôm nay không có sinh nhật, cảnh báo y tế hoặc lớp học chưa điểm danh nào.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
