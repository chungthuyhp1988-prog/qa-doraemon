import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Plus, 
  Home, 
  Users, 
  Edit2, 
  Trash2, 
  BookOpen, 
  ChevronRight, 
  UserCheck, 
  ArrowRightLeft,
  LayoutGrid,
  Info,
  Calendar,
  TrendingUp,
  Clock,
  ArrowRight,
  GraduationCap,
  UserPlus,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog, Modal, Select } from "../components/ui";
import { ClassForm } from "../components/forms/ClassForm";
import { useAppStore } from "../stores/appStore";
import { format } from "date-fns";

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

export function Classes() {
  const queryClient = useQueryClient();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);

  // Modal / Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Selection states
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'students' | 'schedule' | 'attendance'>('students');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Student transfer states
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Waitlist collapsible state
  const [isUnassignedOpen, setIsUnassignedOpen] = useState(true);

  // Reset selected checkboxes on class change
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [activeClassId]);

  // 1. Fetch academic years just in case
  const { data: yearsResponse } = useQuery({
    queryKey: ['academic-years-list'],
    queryFn: () => api.getAll<any>('academic_years', { page: 1, pageSize: 100 })
  });
  const currentYearName = (yearsResponse?.data?.data as any[])?.find(y => y.id === selectedAcademicYearId)?.name || 'Năm học hiện tại';

  // 2. Fetch all teachers for ClassForm & display
  const { data: teachersResponse } = useQuery({
    queryKey: ['teachers-only-list'],
    queryFn: () => api.getAll<any>('users', { page: 1, pageSize: 100 }, { filters: { role: 'teacher', is_active: true } })
  });
  const teachersList = teachersResponse?.data?.data || [];

  // 3. Fetch all classes in selected academic year
  const { data: classesResponse, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes-list', selectedAcademicYearId],
    queryFn: () => {
      if (!selectedAcademicYearId) {
        return { data: { data: [], count: 0 }, error: null, count: 0 };
      }
      return api.getAll<any>(
        'classes',
        { page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' },
        { filters: { academic_year_id: selectedAcademicYearId } },
        '*, class_teachers(teacher_id, is_homeroom, users(full_name))'
      );
    },
    enabled: !!selectedAcademicYearId,
  });
  const classes = classesResponse?.data?.data || [];

  // Active class detail
  const activeClass = classes.find(c => c.id === activeClassId) || classes[0];

  // Set default active class if not set yet
  if (!activeClassId && classes.length > 0) {
    setActiveClassId(classes[0].id);
  }

  // 4. Fetch students for the active class
  const { data: studentsResponse, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students-in-class', activeClassId],
    queryFn: () => {
      if (!activeClassId) {
        return { data: { data: [], count: 0 }, error: null, count: 0 };
      }
      return api.getAll<any>(
        'students',
        { page: 1, pageSize: 100, sortBy: 'full_name', sortOrder: 'asc' },
        { filters: { class_id: activeClassId, status: 'active' } }
      );
    },
    enabled: !!activeClassId,
  });
  const students = studentsResponse?.data?.data || [];

  // Fetch unassigned students
  const { data: unassignedResponse, isLoading: isLoadingUnassigned } = useQuery({
    queryKey: ['unassigned-students', selectedAcademicYearId],
    queryFn: () => {
      return api.getAll<any>(
        'students',
        { page: 1, pageSize: 200, sortBy: 'full_name', sortOrder: 'asc' },
        { filters: { class_id: null, status: 'active' } }
      );
    },
    enabled: !!selectedAcademicYearId,
  });
  const unassignedStudents = unassignedResponse?.data?.data || [];

  // Fetch attendance records for current month to compute stats
  const currentMonthStart = format(new Date(), 'yyyy-MM-01');
  const currentMonthEnd = format(new Date(), 'yyyy-MM-dd');
  const { data: attendanceResponse, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['class-attendance-stats', activeClassId],
    queryFn: () => {
      if (!activeClassId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>(
        'attendance',
        { page: 1, pageSize: 1000 },
        {
          filters: { class_id: activeClassId },
          dateRange: { column: 'date', from: currentMonthStart, to: currentMonthEnd }
        }
      );
    },
    enabled: !!activeClassId && activeTab === 'attendance',
  });
  const attendanceRecords = attendanceResponse?.data?.data || [];

  // Calculate attendance rates
  const totalStatsCount = attendanceRecords.length || 1;
  const pCount = attendanceRecords.filter(r => r.status === 'present').length;
  const lCount = attendanceRecords.filter(r => r.status === 'late').length;
  const aCount = attendanceRecords.filter(r => r.status === 'absent').length;
  const eCount = attendanceRecords.filter(r => r.status === 'excused').length;
  const sCount = attendanceRecords.filter(r => r.status === 'sick').length;
  
  const presentRate = Math.round((pCount / totalStatsCount) * 100);
  const lateRate = Math.round((lCount / totalStatsCount) * 100);
  const absentRate = Math.round(((aCount + eCount + sCount) / totalStatsCount) * 100);

  // Filtering classes based on search
  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.room_number?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateClick = () => {
    setSelectedClass(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (c: any) => {
    setSelectedClass(c);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (c: any) => {
    setSelectedClass(c);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedClass) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('classes', selectedClass.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa lớp học thành công!');
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      
      // If we deleted the active class, reset activeClassId
      if (activeClassId === selectedClass.id) {
        setActiveClassId(null);
      }
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi xóa lớp học', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

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
      queryClient.invalidateQueries({ queryKey: ['students-in-class', activeClassId] });
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
      queryClient.invalidateQueries({ queryKey: ['students-in-class', activeClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsBulkTransferOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi chuyển lớp hàng loạt', err.message || 'Lỗi hệ thống');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleQuickAssign = async (student: any) => {
    if (!activeClassId) return;
    try {
      const res = await api.update('students', student.id, {
        class_id: activeClassId,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      toast.success(`Đã xếp lớp thành công trẻ ${student.full_name} vào lớp ${activeClass.name}!`);
      queryClient.invalidateQueries({ queryKey: ['students-in-class', activeClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
    } catch (err: any) {
      toast.error('Lỗi khi xếp lớp nhanh', err.message || 'Lỗi hệ thống');
    }
  };

  const getGradeLabel = (grade: string) => {
    switch (grade) {
      case 'nha_tre': return 'Nhà trẻ';
      case 'mam': return 'Mầm';
      case 'choi': return 'Chồi';
      case 'la': return 'Lá';
      default: return grade;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Quản Lý Lớp Học</h1>
          <p className="text-sm text-on-surface-variant">
            Danh sách các lớp học, phân công giáo viên và quản lý học sinh theo lớp năm học {currentYearName}.
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tạo Lớp Mới
        </button>
      </div>

      {!selectedAcademicYearId ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/20">
          <Info className="w-12 h-12 text-primary mb-4" />
          <h3 className="text-lg font-bold text-on-surface mb-1">Chưa chọn năm học</h3>
          <p className="text-sm text-on-surface-variant text-center max-w-sm">
            Vui lòng cấu hình năm học trong phần Cài đặt hệ thống để có thể quản lý lớp học.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left panel: Classes grid/list */}
          <div className="lg:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Tìm kiếm lớp học..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-container-low hover:bg-surface-container-low/80 focus:bg-white text-on-surface placeholder-on-surface-variant pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm"
              />
            </div>

            {isLoadingClasses ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 rounded-2xl bg-surface-container-low animate-pulse" />
                ))}
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
                <Home className="w-10 h-10 text-on-surface-variant/40 mb-3" />
                <span className="text-sm text-on-surface-variant">Không tìm thấy lớp học nào</span>
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {filteredClasses.map((c) => {
                  const isActive = activeClassId === c.id;
                  const homeroom = c.class_teachers?.find((ct: any) => ct.is_homeroom)?.users?.full_name || "Chưa phân công";
                  const teacherCount = c.class_teachers?.length || 0;
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveClassId(c.id)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md flex flex-col gap-3 relative select-none",
                        isActive
                          ? "bg-primary-container/20 border-primary shadow-sm"
                          : "bg-surface border-outline-variant/40 hover:border-outline-variant"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-container/40 text-on-secondary-container">
                            Khối {getGradeLabel(c.grade_level)}
                          </span>
                          <h3 className="font-bold text-base text-on-surface mt-1.5">{c.name}</h3>
                          <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                            Phòng: {c.room_number || "---"} | Sức chứa: {c.capacity} trẻ
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(c);
                            }}
                            className="p-2 hover:bg-surface-container-high/60 rounded-xl text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(c);
                            }}
                            className="p-2 hover:bg-error-container/20 rounded-xl text-on-surface-variant hover:text-error transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-outline-variant/20 pt-3 flex items-center justify-between text-xs font-medium text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                          CN: {homeroom}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-secondary" />
                          {teacherCount} GV
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Waitlist / Unassigned Students panel */}
            <div className="bg-surface border border-outline-variant/40 rounded-[24px] overflow-hidden shadow-sm animate-in fade-in duration-300">
              <button
                type="button"
                onClick={() => setIsUnassignedOpen(!isUnassignedOpen)}
                className="w-full px-4 py-3 bg-surface-container-low/60 hover:bg-surface-container-low flex items-center justify-between font-bold text-xs uppercase tracking-wider text-on-surface-variant transition-all select-none border-b border-outline-variant/20 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <UserPlus className="w-4.5 h-4.5 text-primary" />
                  Trẻ chưa xếp lớp ({unassignedStudents.length})
                </span>
                {isUnassignedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isUnassignedOpen && (
                <div className="p-3 space-y-2.5 max-h-[220px] overflow-y-auto bg-white/50">
                  {isLoadingUnassigned ? (
                    <div className="space-y-2 py-2">
                      {[1, 2].map(i => (
                        <div key={i} className="h-10 rounded-xl bg-surface-container-low animate-pulse" />
                      ))}
                    </div>
                  ) : unassignedStudents.length === 0 ? (
                    <p className="text-xs text-on-surface-variant/70 italic text-center py-4 select-none">
                      Tất cả trẻ đã được xếp lớp!
                    </p>
                  ) : (
                    unassignedStudents.map((student: any) => (
                      <div key={student.id} className="flex items-center justify-between p-2 rounded-xl bg-surface hover:bg-surface-container/30 border border-outline-variant/20 transition-all">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-on-surface truncate">{student.full_name}</p>
                          <p className="text-[10px] text-on-surface-variant/80 font-semibold mt-0.5">{student.student_code} | {student.gender === 'male' ? 'Nam' : 'Nữ'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickAssign(student)}
                          disabled={!activeClassId}
                          className="px-2 py-1 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1 shrink-0 select-none"
                          title={`Xếp nhanh vào lớp ${activeClass?.name || ''}`}
                        >
                          Xếp lớp
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Active class details & students list */}
          <div className="lg:col-span-2 space-y-6">
            {activeClass ? (
              <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6 space-y-6">
                {/* Class header & teacher summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-outline-variant/20 pb-5">
                  <div>
                    <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
                      <BookOpen className="w-5.5 h-5.5 text-primary" />
                      Lớp {activeClass.name}
                    </h2>
                    <p className="text-sm text-on-surface-variant font-medium mt-1">
                      Khối lớp: <span className="font-semibold text-on-surface">{getGradeLabel(activeClass.grade_level)}</span> | 
                      Phòng: <span className="font-semibold text-on-surface">{activeClass.room_number || "---"}</span> | 
                      Học sinh thực tế: <span className="font-semibold text-on-surface">{students.length}</span>/{activeClass.capacity}
                    </p>
                    {activeClass.description && (
                      <p className="text-xs text-on-surface-variant mt-2 italic bg-surface-container-lowest p-2.5 rounded-xl border border-outline-variant/20 max-w-xl">
                        "{activeClass.description}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Teachers list of this class */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-on-surface">Giáo viên phụ trách lớp</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeClass.class_teachers?.map((ct: any) => (
                      <div key={ct.teacher_id} className="flex items-center gap-3 p-3 bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs",
                          ct.is_homeroom ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                        )}>
                          {ct.users?.full_name?.charAt(0) || "GV"}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
                            {ct.users?.full_name}
                            {ct.is_homeroom && (
                              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                Chủ nhiệm
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!activeClass.class_teachers || activeClass.class_teachers.length === 0) && (
                      <div className="col-span-2 text-sm text-on-surface-variant italic py-2">
                        Chưa phân công giáo viên giảng dạy cho lớp này.
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs navigation */}
                <div className="flex px-1 border-b border-outline-variant/30 bg-surface-container-lowest select-none">
                  {[
                    { id: 'students', label: `Học sinh (${students.length})`, icon: Users },
                    { id: 'schedule', label: 'Lịch sinh hoạt', icon: Clock },
                    { id: 'attendance', label: 'Thống kê chuyên cần', icon: TrendingUp }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-3 text-[13.5px] font-bold border-b-2 transition-all cursor-pointer",
                        activeTab === tab.id
                          ? "border-b-primary text-primary"
                          : "border-b-transparent text-on-surface-variant hover:bg-surface-container-low"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content 1: Students list */}
                {activeTab === 'students' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-sm font-bold text-on-surface">
                        Danh sách học sinh hoạt động
                      </h3>
                      {selectedStudentIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetClassId("");
                            setIsBulkTransferOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer select-none"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          Chuyển lớp hàng loạt ({selectedStudentIds.size})
                        </button>
                      )}
                    </div>

                    {isLoadingStudents ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-12 rounded-xl bg-surface-container-low animate-pulse" />
                        ))}
                      </div>
                    ) : students.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
                        <Users className="w-8 h-8 text-on-surface-variant/40 mb-2" />
                        <span className="text-sm text-on-surface-variant">Lớp học trống (Chưa có học sinh nào)</span>
                      </div>
                    ) : (
                      <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-white">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-surface-container-low border-b border-outline-variant/30 select-none">
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
                              <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Mã HS</th>
                              <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Họ và tên</th>
                              <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Giới tính</th>
                              <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Ngày sinh</th>
                              <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/20">
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
                                      student.gender === 'male' ? 'bg-info-container/40 text-on-info-container' : 'bg-pink-100 text-pink-700 dark:bg-pink-950/20 dark:text-pink-300'
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
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-primary rounded-xl text-xs font-semibold border border-outline-variant/40 transition-all cursor-pointer"
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

                {/* Tab Content 2: Daily Schedule Timeline */}
                {activeTab === 'schedule' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/10 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-on-surface">
                          Khung thời gian sinh hoạt hàng ngày
                        </h3>
                        <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                          Lịch sinh hoạt cố định áp dụng cho khối lớp {getGradeLabel(activeClass.grade_level)}
                        </p>
                      </div>
                      <div className="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start select-none">
                        <GraduationCap className="w-4 h-4" /> Mẫu khối lớp
                      </div>
                    </div>

                    <div className="relative border-l-2 border-primary/20 ml-3 pl-6 space-y-6 py-2">
                      {(DAILY_SCHEDULES[activeClass.grade_level] || DAILY_SCHEDULES.mam).map((item, i) => (
                        <div key={i} className="relative">
                          {/* Dot marker */}
                          <span className={cn(
                            "absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm",
                            item.type === 'study' && "bg-primary",
                            item.type === 'eat' && "bg-green-600",
                            item.type === 'sleep' && "bg-indigo-600",
                            item.type === 'other' && "bg-amber-505 bg-amber-500"
                          )} />

                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-surface hover:bg-surface-container-low/30 border border-outline-variant/20 rounded-2xl p-4 transition-all">
                            <span className="text-xs font-bold font-mono text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 shrink-0 self-start sm:self-center select-none">
                              {item.time}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-on-surface leading-tight">
                                {item.activity}
                              </p>
                              <span className={cn(
                                "inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1.5 border select-none",
                                item.type === 'study' && "bg-primary/10 text-primary border-primary/20",
                                item.type === 'eat' && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30",
                                item.type === 'sleep' && "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30",
                                item.type === 'other' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
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

                {/* Tab Content 3: Class Attendance Insights */}
                {activeTab === 'attendance' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="border-b border-outline-variant/10 pb-3">
                      <h3 className="text-sm font-bold text-on-surface">
                        Báo cáo chuyên cần tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                        Phân tích dữ liệu từ ngày {format(new Date(currentMonthStart), 'dd/MM/yyyy')} đến nay
                      </p>
                    </div>

                    {isLoadingAttendance ? (
                      <div className="space-y-4 animate-pulse">
                        <div className="grid grid-cols-3 gap-4">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-surface-container rounded-2xl" />
                          ))}
                        </div>
                        <div className="h-16 bg-surface-container rounded-2xl" />
                      </div>
                    ) : attendanceRecords.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
                        <TrendingUp className="w-10 h-10 text-on-surface-variant/40 mb-3" />
                        <span className="text-sm text-on-surface-variant font-bold">Chưa có dữ liệu điểm danh trong tháng</span>
                        <p className="text-xs text-on-surface-variant/70 mt-1 max-w-xs text-center font-medium">Các thống kê tỷ lệ đi học sẽ tự động được hiển thị khi giáo viên ghi nhận điểm danh mỗi ngày.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Summary Rate Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
                          <div className="bg-green-50/40 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 rounded-2xl p-4 shadow-sm">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Tỷ lệ đi học đầy đủ</span>
                            <div className="flex items-baseline gap-2 mt-1.5">
                              <span className="text-3xl font-bold font-playfair text-green-700 dark:text-green-400">{presentRate}%</span>
                              <span className="text-xs text-green-700/80 font-medium font-inter">({pCount} lượt)</span>
                            </div>
                          </div>

                          <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 shadow-sm">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">Tỷ lệ đi học trễ</span>
                            <div className="flex items-baseline gap-2 mt-1.5">
                              <span className="text-3xl font-bold font-playfair text-amber-700 dark:text-amber-400">{lateRate}%</span>
                              <span className="text-xs text-amber-700/80 font-medium font-inter">({lCount} lượt)</span>
                            </div>
                          </div>

                          <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4 shadow-sm">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 font-semibold">Tỷ lệ vắng/nghỉ</span>
                            <div className="flex items-baseline gap-2 mt-1.5">
                              <span className="text-3xl font-bold font-playfair text-rose-700 dark:text-rose-400">{absentRate}%</span>
                              <span className="text-xs text-rose-700/80 font-medium font-inter">({aCount + eCount + sCount} lượt)</span>
                            </div>
                          </div>
                        </div>

                        {/* Detail Breakdown Progress Bars */}
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
            ) : (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/20">
                <LayoutGrid className="w-12 h-12 text-on-surface-variant/40 mb-3 animate-pulse" />
                <h3 className="text-base font-bold text-on-surface mb-1">Chưa chọn lớp học</h3>
                <p className="text-sm text-on-surface-variant">Chọn một lớp ở thanh bên trái để xem thông tin chi tiết.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Class Form Modal */}
      {isFormOpen && (
        <ClassForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          classData={selectedClass}
          teachersList={teachersList}
        />
      )}

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
                Lớp hiện tại: <span className="font-semibold text-on-surface">{activeClass?.name}</span>
              </p>
            </div>

            <Select
              label="Chọn lớp chuyển đến"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn lớp học mới --' },
                ...classes
                  .filter((c) => c.id !== activeClassId)
                  .map((c) => ({ value: c.id, label: `${c.name} (Khối ${getGradeLabel(c.grade_level)})` })),
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
                Lớp hiện tại: <span className="font-semibold text-on-surface">{activeClass?.name}</span>
              </p>
            </div>

            <Select
              label="Chọn lớp chuyển đến"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn lớp học mới --' },
                ...classes
                  .filter((c) => c.id !== activeClassId)
                  .map((c) => ({ value: c.id, label: `${c.name} (Khối ${getGradeLabel(c.grade_level)})` })),
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

      {/* Delete Class Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Xóa lớp học?"
        message={`Bạn có chắc chắn muốn xóa lớp học "${selectedClass?.name}"? Mọi phân công giáo viên sẽ bị hủy bỏ. Học sinh trong lớp sẽ không còn thuộc lớp này.`}
        confirmText="Xóa lớp học"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
}
