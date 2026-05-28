import { useState } from "react";
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
  Info
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog, Modal, Select } from "../components/ui";
import { ClassForm } from "../components/forms/ClassForm";
import { useAppStore } from "../stores/appStore";

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

  // Student transfer states
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);

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
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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

                {/* Students list */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-on-surface">
                      Danh sách học sinh hoạt động ({students.length})
                    </h3>
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
                          <tr className="bg-surface-container-low border-b border-outline-variant/30">
                            <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Mã HS</th>
                            <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Họ và tên</th>
                            <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Giới tính</th>
                            <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Ngày sinh</th>
                            <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20">
                          {students.map((student: any) => (
                            <tr key={student.id} className="hover:bg-surface-container-lowest/50 transition-all">
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
