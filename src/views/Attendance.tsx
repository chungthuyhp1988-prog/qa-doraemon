import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Calendar as CalendarIcon, 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  ClipboardList,
  Edit2,
  MessageSquare,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { DatePicker, Skeleton, EmptyState, ErrorState, Button, Modal, Table, type TableColumn } from "../components/ui";
import { toast } from "../stores/toastStore";
import { useAuthStore } from "../stores/authStore";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export function Attendance() {
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  const currentUserId = useAuthStore((state) => state.user?.id) || null;

  // Local Filter state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('attendance_view_mode') as 'grid' | 'table') || 'grid';
  });

  useEffect(() => {
    localStorage.setItem('attendance_view_mode', viewMode);
  }, [viewMode]);
  
  // Note Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedStudentForNote, setSelectedStudentForNote] = useState<any>(null);
  const [tempNote, setTempNote] = useState("");

  // 1. Fetch classes list for selection
  const { data: classesResponse, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.getAll<any>('classes', { page: 1, pageSize: 100 }, { filters: { is_active: true } }, 'id, name')
  });
  const classesList = classesResponse?.data?.data || [];

  // Automatically select the first class if none is selected
  useEffect(() => {
    if (classesList.length > 0 && !selectedClassId) {
      setSelectedClassId(classesList[0].id);
    }
  }, [classesList, selectedClassId]);

  // 2. Fetch active students in the selected class
  const { data: studentsResponse, isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['students-attendance', selectedClassId],
    queryFn: () => api.getAll<any>('students', { page: 1, pageSize: 200, sortBy: 'full_name', sortOrder: 'asc' }, { filters: { class_id: selectedClassId, status: 'active' } }),
    enabled: !!selectedClassId,
  });
  const studentsList = studentsResponse?.data?.data || [];

  // 3. Fetch attendance records for this class on this date
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  const { data: attendanceResponse, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance-records', selectedClassId, formattedDate],
    queryFn: () => api.getAll<any>('attendance', { page: 1, pageSize: 200 }, { filters: { class_id: selectedClassId, date: formattedDate } }),
    enabled: !!selectedClassId && !!formattedDate,
  });
  const attendanceRecords = attendanceResponse?.data?.data || [];

  // Build a map of existing attendance records for fast lookup
  const attendanceMap = new Map<string, any>();
  attendanceRecords.forEach((record: any) => {
    attendanceMap.set(record.student_id, record);
  });

  // 4. Mutation to upsert attendance record
  const saveAttendanceMutation = useMutation({
    mutationFn: async ({ studentId, status, note, checkInTime, recordId }: { 
      studentId: string; 
      status: 'present' | 'absent' | 'late' | 'sick' | 'excused';
      note?: string | null;
      checkInTime?: string | null;
      recordId?: string | null;
    }) => {
      const payload: any = {
        student_id: studentId,
        class_id: selectedClassId,
        date: formattedDate,
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
        queryClient.invalidateQueries({ queryKey: ['attendance-records', selectedClassId, formattedDate] });
      }
    },
    onError: (error: any) => {
      toast.error('Lỗi khi lưu điểm danh', error.message || 'Lỗi hệ thống');
    }
  });

  // 5. Bulk Mark Attendance mutation
  const bulkMarkMutation = useMutation({
    mutationFn: async (status: 'present' | 'absent') => {
      const promises = studentsList.map((student) => {
        const existingRecord = attendanceMap.get(student.id);
        const payload: any = {
          student_id: student.id,
          class_id: selectedClassId,
          date: formattedDate,
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
      queryClient.invalidateQueries({ queryKey: ['attendance-records', selectedClassId, formattedDate] });
    },
    onError: (error: any) => {
      toast.error('Lỗi khi điểm danh hàng loạt', error.message || 'Lỗi hệ thống');
    }
  });

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'sick' | 'excused') => {
    const existingRecord = attendanceMap.get(studentId);
    saveAttendanceMutation.mutate({
      studentId,
      status,
      note: existingRecord?.note || null,
      checkInTime: existingRecord?.check_in_time || null,
      recordId: existingRecord?.id
    });
  };

  const handleSaveNote = () => {
    if (!selectedStudentForNote) return;
    const existingRecord = attendanceMap.get(selectedStudentForNote.id);
    
    // Default to 'present' if there's no status yet
    const status = existingRecord?.status || 'present';
    
    saveAttendanceMutation.mutate({
      studentId: selectedStudentForNote.id,
      status,
      note: tempNote,
      checkInTime: existingRecord?.check_in_time || null,
      recordId: existingRecord?.id
    }, {
      onSuccess: () => {
        setIsNoteModalOpen(false);
        setSelectedStudentForNote(null);
        setTempNote("");
        toast.success('Đã lưu ghi chú!');
      }
    });
  };

  // Helper for Initials
  const getInitials = (name: string) => {
    if (!name) return "HS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Statistics calculation
  const totalStudents = studentsList.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let sickCount = 0;
  let excusedCount = 0;

  studentsList.forEach((s) => {
    const rec = attendanceMap.get(s.id);
    if (rec) {
      if (rec.status === 'present') presentCount++;
      else if (rec.status === 'absent') absentCount++;
      else if (rec.status === 'late') lateCount++;
      else if (rec.status === 'sick') sickCount++;
      else if (rec.status === 'excused') excusedCount++;
    }
  });

  const getAttendanceBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Có mặt</span>;
      case 'absent':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-rose-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Vắng</span>;
      case 'late':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold tracking-wide shadow-2xs select-none">Đi trễ</span>;
      case 'sick':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-purple-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Nghỉ bệnh</span>;
      case 'excused':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] bg-purple-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Có phép</span>;
      default:
        return null;
    }
  };

  const unmarkedCount = totalStudents - (presentCount + absentCount + lateCount + sickCount + excusedCount);

  // Define Table Columns
  const tableColumns: TableColumn<any>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: "64px",
      render: (_row: any, index: number) => (
        <span className="font-semibold text-on-surface-variant/70">
          {index + 1}
        </span>
      )
    },
    {
      key: "student",
      header: "Học sinh",
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/45 shrink-0 bg-primary/5 flex items-center justify-center">
            {row.profile_image_url ? (
              <img src={row.profile_image_url} alt={row.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[12px] font-bold text-primary font-playfair">
                {getInitials(row.full_name)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-[14.5px] font-bold font-playfair text-on-surface truncate leading-tight" title={row.full_name}>
              {row.full_name}
            </h4>
            <p className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mt-0.5 select-all">
              {row.student_code}
            </p>
          </div>
        </div>
      )
    },
    {
      key: "attendance",
      header: "Điểm danh",
      render: (row: any) => {
        const attendanceRecord = attendanceMap.get(row.id);
        const status = attendanceRecord?.status;
        return (
          <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleStatusChange(row.id, 'present')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none",
                status === 'present'
                  ? "bg-green-600 border-green-600 text-white shadow-sm"
                  : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
              )}
            >
              Có mặt
            </button>
            
            <button
              type="button"
              onClick={() => handleStatusChange(row.id, 'absent')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none",
                status === 'absent'
                  ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                  : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
              )}
            >
              Vắng
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange(row.id, 'late')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none",
                status === 'late'
                  ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                  : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
              )}
            >
              Đi trễ
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange(row.id, 'excused')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none",
                status === 'excused'
                  ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                  : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
              )}
            >
              Có phép
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange(row.id, 'sick')}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer select-none",
                status === 'sick'
                  ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                  : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
              )}
            >
              Bệnh
            </button>
          </div>
        );
      }
    },
    {
      key: "note",
      header: "Ghi chú",
      render: (row: any) => {
        const attendanceRecord = attendanceMap.get(row.id);
        const note = attendanceRecord?.note;
        return note ? (
          <div className="flex items-start gap-1.5 text-xs text-on-surface-variant max-w-[280px]" title={note}>
            <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="line-clamp-2 select-text">{note}</span>
          </div>
        ) : (
          <span className="text-xs text-on-surface-variant/40 italic select-none">Chưa có ghi chú</span>
        );
      }
    },
    {
      key: "actions",
      header: "Thao tác",
      align: "right",
      render: (row: any) => {
        const attendanceRecord = attendanceMap.get(row.id);
        const note = attendanceRecord?.note;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setSelectedStudentForNote(row);
                setTempNote(note || "");
                setIsNoteModalOpen(true);
              }}
              className="p-2 border border-outline-variant/40 rounded-xl hover:bg-surface-container transition-colors cursor-pointer"
              title="Thêm ghi chú"
            >
              <Edit2 className="w-3.5 h-3.5 text-on-surface-variant" />
            </button>
          </div>
        );
      }
    }
  ];

  const isLoading = isLoadingClasses || isLoadingStudents || isLoadingAttendance;

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-[24px] md:text-[30px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">
            Điểm danh hàng ngày
          </h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1 font-inter">
            Theo dõi chuyên cần, đi trễ, nghỉ phép và ghi nhận sức khỏe học sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => bulkMarkMutation.mutate('present')}
            disabled={totalStudents === 0 || bulkMarkMutation.isPending}
            className="flex-1 md:flex-none rounded-xl text-green-700 border-green-200 hover:bg-green-50/50 cursor-pointer font-semibold"
          >
            Có mặt tất cả
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => bulkMarkMutation.mutate('absent')}
            disabled={totalStudents === 0 || bulkMarkMutation.isPending}
            className="flex-1 md:flex-none rounded-xl text-rose-700 border-rose-200 hover:bg-rose-50/50 cursor-pointer font-semibold"
          >
            Vắng tất cả
          </Button>

          {/* View mode toggle */}
          <div className="flex items-center bg-surface-container border border-outline-variant/60 rounded-xl p-0.5 select-none shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === 'grid'
                  ? "bg-surface text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
              title="Xem dạng lưới"
            >
              <LayoutGrid className="w-4.5 h-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === 'table'
                  ? "bg-surface text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
              title="Xem dạng bảng"
            >
              <TableIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Date selection panel */}
      <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-wrap md:flex-nowrap gap-3.5 items-center mb-5">
        <div className="w-full md:w-64">
          <DatePicker
            value={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            maxDate={format(new Date(), 'yyyy-MM-dd')}
          />
        </div>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full md:w-64 h-10 rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm px-3 text-on-surface focus:outline-none focus:border-primary transition-all cursor-pointer font-semibold text-on-surface-variant"
        >
          {classesList.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          {classesList.length === 0 && (
            <option value="">Không có lớp học nào</option>
          )}
        </select>

        <div className="text-on-surface-variant/80 text-[13px] font-semibold md:ml-auto">
          Ngày hiển thị: <strong className="text-primary font-bold">{format(selectedDate, 'eeee, dd/MM/yyyy', { locale: vi })}</strong>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-surface rounded-2xl border border-outline-variant/65 border-l-4 border-l-slate-500 p-4 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng sĩ số</span>
          <span className="text-[28px] font-black font-playfair text-slate-900 dark:text-slate-50 mt-1 leading-none">{totalStudents}</span>
        </div>
        <div className="bg-surface rounded-2xl border border-outline-variant/65 border-l-4 border-l-emerald-500 p-4 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Có mặt</span>
          <span className="text-[28px] font-black font-playfair text-emerald-600 dark:text-emerald-400 mt-1 leading-none">{presentCount}</span>
        </div>
        <div className="bg-surface rounded-2xl border border-outline-variant/65 border-l-4 border-l-rose-500 p-4 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">Vắng mặt</span>
          <span className="text-[28px] font-black font-playfair text-rose-600 dark:text-rose-450 mt-1 leading-none">{absentCount}</span>
        </div>
        <div className="bg-surface rounded-2xl border border-outline-variant/65 border-l-4 border-l-amber-500 p-4 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">Đi trễ</span>
          <span className="text-[28px] font-black font-playfair text-amber-600 dark:text-amber-450 mt-1 leading-none">{lateCount}</span>
        </div>
        <div className="bg-surface rounded-2xl border border-outline-variant/65 border-l-4 border-l-purple-500 p-4 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-400">Có phép / Bệnh</span>
          <span className="text-[28px] font-black font-playfair text-purple-600 dark:text-purple-450 mt-1 leading-none">{excusedCount + sickCount}</span>
        </div>
        <div className="bg-surface rounded-2xl border border-outline-variant/65 border-l-4 border-l-slate-400 p-4 shadow-2xs flex flex-col justify-between min-h-[92px]">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Chưa điểm danh</span>
          <span className="text-[28px] font-black font-playfair text-slate-600 dark:text-slate-400 mt-1 leading-none">{unmarkedCount}</span>
        </div>
      </div>

      {/* Main Student List Area */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-[28px] border border-outline-variant/30 p-5 shadow-sm animate-pulse flex flex-col justify-between h-48">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-surface-variant/40 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-variant/40 rounded w-2/3" />
                    <div className="h-3 bg-surface-variant/40 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-10 bg-surface-variant/20 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden p-6 animate-pulse space-y-4">
            <div className="h-8 bg-surface-variant/40 rounded w-1/4 mb-6" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-outline-variant/20">
                <div className="w-6 h-4 bg-surface-variant/30 rounded" />
                <div className="w-10 h-10 bg-surface-variant/40 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-variant/40 rounded w-1/3" />
                  <div className="h-3 bg-surface-variant/30 rounded w-1/4" />
                </div>
                <div className="w-64 h-8 bg-surface-variant/20 rounded-xl" />
                <div className="w-32 h-6 bg-surface-variant/30 rounded" />
                <div className="w-8 h-8 bg-surface-variant/35 rounded-xl" />
              </div>
            ))}
          </div>
        )
      ) : isErrorStudents ? (
        <ErrorState onRetry={refetchStudents} />
      ) : studentsList.length === 0 ? (
        <EmptyState
          title="Không có học sinh"
          description="Lớp học này hiện tại chưa có học sinh hoạt động nào hoặc chưa được phân lớp."
          icon={<Users className="w-12 h-12" />}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {studentsList.map((student) => {
            const attendanceRecord = attendanceMap.get(student.id);
            const status = attendanceRecord?.status;
            const note = attendanceRecord?.note;

            return (
              <div 
                key={student.id} 
                className={cn(
                  "bg-surface-container-lowest rounded-[28px] border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group",
                  status === 'present' && "border-green-200/60 bg-green-50/5 dark:bg-green-950/2 dark:border-green-900/20",
                  status === 'absent' && "border-rose-200/60 bg-rose-50/5 dark:bg-rose-950/2 dark:border-rose-900/20",
                  status === 'late' && "border-amber-200/60 bg-amber-50/5 dark:bg-amber-950/2 dark:border-amber-900/20",
                  (status === 'sick' || status === 'excused') && "border-purple-200/60 bg-purple-50/5 dark:bg-purple-950/2 dark:border-purple-900/20",
                  !status && "border-outline-variant/30"
                )}
              >
                <div>
                  {/* Top: Avatar, Name and Status color Indicator */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant/45 shrink-0 bg-primary/5 flex items-center justify-center">
                      {student.profile_image_url ? (
                        <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[13px] font-bold text-primary font-playfair">
                          {getInitials(student.full_name)}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[16px] font-bold font-playfair text-on-surface line-clamp-1 leading-tight" title={student.full_name}>
                        {student.full_name}
                      </h4>
                      <p className="text-[11px] font-semibold text-on-surface-variant/70 uppercase tracking-widest mt-1 select-all">
                        {student.student_code}
                      </p>
                    </div>

                    {/* Status Badge */}
                    {status && getAttendanceBadge(status)}
                  </div>

                  {/* Note section */}
                  {note && (
                    <div className="mt-3 bg-surface-container-low/40 border border-outline-variant/20 rounded-xl p-2.5 flex gap-2 items-start text-xs text-on-surface-variant">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                      <span className="line-clamp-2 select-text">{note}</span>
                    </div>
                  )}
                </div>

                {/* Bottom: Action Buttons */}
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 flex-1">
                    {/* Compact Segmented Control */}
                    <button
                      type="button"
                      onClick={() => handleStatusChange(student.id, 'present')}
                      className={cn(
                        "flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        status === 'present'
                          ? "bg-green-600 border-green-600 text-white shadow-sm"
                          : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      Có mặt
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleStatusChange(student.id, 'absent')}
                      className={cn(
                        "flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                        status === 'absent'
                          ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                          : "bg-white border-outline-variant/40 text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      Vắng
                    </button>

                    {/* Compact Dropdown / Selector for other statuses */}
                    <select
                      value={status && ['late', 'sick', 'excused'].includes(status) ? status : ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleStatusChange(student.id, e.target.value as any);
                        }
                      }}
                      className={cn(
                        "px-2 py-1.5 rounded-xl text-xs font-bold border focus:outline-none cursor-pointer bg-white text-on-surface-variant border-outline-variant/40 hover:bg-surface-container",
                        status && ['late', 'sick', 'excused'].includes(status) && "bg-purple-600 border-purple-600 text-white hover:bg-purple-600 focus:ring-0"
                      )}
                    >
                      <option value="" disabled className="text-on-surface-variant bg-white font-medium">Khác</option>
                      <option value="late" className="text-on-surface bg-white font-semibold">Đi trễ</option>
                      <option value="excused" className="text-on-surface bg-white font-semibold">Có phép</option>
                      <option value="sick" className="text-on-surface bg-white font-semibold">Nghỉ bệnh</option>
                    </select>
                  </div>

                  {/* Edit note button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentForNote(student);
                      setTempNote(note || "");
                      setIsNoteModalOpen(true);
                    }}
                    className="p-2 border border-outline-variant/40 rounded-xl hover:bg-surface-container transition-colors cursor-pointer"
                    title="Thêm ghi chú"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-on-surface-variant" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Table
          className="rounded-2xl border border-outline-variant/30 shadow-sm bg-surface-container-lowest"
          columns={tableColumns}
          data={studentsList}
          rowKey={(row) => row.id}
        />
      )}

      {/* Note Modal */}
      <Modal
        open={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setSelectedStudentForNote(null);
        }}
        title={`Thêm ghi chú điểm danh`}
        size="sm"
      >
        <div className="space-y-4 select-none">
          <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold font-playfair text-primary">
              {selectedStudentForNote && getInitials(selectedStudentForNote.full_name)}
            </div>
            <div>
              <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Học sinh</span>
              <h4 className="text-sm font-bold text-on-surface font-inter mt-0.5">{selectedStudentForNote?.full_name}</h4>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
              Nội dung ghi chú
            </label>
            <textarea
              value={tempNote}
              onChange={(e) => setTempNote(e.target.value)}
              placeholder="Nhập ghi chú ví dụ: nghỉ ốm sốt nhẹ, phụ huynh đón sớm..."
              className="w-full rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm p-3 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsNoteModalOpen(false);
                setSelectedStudentForNote(null);
              }}
              className="rounded-xl cursor-pointer"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleSaveNote}
              className="rounded-xl cursor-pointer"
            >
              Lưu ghi chú
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
