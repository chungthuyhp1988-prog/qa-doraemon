import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building, Phone, Mail, MapPin, User, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { useQueryClient } from '@tanstack/react-query';
import { Input, Button } from '../ui';
import type { SchoolRow } from '../../types';

const schoolSchema = z.object({
  name: z.string().min(1, 'Tên trường học là bắt buộc'),
  address: z.string().min(1, 'Địa chỉ trường học là bắt buộc'),
  phone: z.string().min(10, 'Số điện thoại không hợp lệ').max(11, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').min(1, 'Email là bắt buộc'),
  principal_name: z.string().min(1, 'Họ tên Hiệu trưởng là bắt buộc'),
});

type SchoolValues = z.infer<typeof schoolSchema>;

interface SchoolSettingsTabProps {
  schoolData: SchoolRow | null;
  isLoadingSchool: boolean;
}

export const SchoolSettingsTab: React.FC<SchoolSettingsTabProps> = ({
  schoolData,
  isLoadingSchool,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SchoolValues>({
    resolver: zodResolver(schoolSchema) as any,
    values: schoolData
      ? {
          name: schoolData.name || '',
          address: schoolData.address || '',
          phone: schoolData.phone || '',
          email: schoolData.email || '',
          principal_name: schoolData.principal_name || '',
        }
      : undefined,
  });

  const onSaveSchool = async (values: SchoolValues) => {
    if (!schoolData?.id) return;
    setLoading(true);
    try {
      const res = await api.update('schools', schoolData.id, {
        ...values,
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);

      toast.success('Cập nhật thông tin trường thành công!');
      queryClient.invalidateQueries({ queryKey: ['school-details'] });
    } catch (err) {
      toast.error('Lỗi lưu thông tin', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingSchool) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-surface-container-low rounded-xl" />
        <div className="h-10 bg-surface-container-low rounded-xl" />
        <div className="h-10 bg-surface-container-low rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" />
          Hồ sơ trường học
        </h2>
        <p className="text-xs text-on-surface-variant">
          Thông tin chính thức của trường mầm non dùng cho các báo cáo, thông báo và học phí.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSaveSchool)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tên trường học"
            placeholder="Ví dụ: Trường Mầm Non Doraemon"
            leftIcon={<Building className="w-4 h-4" />}
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="Người đại diện / Hiệu trưởng"
            placeholder="Nhập tên hiệu trưởng..."
            leftIcon={<User className="w-4 h-4" />}
            error={errors.principal_name?.message}
            {...register('principal_name')}
          />

          <Input
            label="Số điện thoại liên hệ"
            placeholder="Ví dụ: 024xxxxxxx"
            leftIcon={<Phone className="w-4 h-4" />}
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Input
            label="Địa chỉ email trường"
            placeholder="contact@doraemon.edu.vn"
            leftIcon={<Mail className="w-4 h-4" />}
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="sm:col-span-2">
            <Input
              label="Địa chỉ trường học"
              placeholder="Nhập địa chỉ đầy đủ của cơ sở chính..."
              leftIcon={<MapPin className="w-4 h-4" />}
              error={errors.address?.message}
              {...register('address')}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-outline-variant/20">
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Lưu thông tin trường
          </Button>
        </div>
      </form>
    </div>
  );
};
