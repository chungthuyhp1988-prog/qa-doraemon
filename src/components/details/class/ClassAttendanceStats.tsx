import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../../lib/api';
import type { AttendanceRow } from '../../../types';

interface ClassAttendanceStatsProps {
  classId: string;
}

export const ClassAttendanceStats: React.FC<ClassAttendanceStatsProps> = ({ classId }) => {
  const currentMonthStart = format(new Date(), 'yyyy-MM-01');
  const currentMonthEnd = format(new Date(), 'yyyy-MM-dd');

  // Fetch attendance records for monthly stats
  const { data: attendanceResponse, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['class-attendance-stats', classId],
    queryFn: () =>
      api.getAll(
        'attendance',
        { page: 1, pageSize: 1000 },
        {
          filters: { class_id: classId },
          dateRange: { column: 'date', from: currentMonthStart, to: currentMonthEnd },
        }
      ),
    enabled: !!classId,
  });

  const attendanceRecords = (attendanceResponse?.data?.data || []) as AttendanceRow[];

  // Monthly stats calculations
  const totalStatsCount = attendanceRecords.length || 1;
  const pCount = attendanceRecords.filter((r) => r.status === 'present').length;
  const lCount = attendanceRecords.filter((r) => r.status === 'late').length;
  const aCount = attendanceRecords.filter((r) => r.status === 'absent').length;
  const eCount = attendanceRecords.filter((r) => r.status === 'excused').length;
  const sCount = attendanceRecords.filter((r) => r.status === 'sick').length;

  const presentRate = Math.round((pCount / totalStatsCount) * 100);
  const lateRate = Math.round((lCount / totalStatsCount) * 100);
  const absentRate = Math.round(((aCount + eCount + sCount) / totalStatsCount) * 100);

  return (
    <div className="space-y-6 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
      <div className="border-b border-outline-variant/10 pb-3">
        <h4 className="text-sm font-bold text-on-surface">
          Báo cáo chuyên cần tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
        </h4>
        <p className="text-xs text-on-surface-variant font-medium mt-0.5">
          Phản tích dữ liệu từ ngày {format(new Date(currentMonthStart), 'dd/MM/yyyy')} đến nay
        </p>
      </div>

      {isLoadingAttendance ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-surface-container rounded-xl" />
            <div className="h-20 bg-surface-container rounded-xl" />
            <div className="h-20 bg-surface-container rounded-xl" />
          </div>
        </div>
      ) : attendanceRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
          <TrendingUp className="w-10 h-10 text-on-surface-variant/40 mb-3" />
          <span className="text-sm text-on-surface-variant font-bold">
            Chưa có dữ liệu điểm danh trong tháng
          </span>
          <p className="text-xs text-on-surface-variant/70 mt-1 max-w-xs text-center font-medium">
            Các thống kê tỷ lệ đi học sẽ tự động được hiển thị khi giáo viên ghi nhận điểm danh mỗi ngày.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
            <div className="bg-green-50/40 border border-green-100 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-green-700">
                Tỷ lệ đi học đầy đủ
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-3xl font-bold font-playfair text-green-700">{presentRate}%</span>
                <span className="text-xs text-green-700/80 font-medium font-inter">({pCount} lượt)</span>
              </div>
            </div>

            <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 font-semibold">
                Tỷ lệ đi học trễ
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-3xl font-bold font-playfair text-amber-700">{lateRate}%</span>
                <span className="text-xs text-amber-700/80 font-medium font-inter">({lCount} lượt)</span>
              </div>
            </div>

            <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 font-semibold">
                Tỷ lệ vắng/nghỉ
              </span>
              <div className="flex items-baseline gap-2 mt-1.5">
                <span className="text-3xl font-bold font-playfair text-rose-700">{absentRate}%</span>
                <span className="text-xs text-rose-700/80 font-medium font-inter">
                  ({aCount + eCount + sCount} lượt)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low/20 border border-outline-variant/30 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1 select-none">
              Chi tiết chuyên cần học sinh
            </h4>

            {/* Present progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>Có mặt đúng giờ</span>
                <span className="font-bold">
                  {pCount} / {attendanceRecords.length} ({presentRate}%)
                </span>
              </div>
              <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full transition-all"
                  style={{ width: `${presentRate}%` }}
                />
              </div>
            </div>

            {/* Late progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>Đi trễ</span>
                <span className="font-bold">
                  {lCount} / {attendanceRecords.length} ({lateRate}%)
                </span>
              </div>
              <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${lateRate}%` }}
                />
              </div>
            </div>

            {/* Excused progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>Nghỉ có phép / bệnh</span>
                <span className="font-bold">
                  {eCount + sCount} / {attendanceRecords.length} ({Math.round(((eCount + sCount) / totalStatsCount) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.round(((eCount + sCount) / totalStatsCount) * 100)}%` }}
                />
              </div>
            </div>

            {/* Unexcused progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>Vắng không phép</span>
                <span className="font-bold">
                  {aCount} / {attendanceRecords.length} ({Math.round((aCount / totalStatsCount) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-600 rounded-full transition-all"
                  style={{ width: `${Math.round((aCount / totalStatsCount) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
