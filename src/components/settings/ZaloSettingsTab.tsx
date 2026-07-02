import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MessageSquare, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { useQueryClient } from '@tanstack/react-query';
import { Input, Button } from '../ui';
import type { SchoolRow } from '../../types';

const zaloSchema = z.object({
  zalo_oa_id: z.string().min(1, 'Zalo OA ID là bắt buộc'),
  zalo_access_token: z.string().min(1, 'Access Token là bắt buộc'),
  zalo_refresh_token: z.string().optional(),
  zalo_template_fee: z.string().optional(),
  zalo_template_attendance: z.string().optional(),
});

type ZaloValues = z.infer<typeof zaloSchema>;

interface ZaloSettingsTabProps {
  schoolData: SchoolRow | null;
  isLoadingSchool: boolean;
}

export const ZaloSettingsTab: React.FC<ZaloSettingsTabProps> = ({
  schoolData,
  isLoadingSchool,
}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ZaloValues>({
    resolver: zodResolver(zaloSchema) as any,
    values: schoolData
      ? {
          zalo_oa_id: schoolData.zalo_oa_id || '',
          zalo_access_token: schoolData.zalo_access_token || '',
          zalo_refresh_token: schoolData.zalo_refresh_token || '',
          zalo_template_fee: schoolData.zalo_template_fee || '',
          zalo_template_attendance: schoolData.zalo_template_attendance || '',
        }
      : undefined,
  });

  const onSaveZalo = async (values: ZaloValues) => {
    if (!schoolData?.id) return;
    setLoading(true);
    try {
      const res = await api.update('schools', schoolData.id, {
        ...values,
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);

      toast.success('Cập nhật cấu hình Zalo OA thành công!');
      queryClient.invalidateQueries({ queryKey: ['school-details'] });
    } catch (err) {
      toast.error('Lỗi khi lưu cấu hình', err instanceof Error ? err.message : 'Lỗi hệ thống');
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
          <MessageSquare className="w-5 h-5 text-primary" />
          Cấu hình Zalo OA & ZNS
        </h2>
        <p className="text-xs text-on-surface-variant">
          Cấu hình kết nối Zalo Official Account để tự động gửi thông báo học phí, điểm danh đến phụ huynh học sinh.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSaveZalo)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Zalo OA ID"
            placeholder="Nhập ID Zalo OA của nhà trường..."
            error={errors.zalo_oa_id?.message}
            {...register('zalo_oa_id')}
          />

          <Input
            label="Access Token"
            placeholder="Zalo API Access Token..."
            error={errors.zalo_access_token?.message}
            {...register('zalo_access_token')}
          />

          <Input
            label="Refresh Token"
            placeholder="Zalo API Refresh Token..."
            error={errors.zalo_refresh_token?.message}
            {...register('zalo_refresh_token')}
          />

          <Input
            label="Template ID Nhắc học phí (ZNS)"
            placeholder="Ví dụ: 123456"
            error={errors.zalo_template_fee?.message}
            {...register('zalo_template_fee')}
          />

          <div className="sm:col-span-2">
            <Input
              label="Template ID Điểm danh hàng ngày (ZNS)"
              placeholder="Ví dụ: 789012"
              error={errors.zalo_template_attendance?.message}
              {...register('zalo_template_attendance')}
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
            Lưu cấu hình Zalo OA
          </Button>
        </div>
      </form>
    </div>
  );
};
