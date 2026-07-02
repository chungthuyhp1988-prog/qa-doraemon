import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { uploadFile } from '../../lib/supabase';
import { toast } from '../../stores/toastStore';
import { Input, Button } from '../ui';
import { Avatar } from '../ui/Avatar';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Họ tên là bắt buộc'),
  phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
});

type ProfileValues = z.infer<typeof profileSchema>;

interface ProfileSettingsTabProps {
  user: any;
  setUser: (user: any) => void;
}

export const ProfileSettingsTab: React.FC<ProfileSettingsTabProps> = ({
  user,
  setUser,
}) => {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema) as any,
    values: user
      ? {
          full_name: user.full_name || '',
          phone: user.phone || '',
          job_title: user.job_title || '',
        }
      : undefined,
  });

  const onSaveProfile = async (values: ProfileValues) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.update('users', user.id, {
        ...values,
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);

      setUser({
        ...user,
        ...values,
      });

      toast.success('Cập nhật hồ sơ cá nhân thành công!');
    } catch (err) {
      toast.error('Lỗi cập nhật hồ sơ', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setLoading(true);
    try {
      toast.info('Đang tải ảnh lên...');

      const fileExt = file.name.split('.').pop();
      const path = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const publicUrl = await uploadFile('avatars', path, file);

      const res = await api.update('users', user.id, {
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);

      setUser({
        ...user,
        avatar_url: publicUrl,
      });

      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch (err) {
      toast.error('Lỗi tải ảnh', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Hồ sơ cá nhân
        </h2>
        <p className="text-xs text-on-surface-variant">
          Cập nhật thông tin cá nhân và ảnh đại diện tài khoản của bạn.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="flex flex-col items-center gap-4 shrink-0 w-full md:w-auto">
          <Avatar
            src={user?.avatar_url || undefined}
            name={user?.full_name || 'U'}
            size="lg"
            className="w-24 h-24 text-2xl ring-4 ring-primary/20"
          />
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={loading}
              className="hidden"
              id="avatar-upload-input"
            />
            <label
              htmlFor="avatar-upload-input"
              className="px-4 py-2 border border-outline-variant/60 hover:bg-surface-container rounded-xl text-xs font-bold text-on-surface transition-all cursor-pointer block text-center"
            >
              Thay ảnh đại diện
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSaveProfile)} className="flex-1 w-full space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Họ và tên"
              placeholder="Nhập họ tên của bạn..."
              error={errors.full_name?.message}
              {...register('full_name')}
            />

            <Input
              label="Số điện thoại"
              placeholder="Nhập số điện thoại..."
              error={errors.phone?.message}
              {...register('phone')}
            />

            <div className="sm:col-span-2">
              <Input
                label="Chức danh / Vị trí công việc"
                placeholder="Ví dụ: Giáo viên chủ nhiệm lớp Mầm 1"
                error={errors.job_title?.message}
                {...register('job_title')}
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
              Lưu thông tin cá nhân
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
