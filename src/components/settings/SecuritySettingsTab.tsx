import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../stores/toastStore';
import { Input, Button } from '../ui';

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
    confirmPassword: z.string().min(6, 'Xác nhận mật khẩu tối thiểu 6 ký tự'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export const SecuritySettingsTab: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema) as any,
  });

  const onChangePassword = async (values: PasswordValues) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;

      toast.success('Thay đổi mật khẩu tài khoản thành công!');
      reset({ password: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Lỗi khi đổi mật khẩu', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          Đổi mật khẩu tài khoản
        </h2>
        <p className="text-xs text-on-surface-variant">
          Nên thiết lập mật khẩu mạnh có chứa ký tự chữ cái, chữ số để bảo mật tuyệt đối cho tài khoản.
        </p>
      </div>

      <form onSubmit={handleSubmit(onChangePassword)} className="space-y-5 max-w-md">
        <div className="p-4 rounded-2xl bg-warning-container/10 border border-warning-container/20 flex gap-3 text-xs text-warning leading-relaxed font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          Đổi mật khẩu tài khoản sẽ ảnh hưởng đến toàn bộ người dùng. Hãy chỉ thay đổi khi được cấp quyền từ quản trị viên.
        </div>

        <Input
          label="Mật khẩu mới"
          type="password"
          placeholder="Nhập mật khẩu mới..."
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Xác nhận mật khẩu mới"
          type="password"
          placeholder="Nhập lại mật khẩu mới..."
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="flex justify-end pt-4 border-t border-outline-variant/20">
          <Button
            type="submit"
            loading={loading}
            disabled={loading}
            className="rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            Thay đổi mật khẩu
          </Button>
        </div>
      </form>
    </div>
  );
};
