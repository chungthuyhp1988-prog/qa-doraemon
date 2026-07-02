import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  ClipboardList, 
  Edit2,
  Trash2,
  BookOpen,
  UserCheck
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { ClassForm } from '../forms/ClassForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import type { ClassRow, StudentRow } from '../../types';

import { ClassStudentsTab } from './class/ClassStudentsTab';
import { ClassRollCallTab } from './class/ClassRollCallTab';
import { ClassScheduleTab } from './class/ClassScheduleTab';
import { ClassAttendanceStats } from './class/ClassAttendanceStats';

interface ClassWithTeachers extends ClassRow {
  class_teachers?: { teacher_id: string; is_homeroom: boolean; users?: { full_name: string } }[];
}

interface ClassDetailPanelProps {
  classId: string;
  teachersList: { id: string; full_name: string }[];
  classesList: { id: string; name: string; grade_level: string }[];
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

  // 1. Fetch Class detail
  const { data: classResponse, isLoading: isLoadingClass } = useQuery({
    queryKey: ['class-detail', classId],
    queryFn: () => api.getById('classes', classId, '*, class_teachers(id, teacher_id, is_homeroom, users(full_name))')
  });
  const activeClass = classResponse?.data as ClassWithTeachers | undefined;

  // 2. Fetch students in class
  const { data: studentsResponse, isLoading: isLoadingStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['students-in-class', classId],
    queryFn: () => api.getAll<StudentRow>('students', { page: 1, pageSize: 200, sortBy: 'full_name', sortOrder: 'asc' }, { filters: { class_id: classId, status: 'active' } }),
    enabled: !!classId
  });
  const students = studentsResponse?.data?.data || [];

  // Reset selected students when classId or activeTab changes
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [classId, activeTab]);

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
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa lớp học', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
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
          {activeClass.class_teachers?.map((ct) => (
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
            onClick={() => setActiveTab(tab.id as 'students' | 'rollcall' | 'schedule' | 'attendance')}
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
        {activeTab === 'students' && (
          <ClassStudentsTab
            classId={classId}
            className={activeClass.name}
            students={students}
            isLoadingStudents={isLoadingStudents}
            classesList={classesList}
            selectedStudentIds={selectedStudentIds}
            setSelectedStudentIds={setSelectedStudentIds}
            refetchStudents={refetchStudents}
            getGradeLabel={getGradeLabel}
          />
        )}

        {activeTab === 'rollcall' && (
          <ClassRollCallTab
            classId={classId}
            students={students}
            currentUserId={currentUserId}
            getInitials={getInitials}
          />
        )}

        {activeTab === 'schedule' && (
          <ClassScheduleTab
            gradeLevel={activeClass.grade_level}
            getGradeLabel={getGradeLabel}
          />
        )}

        {activeTab === 'attendance' && (
          <ClassAttendanceStats
            classId={classId}
          />
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
    </div>
  );
};
