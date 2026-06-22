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
  UserCheck, 
  LayoutGrid,
  Info,
  List,
  UserPlus,
  ArrowRight,
  Eye
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog, Table, type TableColumn, useSlidePanel } from "../components/ui";
import { ClassForm } from "../components/forms/ClassForm";
import { ClassDetailPanel } from "../components/details/ClassDetailPanel";
import { useAppStore } from "../stores/appStore";

export function Classes() {
  const queryClient = useQueryClient();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const { openPanel } = useSlidePanel();

  // View Mode: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Quick delete class state (confirm dialog at list level)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);

  // Search & waitlist state
  const [search, setSearch] = useState("");
  const [isUnassignedOpen, setIsUnassignedOpen] = useState(true);

  // 1. Fetch academic years list
  const { data: yearsResponse } = useQuery({
    queryKey: ['academic-years-list'],
    queryFn: () => api.getAll<any>('academic_years', { page: 1, pageSize: 100 })
  });
  const currentYearName = (yearsResponse?.data?.data as any[])?.find(y => y.id === selectedAcademicYearId)?.name || 'Năm học hiện tại';

  // 2. Fetch all teachers (needed for ClassForm)
  const { data: teachersResponse } = useQuery({
    queryKey: ['teachers-only-list'],
    queryFn: () => api.getAll<any>('users', { page: 1, pageSize: 100 }, { filters: { role: 'teacher', is_active: true } })
  });
  const teachersList = teachersResponse?.data?.data || [];

  // 3. Fetch all classes in selected academic year
  const { data: classesResponse, isLoading: isLoadingClasses, refetch: refetchClasses } = useQuery({
    queryKey: ['classes-list', selectedAcademicYearId],
    queryFn: () => {
      if (!selectedAcademicYearId) {
        return { data: { data: [], count: 0 }, error: null, count: 0 };
      }
      return api.getAll<any>(
        'classes',
        { page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' },
        { filters: { academic_year_id: selectedAcademicYearId } },
        '*, class_teachers(teacher_id, is_homeroom, users(full_name)), students(id)'
      );
    },
    enabled: !!selectedAcademicYearId,
  });
  const classes = classesResponse?.data?.data || [];

  // 4. Fetch unassigned students
  const { data: unassignedResponse, isLoading: isLoadingUnassigned, refetch: refetchUnassigned } = useQuery({
    queryKey: ['unassigned-students', selectedAcademicYearId],
    queryFn: () => api.getAll<any>(
      'students',
      { page: 1, pageSize: 200, sortBy: 'full_name', sortOrder: 'asc' },
      { filters: { class_id: null, status: 'active' } }
    ),
    enabled: !!selectedAcademicYearId,
  });
  const unassignedStudents = unassignedResponse?.data?.data || [];

  // Filter classes based on search
  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.room_number?.toLowerCase().includes(search.toLowerCase())
  );

  const confirmDelete = async () => {
    if (!selectedClass) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('classes', selectedClass.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa lớp học thành công!');
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi xóa lớp học', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
      setSelectedClass(null);
    }
  };

  const handleQuickAssign = async (student: any, classId: string, className: string) => {
    if (!classId) return;
    try {
      const res = await api.update('students', student.id, {
        class_id: classId,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      toast.success(`Đã xếp lớp thành công trẻ ${student.full_name} vào lớp ${className}!`);
      queryClient.invalidateQueries({ queryKey: ['students-in-class', classId] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-students'] });
    } catch (err: any) {
      toast.error('Lỗi khi xếp lớp nhanh', err.message || 'Lỗi hệ thống');
    }
  };

  // SlidePanel handlers
  const handleOpenDetail = (classId: string) => {
    openPanel({
      title: 'Chi tiết lớp học',
      icon: <BookOpen size={14} />,
      width: 850,
      component: (
        <ClassDetailPanel 
          classId={classId} 
          teachersList={teachersList}
          classesList={classes}
          onDeleteSuccess={() => refetchClasses()}
        />
      )
    });
  };

  const handleCreateClass = () => {
    openPanel({
      title: 'Tạo lớp học mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <ClassForm 
          teachersList={teachersList}
          onSuccess={() => refetchClasses()}
        />
      )
    });
  };

  const handleEditClass = (c: any) => {
    openPanel({
      title: 'Chỉnh sửa lớp học',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <ClassForm 
          classData={c}
          teachersList={teachersList}
          onSuccess={() => refetchClasses()}
        />
      )
    });
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

  // Table columns definition
  const tableColumns: TableColumn<any>[] = [
    {
      key: "name",
      header: "Tên lớp học",
      sortable: true,
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-on-surface text-[14px]">{row.name}</span>
        </div>
      )
    },
    {
      key: "grade_level",
      header: "Khối lớp",
      render: (row: any) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-container/40 text-on-secondary-container">
          Khối {getGradeLabel(row.grade_level)}
        </span>
      )
    },
    {
      key: "room_number",
      header: "Phòng học",
      render: (row: any) => row.room_number || <span className="text-on-surface-variant/40">—</span>
    },
    {
      key: "capacity",
      header: "Sĩ số",
      render: (row: any) => (
        <span className="font-semibold text-on-surface">
          {(row.students?.length || 0)} / {row.capacity} trẻ
        </span>
      )
    },
    {
      key: "homeroom_teacher",
      header: "Giáo viên chủ nhiệm",
      render: (row: any) => {
        const homeroom = row.class_teachers?.find((ct: any) => ct.is_homeroom)?.users?.full_name;
        return homeroom ? (
          <span className="font-semibold text-primary flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> {homeroom}
          </span>
        ) : <span className="text-on-surface-variant/40 italic">Chưa phân công</span>;
      }
    },
    {
      key: "actions" as any,
      header: "Thao tác",
      render: (row: any) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenDetail(row.id)}
            className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEditClass(row)}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
            title="Sửa lớp"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedClass(row);
              setIsDeleteDialogOpen(true);
            }}
            className="p-1.5 text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer"
            title="Xóa lớp"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12 space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[32px] md:text-[40px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Quản lý Lớp học</h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">
            Danh sách các lớp học, phân công giáo viên và quản lý học sinh theo lớp năm học {currentYearName}.
          </p>
        </div>
        <button
          onClick={handleCreateClass}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-5 py-2.5 rounded-xl text-[14px] font-semibold shadow-sm transition-all cursor-pointer"
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
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main list area */}
          <div className="flex-1 w-full space-y-6">
            
            {/* Filters */}
            <div className="bg-surface-container-lowest p-5 rounded-[32px] border border-outline-variant/30 shadow-sm flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-2 w-full md:w-80">
                <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Tìm kiếm</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên lớp, phòng học..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* View Mode Switcher Toggle */}
              <div className="bg-surface-container rounded-xl p-1 flex items-center border border-outline-variant/30 ml-auto select-none">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 rounded-lg transition-all cursor-pointer",
                    viewMode === 'grid' 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                  title="Xem dạng lưới"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  className={cn(
                    "p-2 rounded-lg transition-all cursor-pointer",
                    viewMode === 'table' 
                      ? "bg-white text-primary shadow-sm" 
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                  title="Xem dạng bảng"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List classes content */}
            {isLoadingClasses ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-44 rounded-[32px] bg-surface-container-low animate-pulse" />
                ))}
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline-variant/60 rounded-[32px] bg-surface-container-low/10 bg-white">
                <Home className="w-10 h-10 text-on-surface-variant/40 mb-3" />
                <span className="text-sm text-on-surface-variant font-bold">Không tìm thấy lớp học nào</span>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.map((c) => {
                  const homeroom = c.class_teachers?.find((ct: any) => ct.is_homeroom)?.users?.full_name || "Chưa phân công";
                  const teacherCount = c.class_teachers?.length || 0;
                  const studentCount = c.students?.length || 0;
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleOpenDetail(c.id)}
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between overflow-hidden cursor-pointer"
                    >
                      {/* Hover actions */}
                      <div className="absolute top-4 right-4 flex gap-1 bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm p-1 rounded-xl border border-outline-variant/30 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 select-none" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(c.id)}
                          className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditClass(c)}
                          className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                          title="Sửa lớp"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClass(c);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="p-1.5 text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer"
                          title="Xóa lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary-container/40 text-on-secondary-container border border-outline-variant/20">
                            Khối {getGradeLabel(c.grade_level)}
                          </span>
                          <h3 className="font-bold font-playfair text-[18px] text-on-surface mt-2 italic">{c.name}</h3>
                          <p className="text-xs text-on-surface-variant font-medium mt-1">
                            Phòng: <strong>{c.room_number || "---"}</strong> | Sức chứa: <strong>{c.capacity}</strong> trẻ
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-outline-variant/20 pt-4 mt-4 flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-4 h-4 text-primary shrink-0" />
                          CN: {homeroom}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-secondary shrink-0" />
                            {studentCount} trẻ
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-[32px] border border-outline-variant/30 p-6 shadow-sm overflow-hidden">
                <Table 
                  columns={tableColumns} 
                  data={filteredClasses} 
                  rowKey={(row) => row.id}
                  onRowClick={(row) => handleOpenDetail(row.id)}
                  emptyTitle="Không tìm thấy lớp học"
                  emptyDescription="Không có lớp học nào khớp với bộ lọc."
                />
              </div>
            )}
          </div>

          {/* Waitlist / Unassigned Students panel (col 4/1 flex) */}
          <div className="w-full lg:w-80 shrink-0 bg-white border border-outline-variant/40 rounded-[32px] overflow-hidden shadow-sm animate-in fade-in duration-300">
            <button
              type="button"
              onClick={() => setIsUnassignedOpen(!isUnassignedOpen)}
              className="w-full px-5 py-4 bg-surface-container-low/60 hover:bg-surface-container-low flex items-center justify-between font-bold text-xs uppercase tracking-wider text-on-surface-variant transition-all select-none border-b border-outline-variant/20 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <UserPlus className="w-4.5 h-4.5 text-primary" />
                Trẻ chưa xếp lớp ({unassignedStudents.length})
              </span>
            </button>

            {isUnassignedOpen && (
              <div className="p-4 space-y-2.5 max-h-[450px] overflow-y-auto bg-white/50">
                {isLoadingUnassigned ? (
                  <div className="space-y-2 py-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-10 rounded-xl bg-surface-container-low animate-pulse" />
                    ))}
                  </div>
                ) : unassignedStudents.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/70 italic text-center py-6 select-none font-medium">
                    Tất cả trẻ đã được xếp lớp!
                  </p>
                ) : (
                  unassignedStudents.map((student: any) => (
                    <div key={student.id} className="p-3 rounded-xl bg-surface-container-low/30 hover:bg-surface-container-low/60 border border-outline-variant/20 transition-all flex flex-col gap-2.5">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-on-surface truncate">{student.full_name}</p>
                        <p className="text-[10px] text-on-surface-variant/80 font-semibold mt-0.5">{student.student_code} | {student.gender === 'male' ? 'Nam' : 'Nữ'}</p>
                      </div>
                      
                      {classes.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                const selectedC = classes.find(c => c.id === e.target.value);
                                handleQuickAssign(student, e.target.value, selectedC?.name || "");
                              }
                            }}
                            className="flex-1 bg-white border border-outline-variant/50 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-primary cursor-pointer font-bold text-on-surface-variant"
                          >
                            <option value="">-- Xếp nhanh vào lớp --</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant/50 italic font-medium">Chưa có lớp học</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Class Confirmation (for quick delete from list) */}
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
