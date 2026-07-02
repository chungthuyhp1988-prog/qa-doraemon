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
  citizen_id: z.string().optional().nullable().or(z.literal('')),
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
  status: z.enum(['active', 'registered', 'waiting', 'suspended', 'graduated', 'transferred', 'future']).default('active'),
  profile_image_url: z.string().nullable().optional(),
  medical_notes: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  priority_status: z.string().optional().nullable(),
  registration_date: z.string().optional().nullable(),
  target_school_year: z.string().optional().nullable(),
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
  const [loading, setLoading] = useState(false);

  // Map initial values
  const defaultValues: StudentFormValues = {
    full_name: student?.full_name || '',
    student_code: student?.student_code || `HS${Math.floor(100000 + Math.random() * 900000)}`,
    date_of_birth: student?.date_of_birth ? student.date_of_birth.split('T')[0] : '',
    gender: student?.gender || 'male',
    class_id: student?.class_id || '',
    address: student?.address || '',
    enrollment_date: student?.enrollment_date ? student.enrollment_date.substring(0, 7) : new Date().toISOString().substring(0, 7),
    status: student?.status === 'waiting' && student?.target_school_year === '2027-2028' ? 'future' : (student?.status || 'active'),
    profile_image_url: student?.profile_image_url || '',
    medical_notes: student?.medical_notes || '',
    allergies: student?.allergies || '',
    priority_status: student?.priority_status || '',
    registration_date: student?.registration_date ? student.registration_date.split('T')[0] : '',
    target_school_year: student?.target_school_year || '',
    guardians: student?.guardians?.map((g: any) => ({
      id: g.id,
      full_name: g.full_name,
      relationship: g.relationship,
      phone: g.phone,
      email: g.email || '',
      occupation: g.occupation || '',
      citizen_id: g.citizen_id || '',
      is_primary: g.is_primary || false,
    })) || [{ full_name: '', relationship: 'me', phone: '', email: '', occupation: '', citizen_id: '', is_primary: true }],
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
      let statusValue = values.status;
      let targetSchoolYearValue = values.target_school_year || null;

      if (values.status === 'future') {
        statusValue = 'waiting';
        targetSchoolYearValue = '2027-2028';
      } else if (values.status === 'waiting') {
        statusValue = 'waiting';
        if (!targetSchoolYearValue) {
          targetSchoolYearValue = '2026-2027';
        }
      } else {
        targetSchoolYearValue = null;
      }

      let enrollmentDateVal = new Date().toISOString().split('T')[0];
      if (values.enrollment_date) {
        if (values.enrollment_date.includes('-') && values.enrollment_date.split('-').length === 2) {
          enrollmentDateVal = `${values.enrollment_date}-01`;
        } else {
          enrollmentDateVal = values.enrollment_date;
        }
      }

      const studentPayload = {
        school_id: schoolId,
        full_name: values.full_name,
        student_code: values.student_code,
        date_of_birth: values.date_of_birth,
        gender: values.gender,
        class_id: values.class_id || null,
        address: values.address || null,
        enrollment_date: enrollmentDateVal,
        status: statusValue as any,
        profile_image_url: values.profile_image_url || null,
        medical_notes: values.medical_notes || null,
        allergies: values.allergies || null,
        priority_status: values.priority_status || null,
        registration_date: values.registration_date || null,
        target_school_year: targetSchoolYearValue,
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
            citizen_id: cg.citizen_id || null,
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
          citizen_id: g.citizen_id || null,
          is_primary: g.is_primary,
        }));

        const guardiansRes = await api.createMany('guardians', guardiansPayload as any[]);
        if (guardiansRes.error) throw new Error(guardiansRes.error);

        toast.success('Thêm học sinh mới thành công!');
      }

      // Invalidate query to refresh students list
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['students-list-counts'] });
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
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto pr-1 space-y-6">
        
        {/* ── PHẦN 1: THÔNG TIN CỦA TRẺ ── */}
        <div className="bg-white border border-outline-variant/30 rounded-2xl p-5 space-y-5">
          <h4 className="text-sm font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 mb-3">
            1. Thông tin của trẻ
          </h4>
          
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
              label="Tháng nhập học dự kiến"
              type="month"
              error={errors.enrollment_date?.message}
              {...register('enrollment_date')}
            />

            <Select
              label="Trạng thái học sinh"
              options={[
                { value: 'active', label: 'Đang học' },
                { value: 'registered', label: 'Đã ghi danh' },
                { value: 'waiting', label: 'Danh sách chờ' },
                { value: 'suspended', label: 'Tạm nghỉ' },
                { value: 'graduated', label: 'Đã tốt nghiệp' },
                { value: 'transferred', label: 'Đã chuyển trường' },
              ]}
              error={errors.status?.message}
              {...register('status')}
            />

            {(() => {
              const currentStatus = watch('status');
              if (currentStatus === 'waiting' || currentStatus === 'future' || currentStatus === 'registered') {
                return (
                  <>
                    <Input
                      type="date"
                      label={currentStatus === 'registered' ? "Ngày ghi danh" : "Ngày đăng ký chờ"}
                      error={errors.registration_date?.message}
                      {...register('registration_date')}
                    />
                    <Input
                      label="Năm học đăng ký"
                      placeholder="Ví dụ: 2027-2028..."
                      error={errors.target_school_year?.message}
                      {...register('target_school_year')}
                    />
                    <div className="sm:col-span-2 space-y-2">
                      <label className="text-[13px] font-extrabold text-on-surface-variant uppercase tracking-wider block">
                        Đối tượng ưu tiên
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { value: '', label: 'Không ưu tiên' },
                          { value: 'Con GVNV', label: 'Ưu tiên 1 (Con GVNV)' },
                          { value: 'Anh chị đang học ở trường', label: 'Ưu tiên 2 (Anh chị đang học ở trường)' },
                          { value: 'HĐQT', label: 'Ưu tiên 3 (HĐQT)' },
                          { value: 'Phụ huynh cũ', label: 'Ưu tiên 4 (Phụ huynh cũ)' }
                        ].map((opt) => {
                          const isChecked = watch('priority_status') === opt.value || (!watch('priority_status') && opt.value === '');
                          return (
                            <label
                              key={opt.value}
                              className={cn(
                                "border rounded-xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-surface-container select-none min-h-[54px]",
                                isChecked
                                  ? "border-primary bg-primary/5 text-primary font-bold shadow-2xs"
                                  : "border-outline-variant/60 text-on-surface-variant"
                              )}
                            >
                              <input
                                type="radio"
                                value={opt.value}
                                className="sr-only"
                                {...register('priority_status')}
                              />
                              <span className="text-[12px] leading-tight">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      {errors.priority_status?.message && (
                        <p className="text-[11px] font-bold text-error mt-1">
                          {errors.priority_status.message}
                        </p>
                      )}
                    </div>
                  </>
                );
              }
              return null;
            })()}

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

        {/* ── PHẦN 2: THÔNG TIN PHỤ HUYNH / NGƯỜI GIÁM HỘ ── */}
        <div className="bg-white border border-outline-variant/30 rounded-2xl p-5 space-y-5">
          <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2 mb-3">
            <h4 className="text-sm font-extrabold text-primary uppercase tracking-wider">
              2. Thông tin phụ huynh / Người giám hộ
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ full_name: '', relationship: 'me', phone: '', email: '', occupation: '', is_primary: fields.length === 0 })}
              className="rounded-xl cursor-pointer text-xs"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Thêm phụ huynh
            </Button>
          </div>

          <div className="space-y-4 pr-1">
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

                    <Input
                      label="Nghề nghiệp"
                      placeholder="Ví dụ: Công nhân, Giáo viên..."
                      leftIcon={<Briefcase />}
                      error={errors.guardians?.[index]?.occupation?.message}
                      {...register(`guardians.${index}.occupation` as const)}
                    />

                    <Input
                      label="Căn cước công dân (CCCD)"
                      placeholder="Nhập số CCCD..."
                      error={errors.guardians?.[index]?.citizen_id?.message}
                      {...register(`guardians.${index}.citizen_id` as const)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
