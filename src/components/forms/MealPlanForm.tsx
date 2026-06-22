import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Coffee, UtensilsCrossed, Apple, Info, Flame } from 'lucide-react';
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

const mealPlanFormSchema = z.object({
  class_id: z.string().optional().nullable().or(z.literal('')),
  date: z.string().min(1, 'Ngày áp dụng thực đơn là bắt buộc'),
  meal_type: z.enum(['breakfast', 'lunch', 'afternoon_snack']),
  menu_items: z.string().min(1, 'Danh sách món ăn là bắt buộc'),
  calories: z.coerce.number().min(0, 'Hàm lượng calo không hợp lệ').optional().nullable(),
  notes: z.string().optional().nullable(),
});

type MealPlanFormValues = z.infer<typeof mealPlanFormSchema>;

interface MealPlanFormProps {
  mealPlan?: any; // If editing
  classesList: any[];
  onSuccess?: () => void;
}

export const MealPlanForm: React.FC<MealPlanFormProps> = ({
  mealPlan,
  classesList,
  onSuccess,
}) => {
  const { closePanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [loading, setLoading] = useState(false);

  // Map initial values
  const defaultValues: MealPlanFormValues = {
    class_id: mealPlan?.class_id || '',
    date: mealPlan?.date ? mealPlan.date.split('T')[0] : new Date().toISOString().split('T')[0],
    meal_type: mealPlan?.meal_type || 'lunch',
    menu_items: mealPlan?.menu_items || '',
    calories: mealPlan?.calories || 0,
    notes: mealPlan?.notes || '',
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MealPlanFormValues>({
    resolver: zodResolver(mealPlanFormSchema) as any,
    defaultValues,
  });

  const onSubmit = async (values: MealPlanFormValues) => {
    setLoading(true);
    try {
      const mealPlanPayload = {
        school_id: schoolId,
        class_id: values.class_id || null,
        date: values.date,
        meal_type: values.meal_type,
        menu_items: values.menu_items.trim(),
        calories: values.calories || null,
        notes: values.notes || null,
        created_by: currentUserId || null,
        updated_at: new Date().toISOString(),
      };

      if (mealPlan?.id) {
        const res = await api.update('meal_plans', mealPlan.id, mealPlanPayload);
        if (res.error) throw new Error(res.error);
        toast.success('Cập nhật thực đơn thành công!');
      } else {
        const res = await api.create('meal_plans', {
          ...mealPlanPayload,
          created_at: new Date().toISOString(),
        });
        if (res.error) throw new Error(res.error);
        toast.success('Thêm thực đơn mới thành công!');
      }

      // Invalidate queries to refresh weekly list
      queryClient.invalidateQueries({ queryKey: ['meal-plans-weekly'] });
      if (onSuccess) onSuccess();
      closePanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu thực đơn', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 select-none h-full bg-surface p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 select-none flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <Input
            label="Ngày áp dụng thực đơn"
            type="date"
            leftIcon={<Calendar />}
            error={errors.date?.message}
            {...register('date')}
          />

          <Select
            label="Bữa ăn trong ngày"
            options={[
              { value: 'breakfast', label: 'Bữa sáng (Bữa chính 1)' },
              { value: 'lunch', label: 'Bữa trưa (Bữa chính 2)' },
              { value: 'afternoon_snack', label: 'Bữa phụ chiều' },
            ]}
            error={errors.meal_type?.message}
            {...register('meal_type')}
          />

          <Select
            label="Lớp áp dụng"
            options={[
              { value: '', label: 'Tất cả các lớp (Thực đơn chung)' },
              ...classesList.map((c) => ({ value: c.id, label: `Áp dụng riêng: Lớp ${c.name}` })),
            ]}
            error={errors.class_id?.message}
            {...register('class_id')}
          />

          <Input
            label="Hàm lượng dinh dưỡng dự kiến (Calo)"
            type="number"
            placeholder="Ví dụ: 350"
            leftIcon={<Flame />}
            error={errors.calories?.message}
            {...register('calories')}
          />
        </div>

        <Textarea
          label="Món ăn chi tiết"
          placeholder="Nhập tên món ăn, danh mục (Ví dụ: - Súp gà hạt sen \n- Cơm tám thơm \n- Nước cam tươi...)"
          rows={5}
          error={errors.menu_items?.message}
          {...register('menu_items')}
        />

        <Textarea
          label="Lưu ý / Ghi chú dị ứng thức ăn"
          placeholder="Lưu ý các trường hợp dị ứng hoặc hướng dẫn chế biến đặc biệt..."
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
              {mealPlan ? 'Lưu thay đổi' : 'Lưu thực đơn'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
