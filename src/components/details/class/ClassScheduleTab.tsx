import React from 'react';
import { Clock, GraduationCap } from 'lucide-react';
import { cn } from '../../../lib/utils';

export const DAILY_SCHEDULES: Record<
  string,
  { time: string; activity: string; type: 'study' | 'eat' | 'sleep' | 'other' }[]
> = {
  nha_tre: [
    { time: '07:30 - 08:30', activity: 'Đón trẻ & Ăn sáng dặm nhẹ', type: 'eat' },
    { time: '08:30 - 09:15', activity: 'Vui chơi tự do & Vận động nhẹ', type: 'other' },
    { time: '09:15 - 10:00', activity: 'Học nhận biết đồ vật / Trò chuyện buổi sáng', type: 'study' },
    { time: '10:00 - 11:00', activity: 'Vệ sinh cá nhân & Ăn trưa', type: 'eat' },
    { time: '11:00 - 14:00', activity: 'Ngủ trưa (giấc ngủ dài cho bé)', type: 'sleep' },
    { time: '14:00 - 14:45', activity: 'Vệ sinh & Ăn bữa xế (Sữa/Bánh ngọt)', type: 'eat' },
    { time: '14:45 - 16:00', activity: 'Xem tranh / Nghe kể chuyện cổ tích', type: 'study' },
    { time: '16:00 - 17:00', activity: 'Thu dọn đồ chơi & Trả trẻ', type: 'other' },
  ],
  mam: [
    { time: '07:30 - 08:30', activity: 'Đón trẻ & Ăn sáng tại lớp', type: 'eat' },
    { time: '08:30 - 09:30', activity: 'Thể dục buổi sáng & Tập vẽ/Nặn đất sét', type: 'study' },
    { time: '09:30 - 10:30', activity: 'Hoạt động ngoài trời (Chơi cát, nước, đi dạo)', type: 'other' },
    { time: '10:30 - 11:30', activity: 'Vệ sinh & Ăn trưa', type: 'eat' },
    { time: '11:30 - 14:00', activity: 'Ngủ trưa tập thể', type: 'sleep' },
    { time: '14:00 - 14:30', activity: 'Vận động nhẹ theo nhạc & Ăn xế', type: 'eat' },
    { time: '14:30 - 16:00', activity: 'Hoạt động góc (Đóng vai bán hàng, xây dựng)', type: 'other' },
    { time: '16:00 - 17:00', activity: 'Vệ sinh cá nhân & Trả trẻ', type: 'other' },
  ],
  choi: [
    { time: '07:30 - 08:30', activity: 'Đón trẻ & Ăn sáng tự chọn', type: 'eat' },
    { time: '08:30 - 09:45', activity: 'Thể dục sáng & Học nhận biết Toán/Chữ cái', type: 'study' },
    { time: '09:45 - 10:45', activity: 'Trò chơi vận động tập thể ngoài sân trường', type: 'other' },
    { time: '10:45 - 11:45', activity: 'Vệ sinh & Ăn trưa (Bé tự phục vụ khay)', type: 'eat' },
    { time: '11:45 - 14:00', activity: 'Ngủ trưa giấc trưa', type: 'sleep' },
    { time: '14:00 - 14:30', activity: 'Ăn bữa xế dinh dưỡng', type: 'eat' },
    { time: '14:30 - 16:00', activity: 'Học âm nhạc / Làm quen Tiếng Anh cơ bản', type: 'study' },
    { time: '16:00 - 17:00', activity: 'Vệ sinh cá nhân & Trả trẻ', type: 'other' },
  ],
  la: [
    { time: '07:30 - 08:30', activity: 'Đón trẻ & Ăn sáng dinh dưỡng', type: 'eat' },
    { time: '08:30 - 09:45', activity: 'Học ghép số, chữ cái tiền tiểu học (Chuẩn bị lớp 1)', type: 'study' },
    { time: '09:45 - 10:45', activity: 'Hoạt động thể thao đồng đội ngoài trời', type: 'other' },
    { time: '10:45 - 11:45', activity: 'Vệ sinh & Ăn trưa', type: 'eat' },
    { time: '11:45 - 14:00', activity: 'Ngủ trưa', type: 'sleep' },
    { time: '14:00 - 14:30', activity: 'Ăn bữa xế', type: 'eat' },
    { time: '14:30 - 16:00', activity: 'Khoa học vui / Đọc thơ / Lớp Tiếng Anh giao tiếp', type: 'study' },
    { time: '16:00 - 17:00', activity: 'Vệ sinh & Trả trẻ', type: 'other' },
  ],
};

interface ClassScheduleTabProps {
  gradeLevel: string;
  getGradeLabel: (grade: string) => string;
}

export const ClassScheduleTab: React.FC<ClassScheduleTabProps> = ({
  gradeLevel,
  getGradeLabel,
}) => {
  const scheduleItems = DAILY_SCHEDULES[gradeLevel] || DAILY_SCHEDULES.mam;

  return (
    <div className="space-y-5 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/10 pb-3">
        <div>
          <h4 className="text-sm font-bold text-on-surface">Khung thời gian sinh hoạt hàng ngày</h4>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
            Lịch sinh hoạt cố định áp dụng cho khối lớp {getGradeLabel(gradeLevel)}
          </p>
        </div>
        <div className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start select-none">
          <GraduationCap className="w-4 h-4" /> Mẫu khối lớp
        </div>
      </div>

      <div className="relative border-l-2 border-primary/20 ml-3 pl-6 space-y-6 py-2">
        {scheduleItems.map((item, i) => (
          <div key={i} className="relative">
            <span
              className={cn(
                'absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm',
                item.type === 'study' && 'bg-primary',
                item.type === 'eat' && 'bg-green-600',
                item.type === 'sleep' && 'bg-indigo-600',
                item.type === 'other' && 'bg-amber-505 bg-amber-500'
              )}
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-surface hover:bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl p-4 transition-all">
              <span className="text-xs font-bold font-mono text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 shrink-0 self-start sm:self-center select-none font-inter">
                {item.time}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-on-surface leading-tight">{item.activity}</p>
                <span
                  className={cn(
                    'inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1.5 border select-none',
                    item.type === 'study' && 'bg-primary/10 text-primary border-primary/20',
                    item.type === 'eat' && 'bg-green-50 text-green-700 border-green-200',
                    item.type === 'sleep' && 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    item.type === 'other' && 'bg-amber-50 text-amber-700 border-amber-200'
                  )}
                >
                  {item.type === 'study'
                    ? 'Học tập / Kỹ năng'
                    : item.type === 'eat'
                    ? 'Ăn uống / Vệ sinh'
                    : item.type === 'sleep'
                    ? 'Nghỉ ngơi'
                    : 'Chơi tự do / Trả trẻ'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
