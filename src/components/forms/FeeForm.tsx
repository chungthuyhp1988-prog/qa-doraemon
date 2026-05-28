import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, Calendar, FileText, User } from 'lucide-react';
import { Modal, Input, Select, Textarea, Button } from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const feeFormSchema = z.object({
  student_id: z.string().min(1, 'Học sinh là bắt buộc'),
  month: z.coerce.number().min(1, 'Tháng không hợp lệ').max(12, 'Tháng không hợp lệ'),
  year: z.coerce.number().min(2020, 'Năm không hợp lệ').max(2100, 'Năm không hợp lệ'),
  base_amount: z.coerce.number().min(0, 'Học phí cơ bản phải >= 0'),
  meal_amount: z.coerce.number().min(0, 'Tiền ăn phải >= 0').default(0),
  extra_amount: z.coerce.number().min(0, 'Phụ phí phải >= 0').default(0),
  discount: z.coerce.number().min(0, 'Giảm trừ phải >= 0').default(0),
  paid_amount: z.coerce.number().min(0, 'Số tiền đã đóng phải >= 0').default(0),
  status: z.enum(['pending', 'partial', 'paid', 'overdue']).default('pending'),
  due_date: z.string().min(1, 'Hạn đóng là bắt buộc'),
  note: z.string().optional().nullable(),
});

type FeeFormValues = z.infer<typeof feeFormSchema>;

interface FeeFormProps {
  open: boolean;
  onClose: () => void;
  fee?: any; // If editing
}

export const FeeForm: React.FC<FeeFormProps> = ({
  open,
  onClose,
  fee,
}) => {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id) || null;

  const [loading, setLoading] = useState(false);

  // 1. Fetch active students for selection
  const { data: studentsResponse } = useQuery({
    queryKey: ['students-list-simple'],
    queryFn: () => api.getAll<any>('students', { page: 1, pageSize: 1000, sortBy: 'full_name', sortOrder: 'asc' }, { filters: { status: 'active' } }, 'id, full_name, student_code')
  });
  const studentsList = studentsResponse?.data?.data || [];

  // 2. Fetch active academic year
  const { data: academicYearsResponse } = useQuery({
    queryKey: ['active-academic-year'],
    queryFn: () => api.getAll<any>('academic_years', { page: 1, pageSize: 1 }, { filters: { is_current: true } })
  });
  const activeAcademicYear = academicYearsResponse?.data?.data?.[0];

  // Default values mapping
  const defaultValues: FeeFormValues = {
    student_id: fee?.student_id || '',
    month: fee?.month || new Date().getMonth() + 1,
    year: fee?.year || new Date().getFullYear(),
    base_amount: fee?.base_amount || 3500000,
    meal_amount: fee?.meal_amount || 0,
    extra_amount: fee?.extra_amount || 0,
    discount: fee?.discount || 0,
    paid_amount: fee?.paid_amount || 0,
    status: fee?.status || 'pending',
    due_date: fee?.due_date ? fee.due_date.split('T')[0] : new Date(new Date().getFullYear(), new Date().getMonth(), 10).toISOString().split('T')[0],
    note: fee?.note || '',
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FeeFormValues>({
    resolver: zodResolver(feeFormSchema) as any,
    defaultValues,
  });

  const baseAmount = watch('base_amount') || 0;
  const mealAmount = watch('meal_amount') || 0;
  const extraAmount = watch('extra_amount') || 0;
  const discount = watch('discount') || 0;
  const paidAmount = watch('paid_amount') || 0;

  const totalAmount = Number(baseAmount) + Number(mealAmount) + Number(extraAmount) - Number(discount);

  // Auto-adjust status based on paid amount
  useEffect(() => {
    if (paidAmount >= totalAmount && totalAmount > 0) {
      setValue('status', 'paid');
    } else if (paidAmount > 0 && paidAmount < totalAmount) {
      setValue('status', 'partial');
    }
  }, [paidAmount, totalAmount, setValue]);

  const onSubmit = async (values: FeeFormValues) => {
    if (!activeAcademicYear) {
      toast.error('Lỗi lưu phiếu thu', 'Không tìm thấy năm học hoạt động hiện tại.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student_id: values.student_id,
        academic_year_id: fee?.academic_year_id || activeAcademicYear.id,
        month: values.month,
        year: values.year,
        base_amount: values.base_amount,
        meal_amount: values.meal_amount,
        extra_amount: values.extra_amount,
        discount: values.discount,
        total_amount: totalAmount,
        paid_amount: values.paid_amount,
        status: values.status,
        due_date: values.due_date,
        paid_date: values.status === 'paid' ? new Date().toISOString().split('T')[0] : (values.paid_amount > 0 ? fee?.paid_date || new Date().toISOString().split('T')[0] : null),
        note: values.note || null,
        created_by: fee?.created_by || currentUserId,
        updated_at: new Date().toISOString(),
      };

      if (fee?.id) {
        const res = await api.update('tuition_fees', fee.id, payload);
        if (res.error) throw new Error(res.error);
        toast.success('Cập nhật phiếu thu thành công!');
      } else {
        const res = await api.create('tuition_fees', payload);
        if (res.error) throw new Error(res.error);
        toast.success('Tạo phiếu thu thành công!');
      }

      queryClient.invalidateQueries({ queryKey: ['tuition-fees-list'] });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu phiếu thu', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={fee ? 'Chỉnh sửa phiếu thu học phí' : 'Tạo phiếu thu học phí mới'}
      size="md"
      showCloseButton={!loading}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 select-none max-h-[70vh] overflow-y-auto pr-1">
        
        {/* Student Select */}
        <Select
          label="Chọn học sinh nhận phiếu thu"
          options={studentsList.map((s) => ({
            value: s.id,
            label: `${s.full_name} (${s.student_code})`,
          }))}
          disabled={!!fee}
          error={errors.student_id?.message}
          {...register('student_id')}
        />

        {/* Month & Year Selection */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Tháng thu phí"
            type="number"
            min={1}
            max={12}
            disabled={!!fee}
            error={errors.month?.message}
            {...register('month')}
          />
          <Input
            label="Năm thu phí"
            type="number"
            min={2020}
            max={2100}
            disabled={!!fee}
            error={errors.year?.message}
            {...register('year')}
          />
        </div>

        {/* Amounts Group */}
        <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-4">
          <Input
            label="Học phí cơ bản (VNĐ)"
            type="number"
            leftIcon={<DollarSign />}
            error={errors.base_amount?.message}
            {...register('base_amount')}
          />

          <Input
            label="Tiền ăn bán trú (VNĐ)"
            type="number"
            leftIcon={<DollarSign />}
            error={errors.meal_amount?.message}
            {...register('meal_amount')}
          />

          <Input
            label="Phụ phí bán trú (VNĐ)"
            type="number"
            leftIcon={<DollarSign />}
            error={errors.extra_amount?.message}
            {...register('extra_amount')}
          />

          <Input
            label="Giảm trừ (VNĐ)"
            type="number"
            leftIcon={<DollarSign />}
            error={errors.discount?.message}
            {...register('discount')}
          />
        </div>

        {/* Total Amount Display Box */}
        <div className="bg-surface-container-low rounded-2xl p-4 flex justify-between items-center border border-outline-variant/30">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Tổng tiền cần đóng:</span>
          <span className="text-xl font-bold font-playfair text-primary">
            {totalAmount.toLocaleString('vi-VN')} ₫
          </span>
        </div>

        {/* Payment details */}
        <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-4">
          <Input
            label="Đã đóng (VNĐ)"
            type="number"
            leftIcon={<DollarSign />}
            error={errors.paid_amount?.message}
            {...register('paid_amount')}
          />

          <Select
            label="Trạng thái thanh toán"
            options={[
              { value: 'pending', label: 'Chờ thanh toán' },
              { value: 'partial', label: 'Thanh toán một phần' },
              { value: 'paid', label: 'Đã thanh toán' },
              { value: 'overdue', label: 'Quá hạn' },
            ]}
            error={errors.status?.message}
            {...register('status')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Hạn thanh toán"
            type="date"
            leftIcon={<Calendar />}
            error={errors.due_date?.message}
            {...register('due_date')}
          />

          <Textarea
            label="Ghi chú thêm"
            placeholder="Ví dụ: thu hộ tiền đồng phục, tiền dã ngoại..."
            error={errors.note?.message}
            {...register('note')}
          />
        </div>

        {/* Submit Group */}
        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="rounded-xl cursor-pointer"
          >
            {fee ? 'Lưu thay đổi' : 'Tạo phiếu thu'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
