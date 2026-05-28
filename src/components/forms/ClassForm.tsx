import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Home, Users, Layers, Shield, FileText } from 'lucide-react';
import { 
  Modal, 
  Input, 
  Select, 
  Textarea, 
  Button, 
  Switch 
} from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';
import { useQueryClient } from '@tanstack/react-query';

const classFormSchema = z.object({
  name: z.string().min(1, 'Tên lớp là bắt buộc'),
  grade_level: z.enum(['nha_tre', 'mam', 'choi', 'la']),
  capacity: z.coerce.number().min(1, 'Sức chứa tối thiểu là 1 trẻ').max(100, 'Sức chứa tối đa 100 trẻ'),
  room_number: z.string().min(1, 'Số phòng học là bắt buộc'),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  homeroom_teacher_id: z.string().optional().nullable().or(z.literal('')),
  teacher_ids: z.array(z.string()).default([]),
});

type ClassFormValues = z.infer<typeof classFormSchema>;

const STANDARD_CLASS_NAMES: Record<string, string[]> = {
  nha_tre: ['Shizuka 1', 'Shizuka 2', 'Shizuka 3'],
  mam: ['Nobita 1', 'Nobita 2', 'Nobita 3'],
  choi: ['Dorami 1', 'Dorami 2', 'Dorami 3'],
  la: ['Doraemon 1', 'Doraemon 2', 'Doraemon 3'],
};

interface ClassFormProps {
  open: boolean;
  onClose: () => void;
  classData?: any; // If editing
  teachersList: any[];
}

export const ClassForm: React.FC<ClassFormProps> = ({
  open,
  onClose,
  classData,
  teachersList,
}) => {
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const [loading, setLoading] = useState(false);
  const [nameMode, setNameMode] = useState<'select' | 'custom'>('select');

  // Map initial values
  const defaultValues: ClassFormValues = {
    name: classData?.name || '',
    grade_level: classData?.grade_level || 'mam',
    capacity: classData?.capacity || 25,
    room_number: classData?.room_number || '',
    description: classData?.description || '',
    is_active: classData?.is_active !== undefined ? classData.is_active : true,
    homeroom_teacher_id: classData?.class_teachers?.find((ct: any) => ct.is_homeroom)?.teacher_id || '',
    teacher_ids: classData?.class_teachers?.map((ct: any) => ct.teacher_id) || [],
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema) as any,
    defaultValues,
  });

  const selectedTeacherIds = watch('teacher_ids') || [];
  const homeroomTeacherId = watch('homeroom_teacher_id') || '';
  const selectedGrade = watch('grade_level') || 'mam';

  // Check if name is custom on mount or when classData changes
  useEffect(() => {
    if (classData) {
      const grade = classData.grade_level || 'mam';
      const standards = STANDARD_CLASS_NAMES[grade] || [];
      if (standards.includes(classData.name)) {
        setNameMode('select');
      } else {
        setNameMode('custom');
      }
    }
  }, [classData]);

  // Automatically update the name to standard default when grade changes in select mode
  useEffect(() => {
    if (nameMode === 'select' && !classData) {
      const standards = STANDARD_CLASS_NAMES[selectedGrade] || [];
      setValue('name', standards[0] || '');
    }
  }, [selectedGrade, nameMode, classData, setValue]);

  const handleTeacherToggle = (teacherId: string) => {
    const current = [...selectedTeacherIds];
    const index = current.indexOf(teacherId);
    if (index > -1) {
      current.splice(index, 1);
      // If we remove the teacher who was homeroom, clear homeroom
      if (homeroomTeacherId === teacherId) {
        setValue('homeroom_teacher_id', '');
      }
    } else {
      current.push(teacherId);
    }
    setValue('teacher_ids', current);
  };

  const onSubmit = async (values: ClassFormValues) => {
    if (!selectedAcademicYearId) {
      toast.error('Lỗi lưu thông tin', 'Vui lòng chọn năm học hiện tại ở cài đặt hoặc trên thanh công cụ');
      return;
    }
    setLoading(true);
    try {
      const classPayload = {
        school_id: schoolId,
        academic_year_id: selectedAcademicYearId,
        name: values.name.trim(),
        grade_level: values.grade_level,
        capacity: values.capacity,
        room_number: values.room_number.trim() || null,
        description: values.description || null,
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      };

      let classId = classData?.id;

      if (classId) {
        // 1. Update Class
        const classRes = await api.update('classes', classId, classPayload);
        if (classRes.error) throw new Error(classRes.error);

        // 2. Manage assignments
        // Find existing assignments
        const { data: existingAssignments } = await api.getAll<any>(
          'class_teachers',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: classId } }
        );
        
        // Remove all old assignments first (safest and easiest way for many-to-many update)
        if (existingAssignments?.data) {
          for (const ea of existingAssignments.data) {
            await api.remove('class_teachers', ea.id);
          }
        }

        // Add new assignments
        if (values.teacher_ids.length > 0) {
          const newAssignmentsPayload = values.teacher_ids.map((tid) => ({
            class_id: classId,
            teacher_id: tid,
            is_homeroom: tid === values.homeroom_teacher_id,
          }));
          await api.createMany('class_teachers', newAssignmentsPayload);
        }

        toast.success('Cập nhật lớp học thành công!');
      } else {
        classId = crypto.randomUUID();
        // 1. Create Class
        const classRes = await api.create('classes', {
          id: classId,
          ...classPayload,
        });
        if (classRes.error) throw new Error(classRes.error);

        // 2. Add class teachers
        if (values.teacher_ids.length > 0) {
          const assignmentsPayload = values.teacher_ids.map((tid) => ({
            class_id: classId,
            teacher_id: tid,
            is_homeroom: tid === values.homeroom_teacher_id,
          }));
          await api.createMany('class_teachers', assignmentsPayload);
        }

        toast.success('Thêm lớp học mới thành công!');
      }

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['classes-summary'] });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu thông tin', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={classData ? 'Chỉnh sửa thông tin lớp học' : 'Thêm lớp học mới'}
      size="lg"
      showCloseButton={!loading}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 select-none max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {nameMode === 'select' ? (
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
                Tên lớp học
              </label>
              <select
                value={watch('name')}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setNameMode('custom');
                    setValue('name', '');
                  } else {
                    setValue('name', e.target.value);
                  }
                }}
                className="w-full rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm h-10 px-3 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="" disabled>-- Chọn tên lớp học --</option>
                {(STANDARD_CLASS_NAMES[selectedGrade] || []).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                <option value="custom" className="text-primary font-semibold">Tự nhập tên lớp khác...</option>
              </select>
              {errors.name?.message && (
                <span className="text-xs text-error font-medium">{errors.name?.message}</span>
              )}
            </div>
          ) : (
            <div className="relative w-full">
              <Input
                label="Tên lớp học"
                placeholder="Ví dụ: Doraemon 1, Mầm non A..."
                leftIcon={<Home />}
                error={errors.name?.message}
                {...register('name')}
              />
              <button
                type="button"
                onClick={() => {
                  setNameMode('select');
                  const standards = STANDARD_CLASS_NAMES[selectedGrade] || [];
                  setValue('name', standards[0] || '');
                }}
                className="absolute right-0 top-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer select-none"
              >
                Chọn từ danh sách
              </button>
            </div>
          )}

          <Select
            label="Khối lớp"
            options={[
              { value: 'nha_tre', label: 'Nhà trẻ (18 - 36 tháng)' },
              { value: 'mam', label: 'Lớp Mầm (3 - 4 tuổi)' },
              { value: 'choi', label: 'Lớp Chồi (4 - 5 tuổi)' },
              { value: 'la', label: 'Lớp Lá (5 - 6 tuổi)' },
            ]}
            error={errors.grade_level?.message}
            {...register('grade_level')}
          />

          <Input
            label="Số phòng học"
            placeholder="Ví dụ: P.201, Tầng 2..."
            leftIcon={<Layers />}
            error={errors.room_number?.message}
            {...register('room_number')}
          />

          <Input
            label="Sức chứa tối đa (Trẻ)"
            type="number"
            placeholder="25"
            leftIcon={<Users />}
            error={errors.capacity?.message}
            {...register('capacity')}
          />
        </div>

        <Textarea
          label="Mô tả / Ghi chú"
          placeholder="Mô tả ngắn gọn về lớp học..."
          error={errors.description?.message}
          {...register('description')}
        />

        {/* Teacher Selection */}
        <div className="space-y-3">
          <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
            Phân công giáo viên giảng dạy
          </label>
          <p className="text-xs text-on-surface-variant font-medium">
            Chọn các giáo viên phụ trách giảng dạy hoặc hỗ trợ lớp này.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[150px] overflow-y-auto p-3 border border-outline-variant/40 rounded-2xl bg-surface-container-low/20">
            {teachersList.map((t) => {
              const isSelected = selectedTeacherIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTeacherToggle(t.id)}
                  className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary border-primary text-on-primary shadow-sm'
                      : 'bg-white border-outline-variant/50 text-on-surface-variant hover:border-outline hover:text-on-surface'
                  }`}
                >
                  {t.full_name}
                </button>
              );
            })}
            {teachersList.length === 0 && (
              <span className="col-span-full text-xs text-on-surface-variant/70 italic text-center py-2">
                Chưa có giáo viên nào trong danh sách nhân sự.
              </span>
            )}
          </div>
        </div>

        {/* Homeroom Teacher Selection (Only from selected teachers) */}
        {selectedTeacherIds.length > 0 && (
          <Select
            label="Giáo viên chủ nhiệm (GVCN)"
            options={[
              { value: '', label: '-- Chọn giáo viên chủ nhiệm --' },
              ...teachersList
                .filter((t) => selectedTeacherIds.includes(t.id))
                .map((t) => ({ value: t.id, label: t.full_name })),
            ]}
            error={errors.homeroom_teacher_id?.message}
            {...register('homeroom_teacher_id')}
          />
        )}

        {/* Active Toggle Switch */}
        <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-on-surface">Trạng thái hoạt động</span>
            <span className="text-xs text-on-surface-variant">Bật để lớp học hoạt động trong năm học này</span>
          </div>

          <Controller
            control={control}
            name="is_active"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        {/* Form Actions */}
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
            {classData ? 'Lưu thay đổi' : 'Tạo mới'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
