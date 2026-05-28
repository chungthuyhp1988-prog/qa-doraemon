import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Phone, Briefcase, Mail, MapPin, Calendar } from 'lucide-react';
import { 
  Modal, 
  Input, 
  Select, 
  Textarea, 
  FileUpload, 
  Button, 
  Switch 
} from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';

const teacherFormSchema = z.object({
  full_name: z.string().min(1, 'Họ tên nhân sự là bắt buộc'),
  email: z.string().email('Email không hợp lệ').min(1, 'Email là bắt buộc'),
  phone: z.string().min(10, 'Số điện thoại tối thiểu 10 số').max(11, 'Số điện thoại tối đa 11 số'),
  role: z.enum(['admin', 'teacher', 'staff']).default('teacher'),
  job_title: z.string().min(1, 'Chức vụ là bắt buộc'),
  avatar_url: z.string().nullable().optional(),
  date_of_birth: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  assigned_class_ids: z.array(z.string()).default([]),
});

type TeacherFormValues = z.infer<typeof teacherFormSchema>;

interface TeacherFormProps {
  open: boolean;
  onClose: () => void;
  teacher?: any; // If editing
  classesList: any[];
}

export const TeacherForm: React.FC<TeacherFormProps> = ({
  open,
  onClose,
  teacher,
  classesList,
}) => {
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  
  const [loading, setLoading] = useState(false);

  // Map initial values
  const defaultValues: TeacherFormValues = {
    full_name: teacher?.full_name || '',
    email: teacher?.email || '',
    phone: teacher?.phone || '',
    role: teacher?.role || 'teacher',
    job_title: teacher?.job_title || '',
    avatar_url: teacher?.avatar_url || '',
    date_of_birth: teacher?.date_of_birth ? teacher.date_of_birth.split('T')[0] : '',
    address: teacher?.address || '',
    is_active: teacher?.is_active !== undefined ? teacher.is_active : true,
    assigned_class_ids: teacher?.class_teachers?.map((ct: any) => ct.class_id) || [],
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema) as any,
    defaultValues,
  });

  const selectedRole = watch('role');
  const avatarUrl = watch('avatar_url');
  const assignedClassIds = watch('assigned_class_ids') || [];

  const handleClassToggle = (classId: string) => {
    const current = [...assignedClassIds];
    const index = current.indexOf(classId);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(classId);
    }
    setValue('assigned_class_ids', current);
  };

  const onSubmit = async (values: TeacherFormValues) => {
    setLoading(true);
    try {
      const userPayload = {
        school_id: schoolId,
        email: values.email.trim().toLowerCase(),
        full_name: values.full_name,
        role: values.role,
        phone: values.phone || null,
        avatar_url: values.avatar_url || null,
        job_title: values.job_title,
        date_of_birth: values.date_of_birth || null,
        address: values.address || null,
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      };

      let teacherId = teacher?.id;

      if (teacherId) {
        // 1. Update Teacher
        const userRes = await api.update('users', teacherId, userPayload);
        if (userRes.error) throw new Error(userRes.error);
        
        // 2. Update Class Assignments (only relevant if role is teacher)
        // Find existing assignments
        const { data: existingAssignments } = await api.getAll<any>(
          'class_teachers', 
          { page: 1, pageSize: 1000 }, 
          { filters: { teacher_id: teacherId } }
        );
        const existingClassIds = existingAssignments?.data?.map((ct: any) => ct.class_id) || [];

        // Deleted assignments
        const deletedAssignments = (existingAssignments?.data || []).filter(
          (ct: any) => !values.assigned_class_ids.includes(ct.class_id)
        );
        for (const da of deletedAssignments) {
          await api.remove('class_teachers', da.id);
        }

        // New assignments
        const newClassIds = values.assigned_class_ids.filter(
          (id) => !existingClassIds.includes(id)
        );
        if (newClassIds.length > 0 && values.role === 'teacher') {
          const newAssignmentsPayload = newClassIds.map((cid) => ({
            class_id: cid,
            teacher_id: teacherId,
            is_homeroom: false,
          }));
          await api.createMany('class_teachers', newAssignmentsPayload);
        }

        toast.success('Cập nhật thông tin nhân sự thành công!');
      } else {
        // Generate new UUID for the profile
        teacherId = crypto.randomUUID();
        
        // 1. Create Teacher Profile in users
        const userRes = await api.create('users', {
          id: teacherId,
          ...userPayload,
        });
        if (userRes.error) throw new Error(userRes.error);

        // 2. Create Class Assignments (only if role is teacher)
        if (values.assigned_class_ids.length > 0 && values.role === 'teacher') {
          const assignmentsPayload = values.assigned_class_ids.map((cid) => ({
            class_id: cid,
            teacher_id: teacherId,
            is_homeroom: false,
          }));
          await api.createMany('class_teachers', assignmentsPayload);
        }

        toast.success('Thêm nhân sự mới thành công!');
      }

      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
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
      title={teacher ? 'Chỉnh sửa thông tin nhân sự' : 'Thêm nhân sự mới'}
      size="lg"
      showCloseButton={!loading}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 select-none max-h-[70vh] overflow-y-auto pr-1">
        
        {/* Avatar & Basic Profile Info */}
        <div className="flex flex-col md:flex-row gap-5 items-start">
          <div className="w-full md:w-1/3">
            <FileUpload
              bucket="avatars"
              folderPath="teachers"
              label="Ảnh đại diện"
              value={avatarUrl || ''}
              onChange={(url) => setValue('avatar_url', url)}
              error={errors.avatar_url?.message}
            />
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Input
              label="Họ và tên nhân sự"
              placeholder="Nhập họ tên đầy đủ..."
              leftIcon={<User />}
              error={errors.full_name?.message}
              {...register('full_name')}
            />

            <Input
              label="Địa chỉ email"
              placeholder="teacher@doraemon.edu.vn..."
              leftIcon={<Mail />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Số điện thoại"
              placeholder="09xxxxxxxx..."
              leftIcon={<Phone />}
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Ngày sinh"
              type="date"
              leftIcon={<Calendar />}
              error={errors.date_of_birth?.message}
              {...register('date_of_birth')}
            />
          </div>
        </div>

        {/* Roles & Job Titles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Nhóm vai trò hệ thống"
            options={[
              { value: 'teacher', label: 'Giáo viên (Phụ trách lớp)' },
              { value: 'admin', label: 'Ban giám hiệu (Quản trị hệ thống)' },
              { value: 'staff', label: 'Nhân viên văn phòng / Khác' },
            ]}
            error={errors.role?.message}
            {...register('role')}
          />

          <Input
            label="Chức vụ hiển thị"
            placeholder="Ví dụ: Hiệu trưởng, Hiệu phó, Giáo viên chủ nhiệm..."
            leftIcon={<Briefcase />}
            error={errors.job_title?.message}
            {...register('job_title')}
          />

          <div className="sm:col-span-2">
            <Input
              label="Địa chỉ liên hệ"
              placeholder="Nhập địa chỉ nhà..."
              leftIcon={<MapPin />}
              error={errors.address?.message}
              {...register('address')}
            />
          </div>
        </div>

        {/* Class Assignments (Conditional on Role === 'teacher') */}
        {selectedRole === 'teacher' && (
          <div className="space-y-2.5">
            <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
              Phân công lớp phụ trách
            </label>
            <p className="text-xs text-on-surface-variant font-medium">
              Chọn một hoặc nhiều lớp học mà giáo viên này trực tiếp giảng dạy/chủ nhiệm.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[150px] overflow-y-auto p-3 border border-outline-variant/40 rounded-2xl bg-surface-container-low/20">
              {classesList.map((c) => {
                const isSelected = assignedClassIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleClassToggle(c.id)}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary border-primary text-on-primary shadow-sm'
                        : 'bg-white border-outline-variant/50 text-on-surface-variant hover:border-outline hover:text-on-surface'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
              {classesList.length === 0 && (
                <span className="col-span-full text-xs text-on-surface-variant/70 italic text-center py-2">
                  Chưa có lớp học nào trong năm học này.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Active Toggle Switch */}
        <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-on-surface">Trạng thái công tác</span>
            <span className="text-xs text-on-surface-variant">Bật để cho phép nhân viên truy cập hệ thống</span>
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
            {teacher ? 'Lưu thay đổi' : 'Tạo mới'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
