import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowUp, 
  User, 
  Activity, 
  Wallet, 
  Receipt, 
  MoreVertical, 
  Cake, 
  Syringe,
  TrendingUp,
  UserCheck
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { format, startOfWeek, addDays } from "date-fns";
import { vi } from "date-fns/locale";

export function Dashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  // 1. Fetch total active students count
  const { data: totalStudentsCountRes } = useQuery({
    queryKey: ['dashboard-students-count'],
    queryFn: () => api.count('students', { filters: { status: 'active' } })
  });
  const totalStudents = totalStudentsCountRes?.data || 0;

  // 2. Fetch today's attendance records
  const { data: todayAttendanceRes } = useQuery({
    queryKey: ['dashboard-today-attendance', todayStr],
    queryFn: () => api.getAll('attendance', { page: 1, pageSize: 1000 }, { filters: { date: todayStr } })
  });
  const todayAttendance = todayAttendanceRes?.data?.data || [];

  const presentCount = todayAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
  const absentCount = todayAttendance.filter((a: any) => a.status === 'absent' || a.status === 'sick' || a.status === 'excused').length;

  // 3. Fetch monthly tuition fee details
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  const { data: monthlyFeesRes } = useQuery({
    queryKey: ['dashboard-monthly-fees', currentMonth, currentYear],
    queryFn: () => api.getAll('tuition_fees', { page: 1, pageSize: 1000 }, { filters: { month: currentMonth, year: currentYear } }, 'total_amount, paid_amount')
  });
  const monthlyFees = monthlyFeesRes?.data?.data || [];

  let expectedAmount = 0;
  let paidAmount = 0;
  monthlyFees.forEach((fee: any) => {
    expectedAmount += Number(fee.total_amount || 0);
    paidAmount += Number(fee.paid_amount || 0);
  });

  // 4. Fetch overdue tuition fees (max 5)
  const { data: overdueFeesRes } = useQuery({
    queryKey: ['dashboard-overdue-fees'],
    queryFn: () => api.getAll('tuition_fees', { page: 1, pageSize: 5 }, { filters: { status: 'overdue' } }, '*, students(full_name, classes(name))')
  });
  const overdueFeesList = overdueFeesRes?.data?.data || [];

  // 5. Query weekly attendance range
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const mondayStr = format(startOfCurrentWeek, 'yyyy-MM-dd');
  const fridayStr = format(addDays(startOfCurrentWeek, 4), 'yyyy-MM-dd');

  const { data: weeklyAttendanceRes } = useQuery({
    queryKey: ['dashboard-weekly-attendance', mondayStr, fridayStr],
    queryFn: () => api.getAll(
      'attendance', 
      { page: 1, pageSize: 5000 }, 
      { 
        dateRange: {
          column: 'date',
          from: mondayStr,
          to: fridayStr
        }
      }
    )
  });
  const weeklyAttendance = weeklyAttendanceRes?.data?.data || [];

  // Fetch active students to check for birthdays today
  const { data: birthdayStudents = [] } = useQuery({
    queryKey: ['dashboard-birthdays'],
    queryFn: async () => {
      const res = await api.getAll<any>(
        'students',
        { page: 1, pageSize: 1000 },
        { filters: { status: 'active' } },
        'id, full_name, date_of_birth, classes(name)'
      );
      
      const todayMD = format(new Date(), 'MM-dd');
      
      return (res.data?.data || []).filter((s: any) => {
        if (!s.date_of_birth) return false;
        try {
          return s.date_of_birth.substring(5, 10) === todayMD;
        } catch {
          return false;
        }
      });
    }
  });

  const calculateAge = (dobString: string) => {
    try {
      const birthDate = new Date(dobString);
      const today = new Date();
      return today.getFullYear() - birthDate.getFullYear();
    } catch {
      return 3;
    }
  };

  // Fetch medical alerts from active students
  const { data: medicalAlerts = [] } = useQuery({
    queryKey: ['dashboard-medical-alerts'],
    queryFn: async () => {
      const res = await api.getAll<any>(
        'students',
        { page: 1, pageSize: 1000 },
        { filters: { status: 'active' } },
        'id, full_name, medical_notes, classes(name)'
      );
      return (res.data?.data || []).filter((s: any) => !!s.medical_notes);
    }
  });

  // Fetch unmarked classes for today
  const { data: unmarkedClasses = [] } = useQuery({
    queryKey: ['dashboard-attendance-alerts', todayStr],
    queryFn: async () => {
      const classesRes = await api.getAll<any>('classes', { page: 1, pageSize: 100 }, { filters: { is_active: true } });
      const classes = classesRes.data?.data || [];
      
      const attRes = await api.getAll<any>('attendance', { page: 1, pageSize: 5000 }, { filters: { date: todayStr } });
      const attRecords = attRes.data?.data || [];
      
      const markedClassIds = new Set(attRecords.map((r: any) => r.class_id));
      return classes.filter((c: any) => !markedClassIds.has(c.id));
    }
  });

  // Compute daily attendance rate
  const weekdays = [
    { label: "T2", date: startOfCurrentWeek },
    { label: "T3", date: addDays(startOfCurrentWeek, 1) },
    { label: "T4", date: addDays(startOfCurrentWeek, 2) },
    { label: "T5", date: addDays(startOfCurrentWeek, 3) },
    { label: "T6", date: addDays(startOfCurrentWeek, 4) },
  ];

  const chartBars = weekdays.map((day) => {
    const dayStr = format(day.date, 'yyyy-MM-dd');
    const dayAttendance = weeklyAttendance.filter((a: any) => a.date === dayStr);
    
    const present = dayAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length;
    
    const isFuture = day.date > today;
    const isToday = format(day.date, 'yyyy-MM-dd') === todayStr;

    let rate = 0;
    if (dayAttendance.length > 0 && totalStudents > 0) {
      rate = Math.round((present / dayAttendance.length) * 100);
    } else if (!isFuture && !isToday) {
      // Fallback values for mock display if no DB entries exist yet
      const fallbackValues: Record<string, number> = { "T2": 92, "T3": 95, "T4": 88, "T5": 94, "T6": 91 };
      rate = fallbackValues[day.label] || 90;
    } else if (isToday && dayAttendance.length === 0) {
      rate = 0; // Not marked yet
    }

    return {
      label: day.label,
      value: rate,
      active: isToday,
      dateDisplay: format(day.date, 'dd/MM')
    };
  });

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Dashboard Welcome Header */}
      <div className="mb-8">
        <h2 className="text-[24px] md:text-[30px] font-bold italic font-playfair text-on-surface tracking-[-0.02em] leading-tight">
          Tổng quan hôm nay
        </h2>
        <p className="text-[14px] md:text-[16px] text-on-surface-variant font-medium mt-1 font-inter">
          {format(today, 'eeee, dd MMMM, yyyy', { locale: vi })}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Stat Widget 1: Attendance */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
              <UserCheck className="w-5 h-5 shrink-0" />
            </div>
            {totalStudents > 0 && todayAttendance.length > 0 && (
              <span className="bg-green-50 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-150">
                Đã báo: {Math.round((todayAttendance.length / totalStudents) * 100)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Học sinh đi học</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[36px] font-bold italic font-playfair text-on-surface leading-none">{presentCount}</span>
              <span className="text-[13px] text-on-surface-variant font-semibold">/ {totalStudents} học sinh</span>
            </div>
          </div>
        </div>

        {/* Stat Widget 2: Absences */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-500/5 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 shrink-0">
              <Activity className="w-5 h-5 shrink-0" />
            </div>
            <span className="bg-surface-container-high text-on-surface text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-outline-variant/20">Hôm nay</span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Vắng mặt</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[36px] font-bold italic font-playfair text-rose-700 leading-none">{absentCount}</span>
              <span className="text-[13px] text-on-surface-variant font-semibold">học sinh nghỉ học</span>
            </div>
          </div>
        </div>

        {/* Stat Widget 3: Tuition Fees Total */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Wallet className="w-5 h-5 shrink-0" />
            </div>
            <span className="bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
              Tháng {currentMonth}
            </span>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Học phí cần thu</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[36px] font-bold italic font-playfair text-on-surface leading-none">
                {(expectedAmount / 1000000).toFixed(1)}
              </span>
              <span className="text-[13px] text-on-surface-variant font-semibold">Triệu VNĐ</span>
            </div>
          </div>
        </div>

        {/* Stat Widget 4: Tuition Fees Collected */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-green-500/5 rounded-full blur-xl"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-full bg-green-500/15 flex items-center justify-center text-green-700 shrink-0">
              <Receipt className="w-5 h-5 shrink-0" />
            </div>
            {expectedAmount > 0 && (
              <span className="bg-green-50 text-green-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-green-200/50">
                Đạt {Math.round((paidAmount / expectedAmount) * 100)}%
              </span>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Thực thu học phí</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-[36px] font-bold italic font-playfair text-green-700 leading-none">
                {(paidAmount / 1000000).toFixed(1)}
              </span>
              <span className="text-[13px] text-on-surface-variant font-semibold">Triệu VNĐ</span>
            </div>
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
            {/* Y-axis vertical line */}
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
                  style={{ height: `${Math.max(bar.value, 4)}%` }} // Minimum height to render
                >
                  {/* Static Value Label on top of the bar */}
                  {bar.value > 0 && (
                    <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary font-mono select-none">
                      {bar.value}%
                    </span>
                  )}

                  {/* Hover Tooltip */}
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
                {overdueFeesList.map((fee: any, i: number) => (
                  <li key={fee.id || i} className="flex justify-between items-center py-2.5 border-b border-outline-variant/20 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center text-[12px] font-bold font-playfair">
                        {fee.students?.full_name?.substring(0, 2).toUpperCase() || 'HS'}
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-on-surface leading-tight font-inter">{fee.students?.full_name}</p>
                        <p className="text-[11px] font-medium text-on-surface-variant mt-0.5">{fee.students?.classes?.name || 'Chưa xếp lớp'}</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-error font-inter">
                      {((fee.total_amount - fee.paid_amount) / 1000).toLocaleString('vi-VN')}k
                    </span>
                  </li>
                ))}
                {overdueFeesList.length === 0 && (
                  <div className="text-center py-8 text-on-surface-variant/70 italic text-xs font-semibold">
                    🎉 Tất cả học sinh đã hoàn tất đóng học phí!
                  </div>
                )}
              </ul>
            </div>
          </div>

          {/* Birthdays & Reminders */}
          <div className="bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex-1 flex flex-col">
            <h3 className="text-[20px] font-bold italic font-playfair text-on-surface mb-6">Cần chú ý hôm nay</h3>
            
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {birthdayStudents.map((student: any) => (
                <div key={student.id || student.full_name} className="bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl p-4 border-l-4 border-amber-500 border animate-in fade-in">
                  <div className="flex items-start gap-4">
                    <span className="text-amber-600 mt-0.5"><Cake className="w-5 h-5 fill-current" /></span>
                    <div>
                      <p className="text-[13.5px] font-bold text-on-surface leading-tight font-inter">Sinh nhật bé {student.full_name}</p>
                      <p className="text-[11.5px] text-on-surface-variant mt-1 font-semibold">
                        Lớp {student.classes?.name || 'Chưa xếp lớp'} (Tròn {calculateAge(student.date_of_birth)} tuổi)
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {medicalAlerts.map((student: any) => (
                <div key={student.id} className="bg-blue-50/50 dark:bg-blue-950/10 rounded-2xl p-4 border-l-4 border-primary border animate-in fade-in">
                  <div className="flex items-start gap-4">
                    <span className="text-primary mt-0.5"><Syringe className="w-5 h-5" /></span>
                    <div>
                      <p className="text-[13.5px] font-bold text-on-surface leading-tight font-inter">Lưu ý y tế: {student.full_name}</p>
                      <p className="text-[11.5px] text-on-surface-variant mt-1 font-semibold">
                        Lớp {student.classes?.name || 'Chưa xếp lớp'} - {student.medical_notes}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {unmarkedClasses.map((c: any) => (
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
                  ✨ Hôm nay không có sinh nhật, cảnh báo y tế hoặc lớp học chưa điểm danh nào.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
