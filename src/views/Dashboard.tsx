import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Receipt,
  MoreVertical,
  Users,
  UserPlus
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Skeleton } from "../components/ui";

interface DashboardStats {
  total_students: number;
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
}

export function Dashboard() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentMonth = today.getMonth() + 1;

  // 1. Fetch default dashboard stats (fees and totals)
  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', todayStr],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('dashboard_stats', { p_date: todayStr });
      if (error) throw error;
      return data as DashboardStats;
    },
  });

  // 2. Fetch extended student stats for simplified student-first dashboard
  const { data: extendedStats, isLoading: isLoadingExtended } = useQuery({
    queryKey: ['dashboard-extended-stats'],
    queryFn: async () => {
      // Fetch count of waiting + registered students
      const { count: waitingRegisteredCount } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .in('status', ['waiting', 'registered']);

      // Fetch class distribution and gender for active students
      const { data: classStats } = await supabase
        .from('students')
        .select('id, gender, classes!inner(name)')
        .eq('status', 'active');

      const gradeCounts = {
        shizuka: { total: 0, male: 0, female: 0 },
        nobita: { total: 0, male: 0, female: 0 },
        dorami: { total: 0, male: 0, female: 0 },
        doraemon: { total: 0, male: 0, female: 0 }
      };

      if (classStats) {
        classStats.forEach((s: any) => {
          const className = (s.classes?.name || '').toLowerCase();
          const gender = s.gender;
          
          let groupKey: keyof typeof gradeCounts | null = null;
          if (className.includes('shizuka')) groupKey = 'shizuka';
          else if (className.includes('nobita')) groupKey = 'nobita';
          else if (className.includes('dorami')) groupKey = 'dorami';
          else if (className.includes('doraemon')) groupKey = 'doraemon';

          if (groupKey) {
            gradeCounts[groupKey].total++;
            if (gender === 'male') {
              gradeCounts[groupKey].male++;
            } else if (gender === 'female') {
              gradeCounts[groupKey].female++;
            }
          }
        });
      }

      // Fetch top 5 new registrations
      const { data: newRegistrations } = await supabase
        .from('students')
        .select('id, full_name, registration_date, priority_status, created_at, guardians(phone, is_primary)')
        .in('status', ['waiting', 'registered'])
        .order('registration_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        waitingRegisteredCount: waitingRegisteredCount ?? 0,
        gradeCounts,
        newRegistrations: newRegistrations ?? []
      };
    }
  });

  const isLoading = isLoadingStats || isLoadingExtended;

  const totalStudents = stats?.total_students ?? 0;
  const expectedAmount = stats?.month_expected ?? 0;
  const paidAmount = stats?.month_paid ?? 0;
  const overdueFeesList = stats?.overdue_fees ?? [];
  const waitingRegisteredCount = extendedStats?.waitingRegisteredCount ?? 0;

  // Calculate grade distribution chart values
  const gradeCounts = extendedStats?.gradeCounts ?? {
    shizuka: { total: 0, male: 0, female: 0 },
    nobita: { total: 0, male: 0, female: 0 },
    dorami: { total: 0, male: 0, female: 0 },
    doraemon: { total: 0, male: 0, female: 0 }
  };
  const maxVal = Math.max(
    gradeCounts.shizuka.total,
    gradeCounts.nobita.total,
    gradeCounts.dorami.total,
    gradeCounts.doraemon.total,
    10
  );
  const yMax = Math.ceil(maxVal / 10) * 10;

  const yIntervals = [
    yMax,
    Math.round(yMax * 0.75),
    Math.round(yMax * 0.5),
    Math.round(yMax * 0.25),
    0
  ];

  const chartBars = [
    { label: "Shizuka", value: gradeCounts.shizuka.total, percent: yMax > 0 ? Math.round((gradeCounts.shizuka.total / yMax) * 100) : 0 },
    { label: "Nobita", value: gradeCounts.nobita.total, percent: yMax > 0 ? Math.round((gradeCounts.nobita.total / yMax) * 100) : 0 },
    { label: "Dorami", value: gradeCounts.dorami.total, percent: yMax > 0 ? Math.round((gradeCounts.dorami.total / yMax) * 100) : 0 },
    { label: "Doraemon", value: gradeCounts.doraemon.total, percent: yMax > 0 ? Math.round((gradeCounts.doraemon.total / yMax) * 100) : 0 }
  ];

  const formatRegDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getPrimaryPhone = (guardians: any) => {
    if (!guardians || !Array.isArray(guardians) || guardians.length === 0) return '—';
    const primary = guardians.find((g: any) => g.is_primary);
    return primary?.phone || guardians[0]?.phone || '—';
  };

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
        {/* Stat Widget 1: Total Active Students */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Học sinh đang học</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[26px] font-extrabold tracking-tight text-on-surface">{totalStudents}</span>
                <span className="text-[12px] text-on-surface-variant font-semibold"> trẻ</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant font-medium">Trạng thái</span>
            <span className="text-primary font-extrabold">Đang học chính thức</span>
          </div>
        </div>

        {/* Stat Widget 2: Waiting + Registered Students */}
        <div className="col-span-12 md:col-span-6 lg:col-span-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-on-surface-variant">Hồ sơ chờ & Ghi danh</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[26px] font-extrabold tracking-tight text-amber-600">{waitingRegisteredCount}</span>
                <span className="text-[12px] text-on-surface-variant font-semibold"> hồ sơ</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <UserPlus className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px]">
            <span className="text-on-surface-variant font-medium">Tuyển sinh mới</span>
            <span className="text-amber-650 font-extrabold">Đang chờ & Đăng ký</span>
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

        {/* Grade Distribution Chart Section */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-start gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[20px] font-bold italic font-playfair text-on-surface">Phân bổ học sinh theo Lớp</h3>
            <button type="button" className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full transition-colors cursor-pointer">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Custom Bar Chart View */}
          <div className="h-56 flex items-end justify-between gap-6 pb-2 border-b border-outline-variant/30 relative select-none pl-12 pr-4 mt-2">
            {/* Y Axis Labels */}
            <div className="absolute left-0 top-0 bottom-2 flex flex-col justify-between text-[10px] text-on-surface-variant/80 w-8 text-right pr-2 font-bold font-mono select-none">
              {yIntervals.map((val, idx) => (
                <span key={idx}>{val}</span>
              ))}
            </div>
            <div className="absolute left-12 top-0 bottom-2 w-px bg-outline-variant/40 z-0"></div>

            {/* Grid Lines */}
            <div className="absolute left-12 right-4 top-0 bottom-2 flex flex-col justify-between z-0 pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-dashed border-outline-variant/50"></div>
              ))}
            </div>
            {/* Bars */}
            {chartBars.map((bar, index) => (
              <div key={index} className="w-1/4 flex flex-col items-center justify-end z-10 group h-full relative">
                <div
                  className={cn(
                    "w-16 rounded-t-xl relative transition-all duration-300 cursor-pointer shadow-xs",
                    bar.value > 0
                      ? "bg-gradient-to-t from-primary to-sky-400 hover:shadow-lg hover:shadow-primary/20 hover:brightness-105"
                      : "bg-transparent border border-dashed border-outline-variant/50 hover:bg-surface-container-low/30"
                  )}
                  style={{ height: `${Math.max(bar.percent, 4)}%` }}
                >
                  {bar.value > 0 && (
                    <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[11px] font-extrabold text-primary font-mono select-none whitespace-nowrap">
                      {bar.value} trẻ
                    </span>
                  )}

                  <div className="absolute bottom-full mb-5 left-1/2 -translate-x-1/2 bg-slate-900/90 dark:bg-slate-105 text-white dark:text-slate-900 backdrop-blur-md text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none shadow-md whitespace-nowrap z-25">
                    Sĩ số: {bar.value} trẻ
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[12px] text-on-surface-variant pl-12 pr-4 shrink-0 mt-1">
            {chartBars.map((bar, index) => (
              <div key={index} className="w-1/4 flex flex-col items-center">
                <span className="font-extrabold text-on-surface-variant/90 text-[12px]">
                  {bar.label}
                </span>
              </div>
            ))}
          </div>

          {/* Detailed Data Table */}
          <div className="mt-4 border border-outline-variant/30 rounded-2xl overflow-hidden bg-surface-container-low/10">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-container-low/40 border-b border-outline-variant/30 font-extrabold text-on-surface-variant/80 uppercase tracking-wider text-[11px]">
                  <th className="p-3 pl-5">Nhóm lớp</th>
                  <th className="p-3 text-center">Tổng sĩ số</th>
                  <th className="p-3 text-center text-primary">Nam (Bé trai)</th>
                  <th className="p-3 text-center text-pink-650">Nữ (Bé gái)</th>
                  <th className="p-3 text-center">Tỷ lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {[
                  { key: 'shizuka', name: 'Shizuka' },
                  { key: 'nobita', name: 'Nobita' },
                  { key: 'dorami', name: 'Dorami' },
                  { key: 'doraemon', name: 'Doraemon' }
                ].map((item) => {
                  const data = gradeCounts[item.key as keyof typeof gradeCounts] || { total: 0, male: 0, female: 0 };
                  const pct = totalStudents > 0 ? Math.round((data.total / totalStudents) * 100) : 0;
                  return (
                    <tr key={item.key} className="hover:bg-surface-container-low/20 transition-colors font-semibold text-on-surface">
                      <td className="p-3 pl-5 font-bold">{item.name}</td>
                      <td className="p-3 text-center font-mono text-[14px]">{data.total} trẻ</td>
                      <td className="p-3 text-center text-primary font-mono">{data.male}</td>
                      <td className="p-3 text-center text-pink-650 font-mono">{data.female}</td>
                      <td className="p-3 text-center text-on-surface-variant font-mono">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts & Quick Actions Column */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Overdue/Unpaid Fees alert */}
          <div className="bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-[20px] font-bold italic font-playfair text-on-surface mb-6">Chưa đóng học phí</h3>
              <ul className="space-y-3.5">
                {overdueFeesList.slice(0, 5).map((fee, i) => (
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

          {/* New Registrations Column */}
          <div className="bg-surface-container-lowest border border-outline-variant/35 rounded-[32px] p-6 shadow-sm flex flex-col">
            <h3 className="text-[20px] font-bold italic font-playfair text-on-surface mb-6">Đăng ký mới gần đây</h3>
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {extendedStats?.newRegistrations.map((student: any) => (
                <div key={student.id} className="bg-amber-50/50 dark:bg-amber-950/10 rounded-2xl p-4 border border-outline-variant/30 hover:border-amber-400 transition-all duration-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[13.5px] font-bold text-on-surface leading-tight font-inter">{student.full_name}</p>
                      <p className="text-[11.5px] text-on-surface-variant mt-1 font-semibold">
                        SĐT: {getPrimaryPhone(student.guardians)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/70 mt-1 font-mono">
                        Đăng ký: {formatRegDate(student.registration_date)}
                      </p>
                    </div>
                    {student.priority_status && student.priority_status !== 'none' && (
                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-amber-550/10 text-amber-700 px-2 py-0.5 rounded-full font-inter">
                        Ưu tiên
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {(!extendedStats?.newRegistrations || extendedStats.newRegistrations.length === 0) && (
                <div className="text-center py-12 text-on-surface-variant/70 italic text-xs font-semibold">
                  Chưa có hồ sơ tuyển sinh mới đăng ký.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
