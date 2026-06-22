import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, User, Phone, Briefcase, Mail, Check } from 'lucide-react';
import { 
  Input, 
  Select, 
  Textarea, 
  FileUpload, 
  Button, 
  Switch,
  Tabs,
  useSlidePanel
} from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../lib/utils';

const guardianSchema = z.object({
  id: z.string().optional(),
  full_name: z.string().min(1, 'Họ tên phụ huynh là bắt buộc'),
  relationship: z.enum(['cha', 'me', 'ong', 'ba', 'khac']),
  phone: z.string().min(10, 'Số điện thoại tối thiểu 10 số').max(11, 'Số điện thoại tối đa 11 số'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  occupation: z.string().optional().nullable(),
  is_primary: z.boolean().default(false),
});

const studentFormSchema = z.object({
  full_name: z.string().min(1, 'Họ tên học sinh là bắt buộc'),
  student_code: z.string().min(1, 'Mã học sinh là bắt buộc'),
  date_of_birth: z.string().min(1, 'Ngày sinh là bắt buộc'),
  gender: z.enum(['male', 'female']),
  class_id: z.string().nullable().optional().or(z.literal('')),
  address: z.string().optional().nullable(),
  enrollment_date: z.string().optional(),
  status: z.enum(['active', 'suspended', 'graduated', 'transferred']).default('active'),
  profile_image_url: z.string().nullable().optional(),
  medical_notes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  guardians: z.array(guardianSchema).min(1, 'Phải có ít nhất một phụ huynh/người giám hộ'),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

interface StudentFormProps {
  student?: any; // If editing
  classesList: any[];
  onSuccess?: () => void;
}

export const StudentForm: React.FC<StudentFormProps> = ({
  student,
  classesList,
  onSuccess,
}) => {
  const { closePanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  
  const [activeTab, setActiveTab] = useState<'info' | 'guardians'>('info');
  const [loading, setLoading] = useState(false);

  // Map initial values
  const defaultValues: StudentFormValues = {
    full_name: student?.full_name || '',
    student_code: student?.student_code || `HS${Math.floor(100000 + Math.random() * 900000)}`,
    date_of_birth: student?.date_of_birth ? student.date_of_birth.split('T')[0] : '',
    gender: student?.gender || 'male',
    class_id: student?.class_id || '',
    address: student?.address || '',
    enrollment_date: student?.enrollment_date ? student.enrollment_date.split('T')[0] : new Date().toISOString().split('T')[0],
    status: student?.status || 'active',
    profile_image_url: student?.profile_image_url || '',
    medical_notes: student?.medical_notes || '',
    allergies: student?.allergies || '',
    guardians: student?.guardians?.map((g: any) => ({
      id: g.id,
      full_name: g.full_name,
      relationship: g.relationship,
      phone: g.phone,
      email: g.email || '',
      occupation: g.occupation || '',
      is_primary: g.is_primary || false,
    })) || [{ full_name: '', relationship: 'me', phone: '', email: '', occupation: '', is_primary: true }],
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema) as any,
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'guardians',
  });

  const profileImageUrl = watch('profile_image_url');

  const onSubmit = async (values: StudentFormValues) => {
    setLoading(true);
    try {
      const studentPayload = {
        school_id: schoolId,
        full_name: values.full_name,
        student_code: values.student_code,
        date_of_birth: values.date_of_birth,
        gender: values.gender,
        class_id: values.class_id || null,
        address: values.address || null,
        enrollment_date: values.enrollment_date || new Date().toISOString().split('T')[0],
        status: values.status,
        profile_image_url: values.profile_image_url || null,
        medical_notes: values.medical_notes || null,
        allergies: values.allergies || null,
      };

      if (student?.id) {
        // 1. Update Student
        const studentRes = await api.update('students', student.id, studentPayload);
        if (studentRes.error) throw new Error(studentRes.error);

        // 2. Handle Guardians Update
        const currentGuardians = values.guardians;
        const existingGuardians = student.guardians || [];

        // Find deleted guardians
        const deletedGuardians = existingGuardians.filter(
          (eg: any) => !currentGuardians.some((cg) => cg.id === eg.id)
        );

        // Delete removed guardians
        for (const dg of deletedGuardians) {
          await api.remove('guardians', dg.id);
        }

        // Update or Insert current guardians
        for (const cg of currentGuardians) {
          const guardianPayload = {
            student_id: student.id,
            full_name: cg.full_name,
            relationship: cg.relationship,
            phone: cg.phone,
            email: cg.email || null,
            occupation: cg.occupation || null,
            is_primary: cg.is_primary,
          };

          if (cg.id) {
            await api.update('guardians', cg.id, guardianPayload);
          } else {
            await api.create('guardians', guardianPayload);
          }
        }

        toast.success('Cập nhật học sinh thành công!');
      } else {
        // 1. Create Student
        const studentRes = await api.create('students', studentPayload) as { data: any; error: any };
        if (studentRes.error) throw new Error(studentRes.error);
        const newStudentId = studentRes.data.id;

        // 2. Create Guardians
        const guardiansPayload = values.guardians.map((g) => ({
          student_id: newStudentId,
          full_name: g.full_name,
          relationship: g.relationship,
          phone: g.phone,
          email: g.email || null,
          occupation: g.occupation || null,
          is_primary: g.is_primary,
        }));

        const guardiansRes = await api.createMany('guardians', guardiansPayload);
        if (guardiansRes.error) throw new Error(guardiansRes.error);

        toast.success('Thêm học sinh mới thành công!');
      }

      // Invalidate query to refresh students list
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      if (onSuccess) onSuccess();
      closePanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi lưu thông tin', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = (index: number) => {
    // Set all primary to false, and then selected index to true
    fields.forEach((_, idx) => {
      setValue(`guardians.${idx}.is_primary`, idx === index);
    });
  };

  return (
    <div className="flex flex-col gap-5 select-none h-full bg-surface p-6">
        {/* Navigation Tabs inside Modal */}
        <Tabs
          tabs={[
            { id: 'info', label: 'Thông tin trẻ', icon: <User className="w-4 h-4" /> },
            { id: 'guardians', label: 'Thông tin phụ huynh', icon: <Phone className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as any)}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'info' && (
            <div className="space-y-5 animate-fade-in">
              {/* Profile Image & Basic Info */}
              <div className="flex flex-col md:flex-row gap-5 items-start">
                <div className="w-full md:w-1/3">
                  <FileUpload
                    bucket="avatars"
                    folderPath="students"
                    label="Ảnh đại diện"
                    value={profileImageUrl || ''}
                    onChange={(url) => setValue('profile_image_url', url)}
                    error={errors.profile_image_url?.message}
                  />
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  <Input
                    label="Họ và tên trẻ"
                    placeholder="Nhập họ tên đầy đủ..."
                    error={errors.full_name?.message}
                    {...register('full_name')}
                  />

                  <Input
                    label="Mã học sinh"
                    placeholder="HS123456..."
                    error={errors.student_code?.message}
                    {...register('student_code')}
                  />

                  <Input
                    label="Ngày sinh"
                    type="date"
                    error={errors.date_of_birth?.message}
                    {...register('date_of_birth')}
                  />

                  <Select
                    label="Giới tính"
                    options={[
                      { value: 'male', label: 'Nam' },
                      { value: 'female', label: 'Nữ' },
                    ]}
                    error={errors.gender?.message}
                    {...register('gender')}
                  />
                </div>
              </div>

              {/* Class, enrollment, address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Xếp lớp"
                  options={[
                    { value: '', label: 'Chưa xếp lớp' },
                    ...classesList.map((c) => {
                      const gradeLabels: Record<string, string> = {
                        nha_tre: 'Nhà trẻ',
                        mam: 'Mầm',
                        choi: 'Chồi',
                        la: 'Lá'
                      };
                      const gradeLabel = c.grade_level ? gradeLabels[c.grade_level] : null;
                      return {
                        value: c.id,
                        label: gradeLabel ? `${c.name} (${gradeLabel})` : c.name,
                      };
                    }),
                  ]}
                  error={errors.class_id?.message}
                  {...register('class_id')}
                />

                <Input
                  label="Ngày nhập học"
                  type="date"
                  error={errors.enrollment_date?.message}
                  {...register('enrollment_date')}
                />

                {student && (
                  <Select
                    label="Trạng thái"
                    options={[
                      { value: 'active', label: 'Đang học' },
                      { value: 'suspended', label: 'Tạm nghỉ' },
                      { value: 'graduated', label: 'Tốt nghiệp' },
                      { value: 'transferred', label: 'Chuyển trường' },
                    ]}
                    error={errors.status?.message}
                    {...register('status')}
                  />
                )}

                <div className={student ? "sm:col-span-1" : "sm:col-span-2"}>
                  <Input
                    label="Địa chỉ liên hệ"
                    placeholder="Số nhà, đường, thôn/xóm, xã/phường, tỉnh..."
                    error={errors.address?.message}
                    {...register('address')}
                  />
                </div>
              </div>

              {/* Health Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Textarea
                  label="Dị ứng thức ăn / thuốc"
                  placeholder="Nhập thức ăn hoặc thành phần dị ứng nếu có..."
                  error={errors.allergies?.message}
                  {...register('allergies')}
                />
                
                <Textarea
                  label="Ghi chú y tế"
                  placeholder="Tiền sử bệnh lý, lưu ý đặc biệt cho giáo viên chăm sóc..."
                  error={errors.medical_notes?.message}
                  {...register('medical_notes')}
                />
              </div>
            </div>
          )}

          {activeTab === 'guardians' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-on-surface">Danh sách người giám hộ</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ full_name: '', relationship: 'me', phone: '', email: '', occupation: '', is_primary: fields.length === 0 })}
                  className="rounded-xl flex items-center gap-1.5 cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm phụ huynh
                </Button>
              </div>

              <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                {fields.map((field, index) => {
                  const isPrimary = watch(`guardians.${index}.is_primary`);
                  
                  return (
                    <div 
                      key={field.id}
                      className="border border-outline-variant/40 rounded-2xl p-4 space-y-4 relative bg-surface-container-low/20"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Phụ huynh #{index + 1}</span>
                        
                        <div className="flex items-center gap-3">
                          {/* Set Primary Button */}
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(index)}
                            className={cn(
                              "flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer",
                              isPrimary
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-transparent text-on-surface-variant hover:text-on-surface border-outline-variant"
                            )}
                          >
                            <Check className="w-3 h-3" />
                            {isPrimary ? 'Người nhận liên lạc chính' : 'Đặt làm người liên lạc chính'}
                          </button>

                          {/* Delete Button */}
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-error hover:bg-error/5 p-1.5 rounded-xl transition-colors cursor-pointer"
                              title="Xóa phụ huynh"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Họ và tên"
                          placeholder="Nhập họ tên phụ huynh..."
                          leftIcon={<User />}
                          error={errors.guardians?.[index]?.full_name?.message}
                          {...register(`guardians.${index}.full_name` as const)}
                        />

                        <Select
                          label="Quan hệ với bé"
                          options={[
                            { value: 'cha', label: 'Bố' },
                            { value: 'me', label: 'Mẹ' },
                            { value: 'ong', label: 'Ông' },
                            { value: 'ba', label: 'Bà' },
                            { value: 'khac', label: 'Người giám hộ khác' },
                          ]}
                          error={errors.guardians?.[index]?.relationship?.message}
                          {...register(`guardians.${index}.relationship` as const)}
                        />

                        <Input
                          label="Số điện thoại"
                          placeholder="09xxxxxxxx..."
                          leftIcon={<Phone />}
                          error={errors.guardians?.[index]?.phone?.message}
                          {...register(`guardians.${index}.phone` as const)}
                        />

                        <Input
                          label="Địa chỉ email"
                          placeholder="parent@example.com..."
                          leftIcon={<Mail />}
                          error={errors.guardians?.[index]?.email?.message}
                          {...register(`guardians.${index}.email` as const)}
                        />

                        <div className="sm:col-span-2">
                          <Input
                            label="Nghề nghiệp"
                            placeholder="Ví dụ: Công nhân, Giáo viên, Kinh doanh..."
                            leftIcon={<Briefcase />}
                            error={errors.guardians?.[index]?.occupation?.message}
                            {...register(`guardians.${index}.occupation` as const)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-outline-variant/40 mt-6 shrink-0">
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
              {student ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </form>
      </div>
  );
};
