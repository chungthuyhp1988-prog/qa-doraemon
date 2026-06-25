import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Mail,
  Briefcase,
  Edit2, 
  Trash2, 
  Shield,
  Layers,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { TeacherForm } from '../forms/TeacherForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

interface TeacherDetailPanelProps {
  teacherId: string;
  classesList: any[];
  onDeleteSuccess?: () => void;
}

export const TeacherDetailPanel: React.FC<TeacherDetailPanelProps> = ({
  teacherId,
  classesList,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();
  const [activeTab, setActiveTab] = useState<'profile' | 'classes'>('profile');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch Teacher Detail
  const { data: teacherResponse, isLoading: isLoadingTeacher } = useQuery({
    queryKey: ['teacher-detail', teacherId],
    queryFn: () => api.getById('users', teacherId, '*, class_teachers(id, class_id, classes(name, grade_level))')
  });
  const teacher = teacherResponse?.data as any;

  const handleEdit = () => {
    if (!teacher) return;
    openPanel({
      title: 'Chỉnh sửa nhân sự',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <TeacherForm 
          teacher={teacher} 
          classesList={classesList} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['teacher-detail', teacherId] });
            queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
          }}
        />
      )
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.remove('users', teacherId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa nhân sự thành công!');
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setIsDeleteDialogOpen(false);
      closePanel();
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa nhân sự', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
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

  // Helper to get initials
  const getInitials = (name: string) => {
    if (!name) return "GV";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Helper to map role to display text & styles
  const getRoleBadge = (role: string, jobTitle: string) => {
    const title = jobTitle || (role === 'admin' ? 'Ban giám hiệu' : role === 'staff' ? 'Nhân viên' : 'Giáo viên');
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] bg-red-50 text-red-700 border border-red-200 font-bold uppercase tracking-wider">
            {title}
          </span>
        );
      case 'staff':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-200 font-bold uppercase tracking-wider">
            {title}
          </span>
        );
      case 'teacher':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase tracking-wider">
            {title}
          </span>
        );
    }
  };

  const getGradeName = (level: string) => {
    switch (level) {
      case 'nha_tre': return 'Nhà trẻ';
      case 'mam': return 'Mầm';
      case 'choi': return 'Chồi';
      case 'la': return 'Lá';
      default: return level;
    }
  };

  if (isLoadingTeacher) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 animate-pulse space-y-4">
        <div className="w-16 h-16 bg-surface-container rounded-full" />
        <div className="h-4 bg-surface-container rounded w-1/3" />
        <div className="h-3 bg-surface-container rounded w-1/4" />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy thông tin nhân sự.
      </div>
    );
  }

  const assignedClasses = teacher.class_teachers || [];

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      
      {/* ═══ DETAIL HEADER ═══ */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-full overflow-hidden border-2 border-primary/20 p-0.5 shrink-0 shadow-inner flex items-center justify-center">
            {teacher.avatar_url ? (
              <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-[20px] font-black text-primary font-playfair">
                {getInitials(teacher.full_name)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
                {teacher.full_name}
              </h2>
              {getRoleBadge(teacher.role, teacher.job_title)}
              {(() => {
                const workStatus = teacher.work_status || (teacher.is_active === false ? 'inactive' : 'active');
                let badgeClass = "bg-gray-50 text-gray-600 border-gray-200";
                let text = "Đã nghỉ việc";
                switch (workStatus) {
                  case 'active':
                    badgeClass = "bg-green-50 text-green-700 border-green-200";
                    text = "Đang làm việc";
                    break;
                  case 'maternity_leave':
                    badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                    text = "Nghỉ thai sản";
                    break;
                  case 'on_leave':
                    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                    text = "Nghỉ phép";
                    break;
                  case 'inactive':
                  default:
                    badgeClass = "bg-red-50 text-red-700 border-red-200";
                    text = "Đã nghỉ việc";
                    break;
                }
                return (
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border tracking-wider",
                    badgeClass
                  )}>
                    {text}
                  </span>
                );
              })()}
            </div>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1.5 select-all">
              {teacher.email}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleEdit}
            variant="outline"
            size="sm"
            className="rounded-xl flex items-center gap-1 cursor-pointer text-xs"
          >
            <Edit2 className="w-3.5 h-3.5" /> Sửa
          </Button>
          <Button
            onClick={() => setIsDeleteDialogOpen(true)}
            variant="outline"
            size="sm"
            className="rounded-xl border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 flex items-center gap-1 cursor-pointer text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Xóa
          </Button>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex px-4 border-b border-outline-variant/20 bg-white shrink-0">
        {[
          { id: 'profile', label: 'Thông tin cá nhân', icon: User },
          { id: 'classes', label: 'Lớp phụ trách', icon: Layers, enabled: teacher.role === 'teacher' }
        ].filter(tab => tab.enabled !== false).map(tab => (
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
        
        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
            <div>
              <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 mb-3">Lý lịch nhân sự</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-[13.5px]">
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Họ và tên</div>
                  <div className="text-on-surface font-semibold">{teacher.full_name}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Ngày sinh</div>
                  <div className="text-on-surface font-semibold">{formatDate(teacher.date_of_birth)}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Số điện thoại</div>
                  <div className="text-on-surface font-semibold select-all">{teacher.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Email liên hệ</div>
                  <div className="text-on-surface font-semibold select-all">{teacher.email}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Địa chỉ liên hệ</div>
                  <div className="text-on-surface font-semibold leading-relaxed">{teacher.address || 'Chưa cập nhật'}</div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 mb-3">Thông tin công việc</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-[13.5px]">
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Vai trò hệ thống</div>
                  <div className="text-on-surface font-semibold capitalize">{teacher.role === 'admin' ? 'Quản trị viên / BGH' : teacher.role === 'staff' ? 'Nhân viên văn phòng / tổ bếp' : 'Giáo viên'}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Chức vụ hiển thị</div>
                  <div className="text-on-surface font-semibold">{teacher.job_title || '—'}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Ngày cập nhật hồ sơ</div>
                  <div className="text-on-surface font-semibold">{formatDate(teacher.updated_at)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CLASSES TAB ── */}
        {activeTab === 'classes' && (
          <div className="space-y-4 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
            <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 mb-3">Danh sách các lớp phụ trách</h4>
            
            {assignedClasses.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-outline-variant rounded-2xl text-on-surface-variant space-y-2">
                <Layers className="w-8 h-8 mx-auto text-on-surface-variant/40" />
                <p className="text-[13px] font-bold">Chưa phân công phụ trách lớp</p>
                <p className="text-[11px] text-on-surface-variant/80 px-4">Nhân sự này chưa được gán phụ trách bất kỳ lớp học nào.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignedClasses.map((ct: any) => (
                  <div 
                    key={ct.id} 
                    className="border border-outline-variant/30 p-4 rounded-xl flex items-center justify-between bg-surface-container-low hover:border-primary/30 transition-all shadow-2xs"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-[14px] text-on-surface">
                        Lớp {ct.classes?.name}
                      </span>
                      <span className="text-[11px] text-on-surface-variant/80 font-semibold mt-0.5">
                        Khối: {getGradeName(ct.classes?.grade_level)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-extrabold uppercase tracking-wider">
                      Giảng dạy
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Xóa hồ sơ nhân sự"
        message={`Bạn có chắc chắn muốn xóa nhân sự ${teacher.full_name}? Hành động này sẽ xóa vĩnh viễn hồ sơ và quyền truy cập của nhân viên.`}
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
