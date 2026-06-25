import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  ClipboardList, 
  GraduationCap, 
  ArrowRightLeft, 
  LayoutGrid, 
  Table as TableIcon,
  MessageSquare,
  Edit2,
  Trash2,
  BookOpen,
  ArrowRight,
  ChevronRight,
  UserCheck,
  Check,
  Plus
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { ClassForm } from '../forms/ClassForm';
import { Button, ConfirmDialog, Modal, Select, DatePicker, EmptyState } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';

const DAILY_SCHEDULES: Record<string, { time: string; activity: string; type: 'study' | 'eat' | 'sleep' | 'other' }[]> = {
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

interface ClassDetailPanelProps {
  classId: string;
  teachersList: any[];
  classesList: any[];
  onDeleteSuccess?: () => void;
}

export const ClassDetailPanel: React.FC<ClassDetailPanelProps> = ({
  classId,
  teachersList,
  classesList,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();
  const currentUserId = useAuthStore((state) => state.user?.id) || null;

  // View state
  const [activeTab, setActiveTab] = useState<'students' | 'rollcall' | 'schedule' | 'attendance'>('students');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Modal & Dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Student transfer states
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Roll call states
  const [rollCallDate, setRollCallDate] = useState<Date>(new Date());
  const [rollCallViewMode, setRollCallViewMode] = useState<'grid' | 'table'>('grid');
  const [isRollCallNoteModalOpen, setIsRollCallNoteModalOpen] = useState(false);
  const [selectedStudentForRollCallNote, setSelectedStudentForRollCallNote] = useState<any>(null);
  const [rollCallTempNote, setRollCallTempNote] = useState("");

  // 1. Fetch Class detail
  const { data: classResponse, isLoading: isLoadingClass } = useQuery({
    queryKey: ['class-detail', classId],
    queryFn: () => api.getById('classes', classId, '*, class_teachers(id, teacher_id, is_homeroom, users(full_name))')
  });
  const activeClass = classResponse?.data as any;

  // 2. Fetch students in class
  const { data: studentsResponse, isLoading: isLoadingStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['students-in-class', classId],
    queryFn: () => api.getAll('students', { page: 1, pageSize: 200, sortBy: 'full_name', sortOrder: 'asc' }, { filters: { class_id: classId, status: 'active' } }),
    enabled: !!classId
  });
  const students = studentsResponse?.data?.data || [];

  // 3. Fetch roll call records
  const formattedRollCallDate = format(rollCallDate, 'yyyy-MM-dd');
  const { data: rollCallAttendanceResponse, isLoading: isLoadingRollCallAttendance, refetch: refetchRollCall } = useQuery({
    queryKey: ['attendance-records', classId, formattedRollCallDate],
    queryFn: () => api.getAll('attendance', { page: 1, pageSize: 200 }, { filters: { class_id: classId, date: formattedRollCallDate } }),
    enabled: !!classId && !!formattedRollCallDate && activeTab === 'rollcall',
  });
  const rollCallRecords = rollCallAttendanceResponse?.data?.data || [];

  // Build roll call records map
  const rollCallMap = new Map<string, any>();
  rollCallRecords.forEach((record: any) => {
    rollCallMap.set(record.student_id, record);
  });

  // 4. Fetch attendance records for monthly stats
  const currentMonthStart = format(new Date(), 'yyyy-MM-01');
  const currentMonthEnd = format(new Date(), 'yyyy-MM-dd');
  const { data: attendanceResponse, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['class-attendance-stats', classId],
    queryFn: () => api.getAll(
      'attendance',
      { page: 1, pageSize: 1000 },
      {
        filters: { class_id: classId },
        dateRange: { column: 'date', from: currentMonthStart, to: currentMonthEnd }
      }
    ),
    enabled: !!classId && activeTab === 'attendance',
  });
  const attendanceRecords = (attendanceResponse?.data?.data || []) as any[];

  // Invalidate when tab changes
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [classId, activeTab]);

  // Roll Call mutations
  const saveRollCallMutation = useMutation({
    mutationFn: async ({ studentId, status, note, checkInTime, recordId }: { 
      studentId: string; 
      status: 'present' | 'absent' | 'late' | 'sick' | 'excused';
      note?: string | null;
      checkInTime?: string | null;
      recordId?: string | null;
    }) => {
      const payload: any = {
        student_id: studentId,
        class_id: classId,
        date: formattedRollCallDate,
        status,
        check_in_time: checkInTime !== undefined ? checkInTime : (status === 'present' || status === 'late' ? '08:00:00' : null),
        note: note !== undefined ? note : null,
        recorded_by: currentUserId,
        updated_at: new Date().toISOString(),
      };

      if (recordId) {
        return api.update('attendance', recordId, payload);
      } else {
        return api.create('attendance', payload);
      }
    },
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi lưu điểm danh', res.error);
      } else {
        queryClient.invalidateQueries({ queryKey: ['attendance-records', classId, formattedRollCallDate] });
        queryClient.invalidateQueries({ queryKey: ['class-attendance-stats', classId] });
      }
    },
    onError: (error: any) => {
      toast.error('Lỗi khi lưu điểm danh', error.message || 'Lỗi hệ thống');
    }
  });

  const bulkRollCallMutation = useMutation({
    mutationFn: async (status: 'present' | 'absent') => {
      const promises = students.map((student: any) => {
        const existingRecord = rollCallMap.get(student.id);
        const payload: any = {
          student_id: student.id,
          class_id: classId,
          date: formattedRollCallDate,
          status,
          check_in_time: status === 'present' ? '08:00:00' : null,
          recorded_by: currentUserId,
          updated_at: new Date().toISOString(),
        };

        if (existingRecord) {
          return api.update('attendance', existingRecord.id, payload);
        } else {
          return api.create('attendance', payload);
        }
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Điểm danh hàng loạt thành công!');
      queryClient.invalidateQueries({ queryKey: ['attendance-records', classId, formattedRollCallDate] });
      queryClient.invalidateQueries({ queryKey: ['class-attendance-stats', classId] });
    },
    onError: (error: any) => {
      toast.error('Lỗi khi điểm danh hàng loạt', error.message || 'Lỗi hệ thống');
    }
  });

  const handleRollCallStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'sick' | 'excused') => {
    const existingRecord = rollCallMap.get(studentId);
    saveRollCallMutation.mutate({
      studentId,
      status,
      note: existingRecord?.note || null,
      checkInTime: existingRecord?.check_in_time || null,
      recordId: existingRecord?.id
    });
  };

  const handleSaveRollCallNote = () => {
    if (!selectedStudentForRollCallNote) return;
    const existingRecord = rollCallMap.get(selectedStudentForRollCallNote.id);
    const status = existingRecord?.status || 'present';
    
    saveRollCallMutation.mutate({
      studentId: selectedStudentForRollCallNote.id,
      status,
      note: rollCallTempNote,
      checkInTime: existingRecord?.check_in_time || null,
      recordId: existingRecord?.id
    }, {
      onSuccess: () => {
        setIsRollCallNoteModalOpen(false);
        setSelectedStudentForRollCallNote(null);
        setRollCallTempNote("");
        toast.success('Đã lưu ghi chú!');
      }
    });
  };

  // Class action handlers
  const handleEdit = () => {
    if (!activeClass) return;
    openPanel({
      title: 'Chỉnh sửa lớp học',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <ClassForm 
          classData={activeClass} 
          teachersList={teachersList} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });
            queryClient.invalidateQueries({ queryKey: ['classes-list'] });
          }}
        />
      )
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.remove('classes', classId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa lớp học thành công!');
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsDeleteDialogOpen(false);
      closePanel();
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa lớp học', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  // Student transfer handlers
  const handleTransferClick = (student: any) => {
    setSelectedStudent(student);
    setTargetClassId("");
    setIsTransferOpen(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !targetClassId) return;
    setIsTransferring(true);
    try {
      const res = await api.update('students', selectedStudent.id, {
        class_id: targetClassId,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      
      toast.success(`Chuyển lớp thành công cho học sinh ${selectedStudent.full_name}!`);
      queryClient.invalidateQueries({ queryKey: ['students-in-class', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsTransferOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi chuyển lớp học', err.message || 'Lỗi hệ thống');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleBulkTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0 || !targetClassId) return;
    setIsTransferring(true);
    try {
      const promises = Array.from(selectedStudentIds).map(studentId => 
        api.update('students', studentId, {
          class_id: targetClassId,
          updated_at: new Date().toISOString()
        })
      );
      await Promise.all(promises);
      
      toast.success(`Đã chuyển lớp thành công cho ${selectedStudentIds.size} học sinh!`);
      setSelectedStudentIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['students-in-class', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsBulkTransferOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi chuyển lớp hàng loạt', err.message || 'Lỗi hệ thống');
    } finally {
      setIsTransferring(false);
    }
  };

  // Helper formatting functions
  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'nha_tre': return 'Nhà trẻ';
      case 'mam': return 'Mầm';
      case 'choi': return 'Chồi';
      case 'la': return 'Lá';
      default: return grade;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "HS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (isLoadingClass) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 animate-pulse space-y-4">
        <div className="w-16 h-16 bg-surface-container rounded-full" />
        <div className="h-4 bg-surface-container rounded w-1/3" />
        <div className="h-3 bg-surface-container rounded w-1/4" />
      </div>
    );
  }

  if (!activeClass) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy thông tin lớp học.
      </div>
    );
  }

  // Monthly stats calculations
  const totalStatsCount = attendanceRecords.length || 1;
  const pCount = attendanceRecords.filter(r => r.status === 'present').length;
  const lCount = attendanceRecords.filter(r => r.status === 'late').length;
  const aCount = attendanceRecords.filter(r => r.status === 'absent').length;
  const eCount = attendanceRecords.filter(r => r.status === 'excused').length;
  const sCount = attendanceRecords.filter(r => r.status === 'sick').length;
  
  const presentRate = Math.round((pCount / totalStatsCount) * 100);
  const lateRate = Math.round((lCount / totalStatsCount) * 100);
  const absentRate = Math.round(((aCount + eCount + sCount) / totalStatsCount) * 100);

  // Daily stats calculations
  const totalRollCallStudents = students.length;
  let rcPresentCount = 0;
  let rcAbsentCount = 0;
  let rcLateCount = 0;
  let rcSickCount = 0;
  let rcExcusedCount = 0;

  students.forEach((s: any) => {
    const rec = rollCallMap.get(s.id);
    if (rec) {
      if (rec.status === 'present') rcPresentCount++;
      else if (rec.status === 'absent') rcAbsentCount++;
      else if (rec.status === 'late') rcLateCount++;
      else if (rec.status === 'sick') rcSickCount++;
      else if (rec.status === 'excused') rcExcusedCount++;
    }
  });

  const rcUnmarkedCount = totalRollCallStudents - (rcPresentCount + rcAbsentCount + rcLateCount + rcSickCount + rcExcusedCount);

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      
      {/* ═══ DETAIL HEADER ═══ */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl overflow-hidden border border-primary/20 shrink-0 flex items-center justify-center text-primary">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
                Lớp {activeClass.name}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] bg-secondary-container/40 text-on-secondary-container border border-outline-variant/20 font-bold uppercase tracking-wider">
                Khối {getGradeLabel(activeClass.grade_level)}
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Phòng: {activeClass.room_number || "---"} • Sức chứa: {students.length}/{activeClass.capacity} trẻ
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleEdit}
            variant="outline"
            size="sm"
            className="rounded-xl flex items-center justify-center cursor-pointer"
            title="Chỉnh sửa lớp"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setIsDeleteDialogOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-xl border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 flex items-center justify-center cursor-pointer"
            title="Xóa lớp"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Teachers in charge */}
      <div className="px-6 py-3 bg-slate-50 border-b border-outline-variant/20 flex flex-col gap-2 shrink-0">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/80">Giáo viên phụ trách lớp</span>
        <div className="flex flex-wrap gap-2">
          {activeClass.class_teachers?.map((ct: any) => (
            <div key={ct.teacher_id} className="flex items-center gap-1.5 bg-white border border-outline-variant/30 px-3 py-1.5 rounded-xl text-xs font-semibold text-on-surface shadow-2xs">
              <UserCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              {ct.users?.full_name}
              {ct.is_homeroom && (
                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded font-extrabold uppercase tracking-wider ml-1">
                  Chủ nhiệm
                </span>
              )}
            </div>
          ))}
          {(!activeClass.class_teachers || activeClass.class_teachers.length === 0) && (
            <span className="text-xs text-on-surface-variant/60 italic py-1">Chưa phân công giáo viên giảng dạy cho lớp này.</span>
          )}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex px-4 border-b border-outline-variant/20 bg-white shrink-0">
        {[
          { id: 'students', label: `Học sinh (${students.length})`, icon: Users },
          { id: 'rollcall', label: 'Điểm danh', icon: ClipboardList },
          { id: 'schedule', label: 'Lịch sinh hoạt', icon: Clock },
          { id: 'attendance', label: 'Thống kê chuyên cần', icon: TrendingUp }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 text-[13px] font-bold border-b-2 transition-colors cursor-pointer",
              activeTab === tab.id 
                ? "border-b-primary text-primary" 
                : "border-b-transparent text-on-surface-variant hover:bg-surface-container-low/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (
          <div className="space-y-4 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider">Danh sách học sinh hoạt động</h4>
              {selectedStudentIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetClassId("");
                    setIsBulkTransferOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer select-none shrink-0 whitespace-nowrap"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Chuyển lớp hàng loạt ({selectedStudentIds.size})
                </button>
              )}
            </div>

            {isLoadingStudents ? (
              <div className="space-y-2 py-4 animate-pulse">
                <div className="h-10 bg-surface-container rounded-xl" />
                <div className="h-10 bg-surface-container rounded-xl" />
                <div className="h-10 bg-surface-container rounded-xl" />
              </div>
            ) : students.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-outline-variant rounded-2xl text-on-surface-variant space-y-2">
                <Users className="w-8 h-8 mx-auto text-on-surface-variant/40" />
                <p className="text-[13px] font-bold">Lớp chưa có học sinh</p>
                <p className="text-[11px] text-on-surface-variant/80 px-4">Hãy xếp lớp cho trẻ từ mục chờ xếp lớp ngoài trang quản lý chính.</p>
              </div>
            ) : (
              <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-white">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/30 select-none text-[12px] text-on-surface-variant uppercase tracking-wider font-extrabold">
                      <th className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={students.length > 0 && selectedStudentIds.size === students.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(new Set(students.map((s: any) => s.id)));
                            } else {
                              setSelectedStudentIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-outline accent-primary cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold text-xs">Mã HS</th>
                      <th className="px-4 py-3 font-semibold text-xs">Họ và tên</th>
                      <th className="px-4 py-3 font-semibold text-xs">Giới tính</th>
                      <th className="px-4 py-3 font-semibold text-xs">Ngày sinh</th>
                      <th className="px-4 py-3 font-semibold text-xs text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-medium text-[13.5px]">
                    {students.map((student: any) => {
                      const isChecked = selectedStudentIds.has(student.id);
                      return (
                        <tr key={student.id} className="hover:bg-surface-container-lowest/50 transition-all">
                          <td className="w-12 px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const next = new Set(selectedStudentIds);
                                if (next.has(student.id)) {
                                  next.delete(student.id);
                                } else {
                                  next.add(student.id);
                                }
                                setSelectedStudentIds(next);
                              }}
                              className="w-4 h-4 rounded border-outline accent-primary cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-on-surface font-semibold">
                            {student.student_code}
                          </td>
                          <td className="px-4 py-3 font-semibold text-on-surface">
                            {student.full_name}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-semibold",
                              student.gender === 'male' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-pink-50 text-pink-700 border border-pink-100'
                            )}>
                              {student.gender === 'male' ? 'Nam' : 'Nữ'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant text-xs">
                            {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('vi-VN') : '---'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleTransferClick(student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-primary rounded-xl text-xs font-semibold border border-outline-variant/40 transition-all cursor-pointer select-none"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Chuyển lớp
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ROLL CALL TAB ── */}
        {activeTab === 'rollcall' && (
          <div className="space-y-6 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/30 p-4 rounded-2xl border border-outline-variant/20">
              <div className="w-full sm:w-56 shrink-0">
                <DatePicker
                  label="Chọn ngày điểm danh"
                  value={rollCallDate}
                  onChange={(date) => date && setRollCallDate(date)}
                  maxDate={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ml-auto select-none">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bulkRollCallMutation.mutate('present')}
                  disabled={students.length === 0 || bulkRollCallMutation.isPending}
                  className="flex-1 sm:flex-none rounded-xl text-green-700 border-green-200 hover:bg-green-50/50 cursor-pointer font-semibold py-1.5 px-3 text-xs"
                >
                  Có mặt tất cả
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bulkRollCallMutation.mutate('absent')}
                  disabled={students.length === 0 || bulkRollCallMutation.isPending}
                  className="flex-1 sm:flex-none rounded-xl text-rose-700 border-rose-200 hover:bg-rose-50/50 cursor-pointer font-semibold py-1.5 px-3 text-xs"
                >
                  Vắng tất cả
                </Button>

                {/* View mode toggle */}
                <div className="flex items-center bg-surface-container border border-outline-variant/60 rounded-xl p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRollCallViewMode('grid')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      rollCallViewMode === 'grid'
                        ? "bg-surface text-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                    title="Xem dạng lưới"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRollCallViewMode('table')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      rollCallViewMode === 'table'
                        ? "bg-surface text-primary shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                    title="Xem dạng bảng"
                  >
                    <TableIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Daily statistics row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 select-none">
              <div className="bg-surface-container-low/50 rounded-xl border border-outline-variant/20 p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tổng sĩ số</span>
                <span className="block text-xl font-bold font-playfair text-on-surface mt-1">{totalRollCallStudents}</span>
              </div>
              <div className="bg-green-50/30 rounded-xl border border-green-100 p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Có mặt</span>
                <span className="block text-xl font-bold font-playfair text-green-700 mt-1">{rcPresentCount}</span>
              </div>
              <div className="bg-rose-50/30 rounded-xl border border-rose-100 p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Vắng</span>
                <span className="block text-xl font-bold font-playfair text-rose-700 mt-1">{rcAbsentCount}</span>
              </div>
              <div className="bg-amber-50/30 rounded-xl border border-amber-100 p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 font-semibold">Đi trễ</span>
                <span className="block text-xl font-bold font-playfair text-amber-700 mt-1">{rcLateCount}</span>
              </div>
              <div className="bg-purple-50/30 rounded-xl border border-purple-100 p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-semibold">Phép/Bệnh</span>
                <span className="block text-xl font-bold font-playfair text-purple-700 mt-1">{rcExcusedCount + rcSickCount}</span>
              </div>
              <div className="bg-slate-50/50 rounded-xl border border-slate-200/40 p-3 shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chưa báo</span>
                <span className="block text-xl font-bold font-playfair text-slate-600 mt-1">{rcUnmarkedCount}</span>
              </div>
            </div>

            {/* Students roll call listing */}
            {isLoadingRollCallAttendance ? (
              <div className="space-y-3 py-6 animate-pulse">
                <div className="h-12 bg-surface-container rounded-xl" />
                <div className="h-12 bg-surface-container rounded-xl" />
              </div>
            ) : students.length === 0 ? (
              <EmptyState
                title="Không có học sinh"
                description="Lớp học này hiện tại chưa có học sinh hoạt động nào hoặc chưa được phân lớp."
                icon={<Users className="w-12 h-12" />}
              />
            ) : rollCallViewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.map((student: any) => {
                  const attendanceRecord = rollCallMap.get(student.id);
                  const status = attendanceRecord?.status;
                  const note = attendanceRecord?.note;

                  return (
                    <div 
                      key={student.id} 
                      className={cn(
                        "bg-surface rounded-2xl border p-4 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative group",
                        status === 'present' && "border-green-200/50 bg-green-50/5",
                        status === 'absent' && "border-rose-200/50 bg-rose-50/5",
                        status === 'late' && "border-amber-200/50 bg-amber-50/5",
                        (status === 'sick' || status === 'excused') && "border-purple-200/50 bg-purple-50/5",
                        !status && "border-outline-variant/20"
                      )}
                    >
                      <div>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/40 shrink-0 bg-primary/5 flex items-center justify-center">
                            {student.profile_image_url ? (
                              <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-primary font-playfair">
                                {getInitials(student.full_name)}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-[14.5px] font-bold font-playfair text-on-surface line-clamp-1 leading-tight" title={student.full_name}>
                              {student.full_name}
                            </h4>
                            <p className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                              {student.student_code}
                            </p>
                          </div>

                          {status && (
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0",
                              status === 'present' && "bg-green-50 text-green-700 border-green-200",
                              status === 'absent' && "bg-rose-50 text-rose-700 border-rose-200",
                              status === 'late' && "bg-amber-50 text-amber-700 border-amber-200",
                              (status === 'sick' || status === 'excused') && "bg-purple-50 text-purple-700 border-purple-200"
                            )}>
                              {status === 'present' ? 'Có mặt' : status === 'absent' ? 'Vắng' : status === 'late' ? 'Trễ' : status === 'sick' ? 'Bệnh' : 'Phép'}
                            </span>
                          )}
                        </div>

                        {note && (
                          <div className="mt-2.5 bg-surface-container-low/40 border border-outline-variant/20 rounded-xl p-2 flex gap-1.5 items-start text-xs text-on-surface-variant">
                            <MessageSquare className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                            <span className="line-clamp-2 select-text">{note}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-outline-variant/10 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 flex-1">
                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'present')}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                              status === 'present'
                                ? "bg-green-600 border-green-600 text-white shadow-xs"
                                : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                            )}
                          >
                            Có mặt
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'absent')}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                              status === 'absent'
                                ? "bg-rose-600 border-rose-600 text-white shadow-xs"
                                : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                            )}
                          >
                            Vắng
                          </button>

                          <select
                            value={status && ['late', 'sick', 'excused'].includes(status) ? status : ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleRollCallStatusChange(student.id, e.target.value as any);
                              }
                            }}
                            className={cn(
                              "px-1.5 py-1 rounded-lg text-xs font-bold border focus:outline-none cursor-pointer bg-white text-on-surface-variant border-outline-variant/30 hover:bg-surface-container",
                              status && ['late', 'sick', 'excused'].includes(status) && "bg-purple-600 border-purple-600 text-white hover:bg-purple-600"
                            )}
                          >
                            <option value="" disabled className="text-on-surface-variant bg-white font-medium">Khác</option>
                            <option value="late" className="text-on-surface bg-white font-semibold">Đi trễ</option>
                            <option value="excused" className="text-on-surface bg-white font-semibold">Có phép</option>
                            <option value="sick" className="text-on-surface bg-white font-semibold">Nghỉ bệnh</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentForRollCallNote(student);
                            setRollCallTempNote(note || "");
                            setIsRollCallNoteModalOpen(true);
                          }}
                          className="p-1.5 border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                          title="Thêm ghi chú"
                        >
                          <Edit2 className="w-3 h-3 text-on-surface-variant" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30 select-none">
                        <th className="px-3 py-3 text-center w-12 font-bold">STT</th>
                        <th className="px-3 py-3 min-w-[150px] font-bold">Học sinh</th>
                        <th className="px-3 py-3 min-w-[280px] font-bold">Điểm danh</th>
                        <th className="px-3 py-3 min-w-[140px] font-bold">Ghi chú</th>
                        <th className="px-3 py-3 text-right w-16 font-bold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {students.map((student: any, index: number) => {
                        const attendanceRecord = rollCallMap.get(student.id);
                        const status = attendanceRecord?.status;
                        const note = attendanceRecord?.note;

                        return (
                          <tr
                            key={student.id}
                            className={cn(
                              "transition-colors hover:bg-surface-container-low/20",
                              status === 'present' && "bg-green-50/2",
                              status === 'absent' && "bg-rose-50/2",
                              status === 'late' && "bg-amber-50/2",
                              (status === 'sick' || status === 'excused') && "bg-purple-50/2"
                            )}
                          >
                            <td className="px-3 py-3 text-center font-semibold text-on-surface-variant/75">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/40 shrink-0 bg-primary/5 flex items-center justify-center">
                                  {student.profile_image_url ? (
                                    <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-bold text-primary font-playfair">
                                      {getInitials(student.full_name)}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold font-playfair text-on-surface truncate leading-tight" title={student.full_name}>
                                    {student.full_name}
                                  </h4>
                                  <p className="text-[9px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                                    {student.student_code}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRollCallStatusChange(student.id, 'present')}
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none",
                                    status === 'present'
                                      ? "bg-green-600 border-green-600 text-white shadow-xs"
                                      : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                                  )}
                                >
                                  Có mặt
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => handleRollCallStatusChange(student.id, 'absent')}
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none",
                                    status === 'absent'
                                      ? "bg-rose-600 border-rose-600 text-white shadow-xs"
                                      : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                                  )}
                                >
                                  Vắng
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRollCallStatusChange(student.id, 'late')}
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none",
                                    status === 'late'
                                      ? "bg-amber-500 border-amber-500 text-white shadow-xs"
                                      : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                                  )}
                                >
                                  Đi trễ
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRollCallStatusChange(student.id, 'excused')}
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none",
                                    status === 'excused'
                                      ? "bg-purple-600 border-purple-600 text-white shadow-xs"
                                      : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                                  )}
                                >
                                  Có phép
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRollCallStatusChange(student.id, 'sick')}
                                  className={cn(
                                    "px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none",
                                    status === 'sick'
                                      ? "bg-violet-600 border-violet-600 text-white shadow-xs"
                                      : "bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                                  )}
                                >
                                  Bệnh
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {note ? (
                                <div className="flex items-start gap-1 text-[11px] text-on-surface-variant max-w-[200px]" title={note}>
                                  <MessageSquare className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                  <span className="line-clamp-1 select-text">{note}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-on-surface-variant/40 italic select-none">Chưa có ghi chú</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentForRollCallNote(student);
                                  setRollCallTempNote(note || "");
                                  setIsRollCallNoteModalOpen(true);
                                }}
                                className="p-1 border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors cursor-pointer inline-flex"
                                title="Thêm ghi chú"
                              >
                                <Edit2 className="w-3 h-3 text-on-surface-variant" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === 'schedule' && (
          <div className="space-y-5 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/10 pb-3">
              <div>
                <h4 className="text-sm font-bold text-on-surface">Khung thời gian sinh hoạt hàng ngày</h4>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">Lịch sinh hoạt cố định áp dụng cho khối lớp {getGradeLabel(activeClass.grade_level)}</p>
              </div>
              <div className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start select-none">
                <GraduationCap className="w-4 h-4" /> Mẫu khối lớp
              </div>
            </div>

            <div className="relative border-l-2 border-primary/20 ml-3 pl-6 space-y-6 py-2">
              {(DAILY_SCHEDULES[activeClass.grade_level] || DAILY_SCHEDULES.mam).map((item, i) => (
                <div key={i} className="relative">
                  <span className={cn(
                    "absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm",
                    item.type === 'study' && "bg-primary",
                    item.type === 'eat' && "bg-green-600",
                    item.type === 'sleep' && "bg-indigo-600",
                    item.type === 'other' && "bg-amber-500"
                  )} />

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-surface hover:bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl p-4 transition-all">
                    <span className="text-xs font-bold font-mono text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 shrink-0 self-start sm:self-center select-none font-inter">
                      {item.time}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-on-surface leading-tight">
                        {item.activity}
                      </p>
                      <span className={cn(
                        "inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1.5 border select-none",
                        item.type === 'study' && "bg-primary/10 text-primary border-primary/20",
                        item.type === 'eat' && "bg-green-50 text-green-700 border-green-200",
                        item.type === 'sleep' && "bg-indigo-50 text-indigo-700 border-indigo-200",
                        item.type === 'other' && "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {item.type === 'study' ? 'Học tập / Kỹ năng' : item.type === 'eat' ? 'Ăn uống / Vệ sinh' : item.type === 'sleep' ? 'Nghỉ ngơi' : 'Chơi tự do / Trả trẻ'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ATTENDANCE TAB ── */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
            <div className="border-b border-outline-variant/10 pb-3">
              <h4 className="text-sm font-bold text-on-surface">Báo cáo chuyên cần tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</h4>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">Phân tích dữ liệu từ ngày {format(new Date(currentMonthStart), 'dd/MM/yyyy')} đến nay</p>
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
                <span className="text-sm text-on-surface-variant font-bold">Chưa có dữ liệu điểm danh trong tháng</span>
                <p className="text-xs text-on-surface-variant/70 mt-1 max-w-xs text-center font-medium">Các thống kê tỷ lệ đi học sẽ tự động được hiển thị khi giáo viên ghi nhận điểm danh mỗi ngày.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
                  <div className="bg-green-50/40 border border-green-100 rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-green-700">Tỷ lệ đi học đầy đủ</span>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-3xl font-bold font-playfair text-green-700">{presentRate}%</span>
                      <span className="text-xs text-green-700/80 font-medium font-inter">({pCount} lượt)</span>
                    </div>
                  </div>

                  <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 font-semibold">Tỷ lệ đi học trễ</span>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-3xl font-bold font-playfair text-amber-700">{lateRate}%</span>
                      <span className="text-xs text-amber-700/80 font-medium font-inter">({lCount} lượt)</span>
                    </div>
                  </div>

                  <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 shadow-sm">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 font-semibold">Tỷ lệ vắng/nghỉ</span>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="text-3xl font-bold font-playfair text-rose-700">{absentRate}%</span>
                      <span className="text-xs text-rose-700/80 font-medium font-inter">({aCount + eCount + sCount} lượt)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low/20 border border-outline-variant/30 rounded-2xl p-5 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1 select-none">Chi tiết chuyên cần học sinh</h4>
                  
                  {/* Present progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-on-surface">
                      <span>Có mặt đúng giờ</span>
                      <span className="font-bold">{pCount} / {attendanceRecords.length} ({presentRate}%)</span>
                    </div>
                    <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${presentRate}%` }} />
                    </div>
                  </div>

                  {/* Late progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-on-surface">
                      <span>Đi trễ</span>
                      <span className="font-bold">{lCount} / {attendanceRecords.length} ({lateRate}%)</span>
                    </div>
                    <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${lateRate}%` }} />
                    </div>
                  </div>

                  {/* Excused progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-on-surface">
                      <span>Nghỉ có phép / bệnh</span>
                      <span className="font-bold">{eCount + sCount} / {attendanceRecords.length} ({Math.round(((eCount + sCount) / totalStatsCount) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${Math.round(((eCount + sCount) / totalStatsCount) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Unexcused progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-on-surface">
                      <span>Vắng không phép</span>
                      <span className="font-bold">{aCount} / {attendanceRecords.length} ({Math.round((aCount / totalStatsCount) * 100)}%)</span>
                    </div>
                    <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-rose-600 rounded-full transition-all" style={{ width: `${Math.round((aCount / totalStatsCount) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Class Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Xóa lớp học?"
        message={`Bạn có chắc chắn muốn xóa lớp học "${activeClass.name}"? Mọi phân công giáo viên sẽ bị hủy bỏ. Học sinh trong lớp sẽ không còn thuộc lớp này.`}
        confirmText="Xóa lớp học"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />

      {/* Student Class Transfer Modal */}
      {isTransferOpen && selectedStudent && (
        <Modal
          open={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          title="Chuyển lớp học sinh"
          size="md"
        >
          <form onSubmit={handleTransferSubmit} className="space-y-5 select-none">
            <div className="p-4 rounded-2xl bg-primary-container/10 border border-primary/20 space-y-2">
              <p className="text-sm font-semibold text-on-surface">
                Học sinh: <span className="font-bold text-primary">{selectedStudent.full_name}</span>
              </p>
              <p className="text-xs text-on-surface-variant">
                Lớp hiện tại: <span className="font-semibold text-on-surface">{activeClass.name}</span>
              </p>
            </div>

            <Select
              label="Chọn lớp chuyển đến"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn lớp học mới --' },
                ...classesList
                  .filter((c) => c.id !== classId)
                  .map((c) => {
                    const gradeLabel = getGradeLabel(c.grade_level);
                    return {
                      value: c.id,
                      label: gradeLabel ? `${c.name} (Khối ${gradeLabel})` : c.name,
                    };
                  }),
              ]}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
                disabled={isTransferring}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!targetClassId || isTransferring}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                {isTransferring ? 'Đang thực hiện...' : 'Xác nhận chuyển'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Student Bulk Class Transfer Modal */}
      {isBulkTransferOpen && selectedStudentIds.size > 0 && (
        <Modal
          open={isBulkTransferOpen}
          onClose={() => setIsBulkTransferOpen(false)}
          title="Chuyển lớp hàng loạt cho học sinh"
          size="md"
        >
          <form onSubmit={handleBulkTransferSubmit} className="space-y-5 select-none">
            <div className="p-4 rounded-2xl bg-primary-container/10 border border-primary/20 space-y-2">
              <p className="text-sm font-semibold text-on-surface">
                Số học sinh được chọn: <span className="font-bold text-primary">{selectedStudentIds.size} học sinh</span>
              </p>
              <p className="text-xs text-on-surface-variant">
                Lớp hiện tại: <span className="font-semibold text-on-surface">{activeClass.name}</span>
              </p>
            </div>

            <Select
              label="Chọn lớp chuyển đến"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn lớp học mới --' },
                ...classesList
                  .filter((c) => c.id !== classId)
                  .map((c) => {
                    const gradeLabel = getGradeLabel(c.grade_level);
                    return {
                      value: c.id,
                      label: gradeLabel ? `${c.name} (Khối ${gradeLabel})` : c.name,
                    };
                  }),
              ]}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40 shrink-0">
              <button
                type="button"
                onClick={() => setIsBulkTransferOpen(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
                disabled={isTransferring}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!targetClassId || isTransferring}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                {isTransferring ? 'Đang thực hiện...' : 'Xác nhận chuyển'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Roll Call Note Modal (small modal is fine as per guidelines) */}
      {isRollCallNoteModalOpen && selectedStudentForRollCallNote && (
        <Modal
          open={isRollCallNoteModalOpen}
          onClose={() => {
            setIsRollCallNoteModalOpen(false);
            setSelectedStudentForRollCallNote(null);
          }}
          title="Thêm ghi chú điểm danh"
          size="sm"
        >
          <div className="space-y-4 select-none">
            <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold font-playfair text-primary">
                {getInitials(selectedStudentForRollCallNote.full_name)}
              </div>
              <div>
                <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Học sinh</span>
                <h4 className="text-sm font-bold text-on-surface font-inter mt-0.5">{selectedStudentForRollCallNote.full_name}</h4>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
                Nội dung ghi chú
              </label>
              <textarea
                value={rollCallTempNote}
                onChange={(e) => setRollCallTempNote(e.target.value)}
                placeholder="Nhập ghi chú ví dụ: nghỉ ốm sốt nhẹ, phụ huynh đón sớm..."
                className="w-full rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm p-3 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRollCallNoteModalOpen(false);
                  setSelectedStudentForRollCallNote(null);
                }}
                className="rounded-xl cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="button"
                onClick={handleSaveRollCallNote}
                className="rounded-xl cursor-pointer"
              >
                Lưu ghi chú
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
