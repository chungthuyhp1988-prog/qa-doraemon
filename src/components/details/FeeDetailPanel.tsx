import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Calendar, 
  DollarSign, 
  FileText,
  UserCheck,
  Clock,
  Printer,
  Check,
  MessageCircle,
  Edit2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { FeeForm } from '../forms/FeeForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';
import { zalo } from '../../lib/zalo';
import type { TuitionFeeRow, StudentRow, GuardianRow } from '../../types/database';

interface FeeWithJoins extends TuitionFeeRow {
  students?: StudentRow & { classes?: { name: string } | null; guardians?: GuardianRow[] };
  users?: { full_name: string };
}

interface FeeDetailPanelProps {
  feeId: string;
  onDeleteSuccess?: () => void;
}

export const FeeDetailPanel: React.FC<FeeDetailPanelProps> = ({
  feeId,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingZalo, setIsSendingZalo] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // 1. Fetch Tuition Fee detail
  const { data: feeResponse, isLoading: isLoadingFee } = useQuery({
    queryKey: ['fee-detail', feeId],
    queryFn: () => api.getById('tuition_fees', feeId, '*, students(id, full_name, student_code, classes(name), guardians(*)), users(full_name)')
  });
  const fee = feeResponse?.data as FeeWithJoins | undefined;

  const handleEdit = () => {
    if (!fee) return;
    openPanel({
      title: 'Chỉnh sửa phiếu thu',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <FeeForm 
          fee={fee} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['fee-detail', feeId] });
            queryClient.invalidateQueries({ queryKey: ['tuition-fees-list'] });
          }}
        />
      )
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.remove('tuition_fees', feeId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa phiếu thu học phí thành công!');
      queryClient.invalidateQueries({ queryKey: ['tuition-fees-list'] });
      setIsDeleteDialogOpen(false);
      closePanel();
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa phiếu thu', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!fee) return;
    setIsMarkingPaid(true);
    try {
      const res = await api.update('tuition_fees', feeId, {
        paid_amount: fee.total_amount,
        status: 'paid',
        paid_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);
      toast.success('Đã xác nhận thu đủ học phí!');
      queryClient.invalidateQueries({ queryKey: ['fee-detail', feeId] });
      queryClient.invalidateQueries({ queryKey: ['tuition-fees-list'] });
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi cập nhật thanh toán', err.message || 'Lỗi hệ thống');
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleZaloReminder = async () => {
    if (!fee) return;
    const primaryGuardian = fee.students?.guardians?.find((g: GuardianRow) => g.is_primary) || fee.students?.guardians?.[0];
    const phone = primaryGuardian?.phone;
    const studentName = fee.students?.full_name || 'Học sinh';

    if (!phone) {
      toast.error('Không thể nhắc nợ', `Học sinh ${studentName} chưa cập nhật số điện thoại phụ huynh.`);
      return;
    }

    setIsSendingZalo(true);
    try {
      const remaining = Number(fee.total_amount) - Number(fee.paid_amount);
      const res = await zalo.sendFeeReminder(phone, studentName, remaining, fee.month);
      if (res.success) {
        toast.success(`Đã gửi tin nhắn nhắc nợ qua Zalo OA đến phụ huynh của em ${studentName} (${phone})`);
      } else {
        throw new Error(res.error || 'Lỗi gửi tin nhắn');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi gửi Zalo OA', err.message || 'Lỗi kết nối');
    } finally {
      setIsSendingZalo(false);
    }
  };

  const handlePrint = () => {
    window.print();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold uppercase tracking-wider">
            Đã đóng
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider">
            Đóng một phần
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold uppercase tracking-wider">
            Quá hạn
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold uppercase tracking-wider">
            Chờ thanh toán
          </span>
        );
    }
  };

  if (isLoadingFee) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 animate-pulse space-y-4">
        <div className="w-16 h-16 bg-surface-container rounded-full" />
        <div className="h-4 bg-surface-container rounded w-1/3" />
        <div className="h-3 bg-surface-container rounded w-1/4" />
      </div>
    );
  }

  if (!fee) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy thông tin phiếu thu học phí.
      </div>
    );
  }

  const hasPhone = !!(fee.students?.guardians?.find((g: GuardianRow) => g.is_primary)?.phone || fee.students?.guardians?.[0]?.phone);

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none printable-panel">
      
      {/* ═══ DETAIL HEADER ═══ */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs non-printable">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl overflow-hidden border border-primary/20 shrink-0 flex items-center justify-center text-primary">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
                Phiếu thu học phí tháng {fee.month}/{fee.year}
              </h2>
              {getStatusBadge(fee.status)}
            </div>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Học sinh: {fee.students?.full_name} ({fee.students?.student_code}) • Lớp: {fee.students?.classes?.name || 'Chưa xếp lớp'}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            className="rounded-xl flex items-center gap-1 cursor-pointer text-xs"
          >
            <Printer className="w-3.5 h-3.5" /> In phiếu
          </Button>
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

      {/* Quick Reminder & Confirm Actions (Non-printable) */}
      {fee.status !== 'paid' && (
        <div className="px-6 py-4 bg-slate-50 border-b border-outline-variant/20 flex gap-3 shrink-0 non-printable">
          <Button
            onClick={handleMarkPaid}
            loading={isMarkingPaid}
            disabled={isMarkingPaid}
            className="flex-1 rounded-xl bg-green-600 text-white hover:bg-green-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer py-2.5"
          >
            <Check className="w-4 h-4" /> Xác nhận đã thu đủ học phí
          </Button>
          <Button
            onClick={handleZaloReminder}
            loading={isSendingZalo}
            disabled={isSendingZalo || !hasPhone}
            variant="outline"
            className={cn(
              "flex-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 py-2.5",
              hasPhone 
                ? "text-blue-700 border-blue-200 hover:bg-blue-50/50" 
                : "text-slate-400 border-slate-200/50 cursor-not-allowed opacity-50 bg-slate-50"
            )}
            title={hasPhone ? "Gửi nhắc nhở học phí qua Zalo OA của trường" : "Chưa đăng ký số điện thoại phụ huynh"}
          >
            <MessageCircle className="w-4 h-4" /> Nhắc nợ qua Zalo
          </Button>
        </div>
      )}

      {/* ═══ PRINTABLE INVOICE / DETAIL ═══ */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 printable-content">
        
        {/* School Invoice Header (Prints nicely) */}
        <div className="bg-white p-6 rounded-2xl border border-outline-variant/40 shadow-xs space-y-6">
          <div className="flex justify-between items-start pb-4 border-b border-outline-variant/20">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-primary">TRƯỜNG MẦM NON DORAEMON</h3>
              <p className="text-[10px] text-on-surface-variant font-medium mt-1">Đường 3/2, Quận 10, TP. Hồ Chí Minh</p>
              <p className="text-[10px] text-on-surface-variant font-medium">Hotline: 0909 123 456</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-on-surface-variant/80 uppercase tracking-wider block">HÓA ĐƠN HỌC PHÍ</span>
              <span className="text-xs font-mono font-bold text-primary mt-1 block">#FP-{fee.id?.substring(0, 8).toUpperCase()}</span>
            </div>
          </div>

          {/* Student Profile Info */}
          <div>
            <h4 className="text-[12px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-3">1. Thông tin học sinh</h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[13.5px]">
              <div>
                <span className="text-on-surface-variant/70 text-xs block">Họ và tên trẻ:</span>
                <span className="font-bold text-on-surface">{fee.students?.full_name}</span>
              </div>
              <div>
                <span className="text-on-surface-variant/70 text-xs block">Mã học sinh:</span>
                <span className="font-bold text-on-surface">{fee.students?.student_code}</span>
              </div>
              <div>
                <span className="text-on-surface-variant/70 text-xs block">Lớp học:</span>
                <span className="font-bold text-on-surface">{fee.students?.classes?.name || 'Chưa xếp lớp'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant/70 text-xs block">Học kỳ / Năm học:</span>
                <span className="font-bold text-on-surface">Tháng {fee.month}/{fee.year}</span>
              </div>
            </div>
          </div>

          {/* Fee breakdown table */}
          <div>
            <h4 className="text-[12px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-3">2. Chi tiết các khoản thu</h4>
            <div className="border border-outline-variant/30 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-outline-variant/30 font-bold text-on-surface-variant/80 text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-2.5">Khoản mục thu</th>
                    <th className="px-4 py-2.5 text-right">Số tiền (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15 text-[13px] font-medium text-on-surface">
                  <tr>
                    <td className="px-4 py-2.5">Học phí cơ bản tháng {fee.month}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{(fee.base_amount || 0).toLocaleString('vi-VN')} ₫</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Tiền ăn bán trú dinh dưỡng</td>
                    <td className="px-4 py-2.5 text-right font-bold">{(fee.meal_amount || 0).toLocaleString('vi-VN')} ₫</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5">Phụ phí (Học phẩm, hoạt động dã ngoại, đón muộn...)</td>
                    <td className="px-4 py-2.5 text-right font-bold">{(fee.extra_amount || 0).toLocaleString('vi-VN')} ₫</td>
                  </tr>
                  {fee.discount > 0 && (
                    <tr className="text-emerald-700 bg-emerald-50/10">
                      <td className="px-4 py-2.5">Miễn giảm học phí (Ưu đãi / Con giáo viên)</td>
                      <td className="px-4 py-2.5 text-right font-bold">-{(fee.discount || 0).toLocaleString('vi-VN')} ₫</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/50 font-bold border-t border-outline-variant/30 text-[14px]">
                    <td className="px-4 py-3 text-primary">TỔNG CỘNG CẦN ĐÓNG</td>
                    <td className="px-4 py-3 text-right text-primary">{(fee.total_amount || 0).toLocaleString('vi-VN')} ₫</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment Status Summary */}
          <div className="bg-slate-50 border border-outline-variant/30 p-4 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-on-surface-variant font-medium">Hạn thanh toán:</span>
              <span className="font-bold text-on-surface">{formatDate(fee.due_date)}</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-on-surface-variant font-medium">Số tiền đã đóng:</span>
              <span className="font-bold text-green-700">{(fee.paid_amount || 0).toLocaleString('vi-VN')} ₫</span>
            </div>
            
            {fee.total_amount - fee.paid_amount > 0 && (
              <div className="flex justify-between items-center text-[13px] pt-1.5 border-t border-outline-variant/10 text-red-700">
                <span className="font-bold">Số tiền còn thiếu:</span>
                <span className="font-bold">{(fee.total_amount - fee.paid_amount).toLocaleString('vi-VN')} ₫</span>
              </div>
            )}
            
            {fee.paid_date && (
              <div className="flex justify-between items-center text-[13.5px]">
                <span className="text-on-surface-variant font-medium">Ngày thanh toán ghi nhận:</span>
                <span className="font-bold text-on-surface">{formatDate(fee.paid_date)}</span>
              </div>
            )}
          </div>

          {/* Signature / Note Area */}
          <div className="grid grid-cols-2 gap-6 pt-10 text-[12px] text-center select-none font-medium">
            <div>
              <p className="font-bold uppercase tracking-wider text-on-surface-variant/80">Người nộp tiền</p>
              <p className="text-[10px] text-on-surface-variant/60 mt-1">(Ký, ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="font-bold text-on-surface">....................................................</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-on-surface-variant/80">Người thu tiền (Kế toán)</p>
              <p className="text-[10px] text-on-surface-variant/60 mt-1">(Ký, ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="font-bold text-primary">{fee.users?.full_name || 'Kế toán trường'}</p>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Xóa phiếu thu học phí"
        message={`Bạn có chắc chắn muốn xóa hoàn toàn phiếu thu học phí tháng ${fee.month}/${fee.year} của học sinh ${fee.students?.full_name || ''}? Hành động này sẽ xóa dữ liệu vĩnh viễn và không thể khôi phục.`}
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
