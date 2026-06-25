import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  HeartPulse, 
  DollarSign, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  BadgeIcon as IdCard,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { StudentForm } from '../forms/StudentForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

interface StudentDetailPanelProps {
  studentId: string;
  classesList: any[];
  onDeleteSuccess?: () => void;
}

export const StudentDetailPanel: React.FC<StudentDetailPanelProps> = ({
  studentId,
  classesList,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();
  const [activeTab, setActiveTab] = useState<'profile' | 'health' | 'finance'>('profile');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch Student Detail
  const { data: studentResponse, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['student-detail', studentId],
    queryFn: () => api.getById('students', studentId, '*, classes(name, grade_level), guardians(*)')
  });
  const student = studentResponse?.data as any;

  // 2. Fetch tuition fees for finance tab
  const { data: feesResponse, isLoading: isLoadingFees } = useQuery({
    queryKey: ['tuition_fees_detail', studentId],
    queryFn: () => api.getAll(
      'tuition_fees', 
      { page: 1, pageSize: 12 }, 
      { filters: { student_id: studentId } },
      '*, academic_years(name)'
    ),
    enabled: !!studentId && activeTab === 'finance'
  });
  const feesList = feesResponse?.data?.data || [];

  const handleEdit = () => {
    if (!student) return;
    openPanel({
      title: 'Chỉnh sửa học sinh',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <StudentForm 
          student={student} 
          classesList={classesList} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['student-detail', studentId] });
            queryClient.invalidateQueries({ queryKey: ['students-list'] });
          }}
        />
      )
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.softDelete('students', studentId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa hồ sơ học sinh thành công!');
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      setIsDeleteDialogOpen(false);
      closePanel();
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa học sinh', err.message || 'Lỗi hệ thống');
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

  if (isLoadingStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 animate-pulse space-y-4">
        <div className="w-16 h-16 bg-surface-container rounded-full" />
        <div className="h-4 bg-surface-container rounded w-1/3" />
        <div className="h-3 bg-surface-container rounded w-1/4" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy thông tin học sinh.
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-green-50 text-green-700 border border-green-200 font-bold uppercase tracking-wider">Đang học</span>;
      case 'registered':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-purple-50 text-purple-700 border border-purple-200 font-bold uppercase tracking-wider">Đã ghi danh</span>;
      case 'waiting':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase tracking-wider">Đăng ký chờ</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase tracking-wider">Tạm nghỉ</span>;
      case 'graduated':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase tracking-wider">Tốt nghiệp</span>;
      case 'transferred':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-gray-50 text-gray-600 border border-gray-200 font-bold uppercase tracking-wider">Chuyển trường</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-gray-50 text-gray-600 border border-gray-200 font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      
      {/* ═══ DETAIL HEADER ═══ */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-full overflow-hidden border-2 border-primary/20 p-0.5 shrink-0 shadow-inner">
            {student.profile_image_url ? (
              <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-[20px] font-black text-primary">
                {student.full_name.substring(0, 1)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
                {student.full_name}
              </h2>
              {getStatusBadge(student.status)}
            </div>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Mã HS: {student.student_code} • Lớp: {student.classes?.name || 'Chưa xếp lớp'}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleEdit}
            className="w-8 h-8 border border-outline-variant/60 rounded-xl flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title="Chỉnh sửa hồ sơ"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDeleteDialogOpen(true)}
            className="w-8 h-8 border border-rose-200 rounded-xl flex items-center justify-center text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer"
            title="Xóa học sinh"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex px-4 border-b border-outline-variant/20 bg-white shrink-0">
        {[
          { id: 'profile', label: 'Hồ sơ', icon: User },
          { id: 'health', label: 'Y tế & Sức khỏe', icon: HeartPulse },
          { id: 'finance', label: 'Tài chính học phí', icon: DollarSign }
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
        
        {/* ── PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in bg-white dark:bg-surface-container-low p-5 rounded-2xl border border-outline-variant/40 dark:border-outline-variant/20 shadow-xs">
            <div>
              <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 mb-3">Thông tin trẻ</h4>
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-[13.5px]">
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Ngày sinh</div>
                  <div className="text-on-surface font-semibold">{formatDate(student.date_of_birth)}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Giới tính</div>
                  <div className="text-on-surface font-semibold">{student.gender === 'male' ? 'Nam' : 'Nữ'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Địa chỉ liên hệ</div>
                  <div className="text-on-surface font-semibold leading-relaxed">{student.address || 'Chưa cập nhật'}</div>
                </div>
                <div>
                  <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Ngày nhập học</div>
                  <div className="text-on-surface font-semibold">{formatDate(student.enrollment_date)}</div>
                </div>
                {(student.status === 'waiting' || student.status === 'registered') && (
                  <>
                    <div>
                      <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">
                        {student.status === 'waiting' ? 'Ngày đăng ký chờ' : 'Ngày ghi danh'}
                      </div>
                      <div className="text-on-surface font-semibold">{formatDate(student.registration_date) || '—'}</div>
                    </div>
                    <div>
                      <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Năm học đăng ký</div>
                      <div className="text-on-surface font-semibold">{student.target_school_year || '—'}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider mb-0.5">Đối tượng ưu tiên</div>
                      <div className="text-on-surface font-semibold">{student.priority_status || 'Không'}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 mb-3">Gia đình phụ huynh</h4>
              <div className="space-y-3">
                {student.guardians?.map((guardian: any) => (
                  <div key={guardian.id} className="bg-surface-container-low border border-outline-variant/30 p-4 rounded-xl flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-on-surface text-[14px]">
                        {guardian.full_name}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider",
                        guardian.is_primary 
                          ? "bg-green-50 text-green-700 border-green-200" 
                          : "bg-surface-container text-on-surface-variant border-outline-variant"
                      )}>
                        {guardian.relationship === 'me' ? 'Mẹ' : guardian.relationship === 'cha' ? 'Bố' : guardian.relationship === 'ong' ? 'Ông' : guardian.relationship === 'ba' ? 'Bà' : 'Người giám hộ'}
                        {guardian.is_primary && ' • Liên hệ chính'}
                      </span>
                    </div>
                    <div className="text-[13px] text-on-surface-variant font-semibold flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                      Điện thoại: {guardian.phone}
                    </div>
                    {guardian.citizen_id && (
                      <div className="text-[12px] text-on-surface-variant/80 font-medium pl-5">
                        CCCD / CMND: <span className="font-mono">{guardian.citizen_id}</span>
                      </div>
                    )}
                    {guardian.email && (
                      <div className="text-[12px] text-on-surface-variant/80 font-medium pl-5">
                        Email: {guardian.email}
                      </div>
                    )}
                    {guardian.occupation && (
                      <div className="text-[12px] text-on-surface-variant/80 font-medium pl-5">
                        Nghề nghiệp: {guardian.occupation}
                      </div>
                    )}
                  </div>
                ))}
                {(!student.guardians || student.guardians.length === 0) && (
                  <p className="text-xs text-on-surface-variant/70 italic">Chưa cập nhật thông tin phụ huynh.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── HEALTH TAB ── */}
        {activeTab === 'health' && (
          <div className="space-y-6 animate-fade-in bg-white dark:bg-surface-container-low p-5 rounded-2xl border border-outline-variant/40 dark:border-outline-variant/20 shadow-xs">
            <div>
              <h4 className="text-[13px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider border-b border-red-100 dark:border-red-900/30 pb-2 mb-3.5 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Lưu ý sức khỏe đặc biệt
              </h4>
              <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center text-[13.5px]">
                  <span className="text-on-surface-variant font-bold">Dị ứng thức ăn / thuốc:</span>
                  <span className={cn(
                    "font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider border",
                    student.allergies 
                      ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30" 
                      : "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/30"
                  )}>
                    {student.allergies || 'Không dị ứng'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-[13.5px]">
                  <span className="text-on-surface-variant font-bold">Ghi chú y tế:</span>
                  <span className="font-semibold text-on-surface mt-0.5 leading-relaxed bg-white dark:bg-surface-container border border-outline-variant/30 dark:border-outline-variant/20 p-3 rounded-xl">
                    {student.medical_notes || 'Sức khỏe bình thường, không có bệnh nền hoặc lưu ý đặc biệt.'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-[13px] font-extrabold text-primary dark:text-blue-400 uppercase tracking-wider border-b border-outline-variant/20 dark:border-outline-variant/10 pb-2 mb-3">Lịch sử tăng trưởng & Phát triển</h4>
              <p className="text-[13px] text-on-surface-variant font-medium leading-relaxed bg-surface-container-low dark:bg-surface-container p-4 border border-outline-variant/30 dark:border-outline-variant/20 rounded-xl">
                Thông tin cân nặng, chiều cao và sự tăng trưởng của trẻ được lưu trữ và cập nhật chi tiết trong phân hệ **Sức Khỏe**.
              </p>
            </div>
          </div>
        )}

        {/* ── FINANCE TAB ── */}
        {activeTab === 'finance' && (
          <div className="space-y-4 animate-fade-in bg-white dark:bg-surface-container-low p-5 rounded-2xl border border-outline-variant/40 dark:border-outline-variant/20 shadow-xs">
            <h4 className="text-[13px] font-extrabold text-primary dark:text-blue-400 uppercase tracking-wider border-b border-outline-variant/20 dark:border-outline-variant/10 pb-2 mb-3">Học phí & các khoản thu</h4>
            
            {isLoadingFees ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-12 bg-surface-container rounded-xl" />
                <div className="h-12 bg-surface-container rounded-xl" />
              </div>
            ) : feesList.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-outline-variant rounded-2xl text-on-surface-variant space-y-2">
                <DollarSign className="w-8 h-8 mx-auto text-on-surface-variant/40" />
                <p className="text-[13px] font-bold">Chưa có thông tin học phí</p>
                <p className="text-[11px] text-on-surface-variant/80 px-4">Bản ghi thu học phí sẽ hiển thị khi phòng kế toán lập phiếu thu cho học sinh.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {feesList.map((fee: any) => {
                  const isPaid = fee.status === 'paid';
                  const isPartial = fee.status === 'partial';
                  const isOverdue = fee.status === 'overdue';
                  
                  return (
                    <div 
                      key={fee.id} 
                      className={cn(
                        "border p-4 rounded-xl flex flex-col gap-2 transition-all",
                        isPaid 
                          ? "bg-green-50/20 border-green-200" 
                          : isOverdue 
                            ? "bg-red-50/20 border-red-200" 
                            : "bg-surface-container-low border-outline-variant/30"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-bold text-[14px] text-on-surface">
                            Học phí Tháng {fee.month}/{fee.year}
                          </span>
                          <div className="text-[11px] text-on-surface-variant/70 font-bold mt-0.5">
                            Năm học: {fee.academic_years?.name}
                          </div>
                        </div>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                          isPaid ? "bg-green-100 text-green-700 border-green-200" 
                            : isPartial ? "bg-amber-100 text-amber-700 border-amber-200"
                            : isOverdue ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        )}>
                          {isPaid ? 'Đã đóng' : isPartial ? 'Một phần' : isOverdue ? 'Quá hạn' : 'Chưa đóng'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[12px] mt-1 text-on-surface-variant font-medium">
                        <div className="flex justify-between border-b border-outline-variant/10 pb-0.5">
                          <span>Học phí cơ bản:</span>
                          <span className="font-bold text-on-surface">{(fee.base_amount || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className="flex justify-between border-b border-outline-variant/10 pb-0.5">
                          <span>Tiền ăn:</span>
                          <span className="font-bold text-on-surface">{(fee.meal_amount || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className="flex justify-between border-b border-outline-variant/10 pb-0.5">
                          <span>Dịch vụ thêm:</span>
                          <span className="font-bold text-on-surface">{(fee.extra_amount || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className="flex justify-between border-b border-outline-variant/10 pb-0.5">
                          <span>Miễn giảm:</span>
                          <span className="font-bold text-on-surface">-{(fee.discount || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div className="col-span-2 flex justify-between pt-1 text-[13px] font-bold text-on-surface">
                          <span className="text-primary font-bold">Tổng số tiền:</span>
                          <span className="text-primary font-bold">{(fee.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                        {fee.paid_amount > 0 && (
                          <div className="col-span-2 flex justify-between text-[12px] font-bold text-green-700">
                            <span>Đã đóng:</span>
                            <span>{fee.paid_amount.toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                      </div>
                      {fee.note && (
                        <p className="text-[11px] text-on-surface-variant/80 italic mt-1 font-semibold bg-white/70 p-2 rounded border border-outline-variant/15">
                          Ghi chú: {fee.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Xóa hồ sơ học sinh"
        message={`Bạn có chắc chắn muốn xóa học sinh ${student.full_name}? Dữ liệu sẽ được đánh dấu ẩn khỏi hệ thống.`}
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
