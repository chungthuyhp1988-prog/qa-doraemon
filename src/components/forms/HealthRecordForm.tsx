import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Ruler, Scale, Thermometer, ShieldAlert, Heart, Activity } from 'lucide-react';
import { 
  Input, 
  Select, 
  Textarea, 
  Button,
  useSlidePanel
} from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';

const healthRecordFormSchema = z.object({
  student_id: z.string().min(1, 'Học sinh là bắt buộc'),
  record_date: z.string().min(1, 'Ngày khám là bắt buộc'),
  height_cm: z.coerce.number().min(30, 'Chiều cao tối thiểu là 30 cm').max(200, 'Chiều cao tối đa là 200 cm'),
  weight_kg: z.coerce.number().min(2, 'Cân nặng tối thiểu là 2 kg').max(100, 'Cân nặng tối đa là 100 kg'),
  temperature: z.coerce.number().min(35, 'Nhiệt độ tối thiểu 35°C').max(42, 'Nhiệt độ tối đa 42°C').optional().nullable(),
  blood_type: z.string().optional().nullable(),
  health_status: z.string().min(1, 'Tình trạng sức khỏe là bắt buộc'),
  vaccination_info: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type HealthRecordFormValues = z.infer<typeof healthRecordFormSchema>;

interface HealthRecordFormProps {
  record?: any; // If editing
  studentsList: any[];
  preselectedStudentId?: string; // If creating for a specific student
  onSuccess?: () => void;
}

export const HealthRecordForm: React.FC<HealthRecordFormProps> = ({
  record,
  studentsList,
  preselectedStudentId,
  onSuccess,
}) => {
  const { closePanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [loading, setLoading] = useState(false);

  // Map initial values
  const defaultValues: HealthRecordFormValues = {
    student_id: record?.student_id || preselectedStudentId || '',
    record_date: record?.record_date ? record.record_date.split('T')[0] : new Date().toISOString().split('T')[0],
    height_cm: record?.height_cm || '',
    weight_kg: record?.weight_kg || '',
    temperature: record?.temperature || 36.5,
    blood_type: record?.blood_type || '',
    health_status: record?.health_status || 'Bình thường',
    vaccination_info: record?.vaccination_info || '',
    notes: record?.notes || '',
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<HealthRecordFormValues>({
    resolver: zodResolver(healthRecordFormSchema) as any,
    defaultValues,
  });

  const onSubmit = async (values: HealthRecordFormValues) => {
    setLoading(true);
    try {
      const recordPayload = {
        student_id: values.student_id,
        record_date: values.record_date,
        height_cm: values.height_cm,
        weight_kg: values.weight_kg,
        temperature: values.temperature || null,
        blood_type: values.blood_type || null,
        health_status: values.health_status,
        vaccination_info: values.vaccination_info || null,
        notes: values.notes || null,
        recorded_by: currentUserId || null,
        updated_at: new Date().toISOString(),
      };

      if (record?.id) {
        const res = await api.update('health_records', record.id, recordPayload);
        if (res.error) throw new Error(res.error);
        toast.success('Cập nhật hồ sơ sức khỏe thành công!');
      } else {
        const res = await api.create('health_records', {
          ...recordPayload,
          created_at: new Date().toISOString(),
        });
        if (res.error) throw new Error(res.error);
        toast.success('Thêm hồ sơ sức khỏe mới thành công!');
      }

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      queryClient.invalidateQueries({ queryKey: ['health-student-history'] });
      if (onSuccess) onSuccess();
      closePanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu thông tin', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 select-none h-full bg-surface p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 select-none flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {preselectedStudentId ? (
            <div className="sm:col-span-2">
              <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
                Học sinh
              </label>
              <div className="p-3 mt-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm font-semibold text-on-surface">
                {studentsList.find(s => s.id === preselectedStudentId)?.full_name || 'Học sinh đã chọn'}
              </div>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <Select
                label="Chọn học sinh"
                options={[
                  { value: '', label: '-- Chọn học sinh khám --' },
                  ...studentsList.map((s) => ({ value: s.id, label: `${s.full_name} (${s.student_code})` })),
                ]}
                error={errors.student_id?.message}
                {...register('student_id')}
              />
            </div>
          )}

          <Input
            label="Ngày khám sức khỏe"
            type="date"
            leftIcon={<Calendar />}
            error={errors.record_date?.message}
            {...register('record_date')}
          />

          <Input
            label="Chiều cao (cm)"
            type="number"
            step="0.1"
            placeholder="Ví dụ: 95.5"
            leftIcon={<Ruler />}
            error={errors.height_cm?.message}
            {...register('height_cm')}
          />

          <Input
            label="Cân nặng (kg)"
            type="number"
            step="0.1"
            placeholder="Ví dụ: 14.2"
            leftIcon={<Scale />}
            error={errors.weight_kg?.message}
            {...register('weight_kg')}
          />

          <Input
            label="Nhiệt độ cơ thể (°C)"
            type="number"
            step="0.1"
            placeholder="Ví dụ: 36.5"
            leftIcon={<Thermometer />}
            error={errors.temperature?.message}
            {...register('temperature')}
          />

          <Select
            label="Nhóm máu (Nếu biết)"
            options={[
              { value: '', label: 'Chưa xác định' },
              { value: 'A', label: 'Nhóm máu A' },
              { value: 'B', label: 'Nhóm máu B' },
              { value: 'AB', label: 'Nhóm máu AB' },
              { value: 'O', label: 'Nhóm máu O' },
            ]}
            error={errors.blood_type?.message}
            {...register('blood_type')}
          />

          <Input
            label="Tình trạng sức khỏe chung"
            placeholder="Ví dụ: Bình thường, Ho nhẹ, Sốt nhẹ..."
            leftIcon={<Activity />}
            error={errors.health_status?.message}
            {...register('health_status')}
          />
        </div>

        <Textarea
          label="Thông tin tiêm chủng (Nếu có)"
          placeholder="Ghi nhận lịch sử hoặc các mũi tiêm chủng gần đây..."
          error={errors.vaccination_info?.message}
          {...register('vaccination_info')}
        />

        <Textarea
          label="Ghi chú thêm từ bác sĩ / y tá"
          placeholder="Lưu ý chăm sóc, dị ứng thuốc hoặc chế độ sinh hoạt..."
          error={errors.notes?.message}
          {...register('notes')}
        />

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => closePanel()}
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
              {record ? 'Lưu thay đổi' : 'Ghi nhận'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
