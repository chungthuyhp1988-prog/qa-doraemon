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
  Eye
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog, Table, type TableColumn, useSlidePanel, ErrorState } from "../components/ui";
import { ClassForm } from "../components/forms/ClassForm";
import { ClassDetailPanel } from "../components/details/ClassDetailPanel";
import { useAppStore } from "../stores/appStore";
import type { ClassRow, AcademicYearRow, UserRow, ClassTeacherRow } from "../types";

/** ClassRow extended with joined relations from the API select query */
interface ClassWithRelations extends ClassRow {
  class_teachers?: (Pick<ClassTeacherRow, 'teacher_id' | 'is_homeroom'> & { users?: Pick<UserRow, 'full_name'> })[];
  students?: { id: string }[];
}

export function Classes() {
  const queryClient = useQueryClient();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const { openPanel } = useSlidePanel();

  // View Mode: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Quick delete class state (confirm dialog at list level)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassWithRelations | null>(null);

  // Search state
  const [search, setSearch] = useState("");

  // 1. Fetch academic years list
  const { data: yearsResponse } = useQuery({
    queryKey: ['academic-years-list'],
    queryFn: () => api.getAll<AcademicYearRow>('academic_years', { page: 1, pageSize: 100 })
  });
  const currentYearName = yearsResponse?.data?.data?.find(y => y.id === selectedAcademicYearId)?.name || 'Năm học hiện tại';

  // 2. Fetch all teachers (needed for ClassForm)
  const { data: teachersResponse } = useQuery({
    queryKey: ['teachers-only-list'],
    queryFn: () => api.getAll<UserRow>('users', { page: 1, pageSize: 100 }, { filters: { role: 'teacher', is_active: true } })
  });
  const teachersList = teachersResponse?.data?.data || [];

  // 3. Fetch all classes in selected academic year
  const { data: classesResponse, isLoading: isLoadingClasses, isError: isErrorClasses, refetch: refetchClasses } = useQuery({
    queryKey: ['classes-list', selectedAcademicYearId],
    queryFn: () => {
      if (!selectedAcademicYearId) {
        return { data: { data: [], count: 0 }, error: null, count: 0 };
      }
      return api.getAll<ClassWithRelations>(
        'classes',
        { page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'asc' },
        { filters: { academic_year_id: selectedAcademicYearId } },
        '*, class_teachers(teacher_id, is_homeroom, users(full_name)), students(id)'
      );
    },
    enabled: !!selectedAcademicYearId,
  });
  const rawClasses = classesResponse?.data?.data || [];

  // Helper to get group name priority (Dorami = 1, Shizuka = 2, Nobita = 3, Doraemon = 4, Khác = 5)
  const getClassPriority = (className: string): number => {
    const nameLower = (className || '').toLowerCase();
    if (nameLower.includes('dorami')) return 1;
    if (nameLower.includes('shizuka')) return 2;
    if (nameLower.includes('nobita')) return 3;
    if (nameLower.includes('doraemon')) return 4;
    return 5;
  };

  const classes = [...rawClasses].sort((a, b) => {
    const priA = getClassPriority(a.name);
    const priB = getClassPriority(b.name);
    if (priA !== priB) return priA - priB;
    return a.name.localeCompare(b.name, 'vi', { numeric: true });
  });

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
    } catch (err) {
      toast.error('Lỗi khi xóa lớp học', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
      setSelectedClass(null);
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

  const handleEditClass = (c: ClassWithRelations) => {
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

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'nha_tre': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-amber-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Khối Nhà trẻ</span>;
      case 'mam': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Khối Mầm</span>;
      case 'choi': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-sky-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Khối Chồi</span>;
      case 'la': 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-indigo-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Khối Lá</span>;
      default: 
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-slate-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Khối {grade}</span>;
    }
  };

  // Table columns definition
  const tableColumns: TableColumn<ClassWithRelations>[] = [
    {
      key: "name",
      header: "Tên lớp học",
      sortable: true,
      render: (row: ClassWithRelations) => (
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
      render: (row: ClassWithRelations) => getGradeBadge(row.grade_level)
    },
    {
      key: "room_number",
      header: "Phòng học",
      render: (row: ClassWithRelations) => row.room_number || <span className="text-on-surface-variant/40">—</span>
    },
    {
      key: "capacity",
      header: "Sĩ số",
      render: (row: ClassWithRelations) => (
        <span className="font-semibold text-on-surface">
          {(row.students?.length || 0)} / {row.capacity} trẻ
        </span>
      )
    },
    {
      key: "homeroom_teacher" as keyof ClassWithRelations & string,
      header: "Giáo viên chủ nhiệm",
      render: (row: ClassWithRelations) => {
        const homeroom = row.class_teachers?.find(ct => ct.is_homeroom)?.users?.full_name;
        return homeroom ? (
          <span className="font-semibold text-primary flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> {homeroom}
          </span>
        ) : <span className="text-on-surface-variant/40 italic">Chưa phân công</span>;
      }
    },
    {
      key: "actions" as keyof ClassWithRelations & string,
      header: "Thao tác",
      render: (row: ClassWithRelations) => (
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
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12 space-y-4">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Quản lý Lớp học</h2>
          <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1">
            Danh sách các lớp học, phân công giáo viên và quản lý học sinh theo lớp năm học {currentYearName}.
          </p>
        </div>
        <button
          onClick={handleCreateClass}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl text-[13px] font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
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
        <div className="w-full space-y-6">
            
            {/* Filters */}
            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-wrap gap-3.5 items-center">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Tìm theo tên lớp, phòng học..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
                />
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
            ) : isErrorClasses ? (
              <ErrorState onRetry={refetchClasses} />
            ) : filteredClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline-variant/60 rounded-2xl bg-surface">
                <Home className="w-10 h-10 text-on-surface-variant/40 mb-3" />
                <span className="text-sm text-on-surface-variant font-bold">Không tìm thấy lớp học nào</span>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.map((c) => {
                  const homeroom = c.class_teachers?.find(ct => ct.is_homeroom)?.users?.full_name || "Chưa phân công";
                  const teacherCount = c.class_teachers?.length || 0;
                  const studentCount = c.students?.length || 0;
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleOpenDetail(c.id)}
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between overflow-hidden cursor-pointer"
                    >
                      {/* Hover actions */}
                      <div className="absolute top-4 right-4 flex gap-1.5 bg-white border border-outline-variant/60 shadow-md p-1 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 select-none" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetail(c.id)}
                          className="p-1.5 text-on-surface-variant hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditClass(c)}
                          className="p-1.5 text-on-surface-variant hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Sửa lớp"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClass(c);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="p-1.5 text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div>
                          {getGradeBadge(c.grade_level)}
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
              <Table 
                className="rounded-2xl border border-outline-variant/30 shadow-sm bg-surface"
                columns={tableColumns} 
                data={filteredClasses} 
                rowKey={(row) => row.id}
                onRowClick={(row) => handleOpenDetail(row.id)}
                emptyTitle="Không tìm thấy lớp học"
                emptyDescription="Không có lớp học nào khớp với bộ lọc."
              />
            )}
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
