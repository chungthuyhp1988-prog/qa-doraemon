import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star, ShieldAlert, Heart, Calendar, Award, FileText, CheckCircle } from 'lucide-react';
import { 
  Input, 
  Select, 
  Textarea, 
  Button,
  useSlidePanel
} from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { useQueryClient } from '@tanstack/react-query';

const evaluationFormSchema = z.object({
  student_id: z.string().min(1, 'Học sinh là bắt buộc'),
  evaluation_date: z.string().min(1, 'Ngày đánh giá là bắt buộc'),
  period: z.string().min(1, 'Kỳ đánh giá là bắt buộc (Ví dụ: Tháng 10, Học kỳ I...)'),
  
  physical_score: z.coerce.number().min(1, 'Điểm số từ 1 đến 5').max(5),
  physical_note: z.string().optional().nullable(),
  
  cognitive_score: z.coerce.number().min(1, 'Điểm số từ 1 đến 5').max(5),
  cognitive_note: z.string().optional().nullable(),
  
  language_score: z.coerce.number().min(1, 'Điểm số từ 1 đến 5').max(5),
  language_note: z.string().optional().nullable(),
  
  social_score: z.coerce.number().min(1, 'Điểm số từ 1 đến 5').max(5),
  social_note: z.string().optional().nullable(),
  
  aesthetic_score: z.coerce.number().min(1, 'Điểm số từ 1 đến 5').max(5),
  aesthetic_note: z.string().optional().nullable(),
  
  overall_comment: z.string().min(1, 'Nhận xét chung là bắt buộc'),
  recommendation: z.string().optional().nullable(),
});

type EvaluationFormValues = z.infer<typeof evaluationFormSchema>;

interface EvaluationFormProps {
  evaluation?: any; // If editing
  studentsList: any[];
  preselectedStudentId?: string;
  onSuccess?: () => void;
}

export const EvaluationForm: React.FC<EvaluationFormProps> = ({
  evaluation,
  studentsList,
  preselectedStudentId,
  onSuccess,
}) => {
  const { closePanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const [loading, setLoading] = useState(false);

  // Map initial values
  const defaultValues: EvaluationFormValues = {
    student_id: evaluation?.student_id || preselectedStudentId || '',
    evaluation_date: evaluation?.evaluation_date ? evaluation.evaluation_date.split('T')[0] : new Date().toISOString().split('T')[0],
    period: evaluation?.period || 'Tháng 10',
    
    physical_score: evaluation?.physical_score || 3,
    physical_note: evaluation?.physical_note || '',
    
    cognitive_score: evaluation?.cognitive_score || 3,
    cognitive_note: evaluation?.cognitive_note || '',
    
    language_score: evaluation?.language_score || 3,
    language_note: evaluation?.language_note || '',
    
    social_score: evaluation?.social_score || 3,
    social_note: evaluation?.social_note || '',
    
    aesthetic_score: evaluation?.aesthetic_score || 3,
    aesthetic_note: evaluation?.aesthetic_note || '',
    
    overall_comment: evaluation?.overall_comment || '',
    recommendation: evaluation?.recommendation || '',
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationFormSchema) as any,
    defaultValues,
  });

  const onSubmit = async (values: EvaluationFormValues) => {
    if (!selectedAcademicYearId) {
      toast.error('Lỗi', 'Vui lòng chọn năm học hiện tại ở góc trên màn hình');
      return;
    }
    setLoading(true);
    try {
      const evaluationPayload = {
        student_id: values.student_id,
        evaluator_id: currentUserId || '00000000-0000-0000-0000-000000000001',
        evaluation_date: values.evaluation_date,
        period: values.period,
        
        physical_score: values.physical_score,
        physical_note: values.physical_note || null,
        
        cognitive_score: values.cognitive_score,
        cognitive_note: values.cognitive_note || null,
        
        language_score: values.language_score,
        language_note: values.language_note || null,
        
        social_score: values.social_score,
        social_note: values.social_note || null,
        
        aesthetic_score: values.aesthetic_score,
        aesthetic_note: values.aesthetic_note || null,
        
        overall_comment: values.overall_comment.trim(),
        recommendation: values.recommendation || null,
        academic_year_id: selectedAcademicYearId,
        updated_at: new Date().toISOString(),
      };

      if (evaluation?.id) {
        const res = await api.update('student_evaluations', evaluation.id, evaluationPayload);
        if (res.error) throw new Error(res.error);
        toast.success('Cập nhật phiếu đánh giá học sinh thành công!');
      } else {
        const res = await api.create('student_evaluations', {
          ...evaluationPayload,
          created_at: new Date().toISOString(),
        });
        if (res.error) throw new Error(res.error);
        toast.success('Tạo phiếu đánh giá mới thành công!');
      }

      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['student-evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['evaluations-student-history'] });
      if (onSuccess) onSuccess();
      closePanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu đánh giá', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  // Render a 1-5 star selector component inside Controller
  const renderStarRating = (name: any, label: string) => {
    const noteFieldName = `${name.replace('_score', '')}_note` as any;
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <div className="space-y-2 bg-surface-container-lowest/50 p-3 rounded-2xl border border-outline-variant/20">
            <span className="text-xs font-bold text-on-surface-variant tracking-wide uppercase">{label}</span>
            <div className="flex items-center gap-1.5 mt-1 select-none">
              {[1, 2, 3, 4, 5].map((val) => {
                const isActive = field.value >= val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => field.onChange(val)}
                    className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Star
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isActive
                          ? "fill-primary text-primary"
                          : "text-on-surface-variant/20"
                      )}
                    />
                  </button>
                );
              })}
              <span className="text-xs font-bold text-primary ml-2">{field.value} / 5</span>
            </div>
            <textarea
              placeholder={`Ghi chú nhận xét chi tiết lĩnh vực ${label.toLowerCase()}...`}
              className="w-full bg-surface-container-low hover:bg-surface-container-low/80 focus:bg-white text-on-surface placeholder-on-surface-variant mt-2.5 p-2 rounded-xl border border-outline-variant/30 focus:border-primary focus:outline-none transition-all text-xs resize-none"
              rows={2}
              {...register(noteFieldName)}
            />
          </div>
        )}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5 select-none h-full bg-surface p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 select-none flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
        
        {/* Student & Date Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {preselectedStudentId ? (
            <div className="sm:col-span-1">
              <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
                Học sinh
              </label>
              <div className="p-3 mt-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm font-semibold text-on-surface">
                {studentsList.find(s => s.id === preselectedStudentId)?.full_name || 'Học sinh'}
              </div>
            </div>
          ) : (
            <div className="sm:col-span-1">
              <Select
                label="Chọn học sinh"
                options={[
                  { value: '', label: '-- Chọn học sinh --' },
                  ...studentsList.map((s) => ({ value: s.id, label: s.full_name })),
                ]}
                error={errors.student_id?.message}
                {...register('student_id')}
              />
            </div>
          )}

          <Input
            label="Kỳ đánh giá"
            placeholder="Ví dụ: Tháng 10, Học kỳ I..."
            leftIcon={<Award className="w-4 h-4" />}
            error={errors.period?.message}
            {...register('period')}
          />

          <Input
            label="Ngày lập phiếu"
            type="date"
            leftIcon={<Calendar className="w-4 h-4" />}
            error={errors.evaluation_date?.message}
            {...register('evaluation_date')}
          />
        </div>

        {/* 5 Domains Grid */}
        <div className="space-y-3">
          <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
            Đánh giá 5 lĩnh vực năng lực cốt lõi
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderStarRating('physical_score', '1. Thể chất & Vận động')}
            {renderStarRating('cognitive_score', '2. Nhận thức & Tư duy')}
            {renderStarRating('language_score', '3. Ngôn ngữ & Giao tiếp')}
            {renderStarRating('social_score', '4. Tình cảm & Kỹ năng xã hội')}
            <div className="md:col-span-2">
              {renderStarRating('aesthetic_score', '5. Thẩm mỹ & Năng khiếu')}
            </div>
          </div>
        </div>

        {/* Summary comments */}
        <Textarea
          label="Nhận xét tổng quan của giáo viên"
          placeholder="Nhận xét chung về tính cách, biểu hiện nổi bật, thái độ của trẻ..."
          rows={3}
          error={errors.overall_comment?.message}
          {...register('overall_comment')}
        />

        <Textarea
          label="Khuyến nghị / Định hướng giáo dục"
          placeholder="Lời khuyên cho phụ huynh để cùng rèn luyện thêm cho con tại nhà..."
          rows={2}
          error={errors.recommendation?.message}
          {...register('recommendation')}
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
              {evaluation ? 'Lưu thay đổi' : 'Tạo phiếu'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
