import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileText, Users, MessageSquare, Bell, UserCheck } from 'lucide-react';
import { 
  Input, 
  Select, 
  Textarea, 
  Button, 
  Switch,
  useSlidePanel
} from '../ui';
import { toast } from '../../stores/toastStore';
import { api } from '../../lib/api';
import { zalo } from '../../lib/zalo';
import { useAuthStore } from '../../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';

const notificationFormSchema = z.object({
  title: z.string().min(1, 'Tiêu đề thông báo là bắt buộc'),
  content: z.string().min(1, 'Nội dung thông báo là bắt buộc'),
  type: z.enum(['announcement', 'reminder', 'alert']).default('announcement'),
  target: z.enum(['all', 'class', 'individual']).default('all'),
  target_id: z.string().optional().nullable().or(z.literal('')),
  send_zalo: z.boolean().default(false),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

interface NotificationFormProps {
  classesList: any[];
  notification?: any; // If editing
  onSuccess?: () => void;
}

export const NotificationForm: React.FC<NotificationFormProps> = ({
  classesList,
  notification,
  onSuccess,
}) => {
  const { closePanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  const currentUserId = useAuthStore((state) => state.user?.id);
  
  const [loading, setLoading] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema) as any,
    defaultValues: {
      title: notification?.title || '',
      content: notification?.content || '',
      type: notification?.type || 'announcement',
      target: notification?.target || 'all',
      target_id: notification?.target_id || '',
      send_zalo: false,
    },
  });

  const selectedTarget = watch('target');

  // Load students for individual target
  useEffect(() => {
    if (selectedTarget === 'individual') {
      const fetchStudents = async () => {
        const res = await api.getAll<any>('students', { page: 1, pageSize: 500, sortBy: 'full_name' }, { filters: { status: 'active' } });
        if (res.data?.data) {
          setStudentsList(res.data.data);
        }
      };
      fetchStudents();
    }
  }, [selectedTarget]);

  const onSubmit = async (values: NotificationFormValues) => {
    setLoading(true);
    try {
      const notificationPayload = {
        school_id: schoolId,
        title: values.title.trim(),
        content: values.content.trim(),
        type: values.type,
        target: values.target,
        target_id: values.target_id || null,
        is_read: false,
        sent_at: notification?.sent_at || new Date().toISOString(),
        created_by: notification?.created_by || currentUserId || null,
        updated_at: new Date().toISOString(),
      };

      if (notification?.id) {
        // 1. Update database record
        const res = await api.update('notifications', notification.id, notificationPayload);
        if (res.error) throw new Error(res.error);
        toast.success('Cập nhật thông báo thành công!');
      } else {
        // 1. Create database notification record
        const res = await api.create('notifications', {
          ...notificationPayload,
          created_at: new Date().toISOString(),
        });
        if (res.error) throw new Error(res.error);

        // 2. Handle Zalo OA integration if enabled (only for new notifications)
        if (values.send_zalo) {
          toast.info('Đang gửi tin nhắn Zalo OA đến phụ huynh...', 'Vui lòng đợi trong giây lát');
          
          let sentCount = 0;
          
          if (values.target === 'individual' && values.target_id) {
            // Fetch student guardians
            const { data: guardiansData } = await api.getAll<any>(
              'guardians', 
              { page: 1, pageSize: 100 }, 
              { filters: { student_id: values.target_id, is_primary: true } }
            );
            const primaryGuardian = guardiansData?.data?.[0];
            if (primaryGuardian?.phone) {
              await zalo.sendNotification(primaryGuardian.phone, values.title, values.content);
              sentCount = 1;
            }
          } else if (values.target === 'class' && values.target_id) {
            // Fetch all students in class
            const { data: studentsData } = await api.getAll<any>(
              'students', 
              { page: 1, pageSize: 100 }, 
              { filters: { class_id: values.target_id, status: 'active' } }
            );
            
            if (studentsData?.data && studentsData.data.length > 0) {
              const studentIds = studentsData.data.map(s => s.id);
              // Fetch guardians for these students
              const { data: guardiansData } = await api.getAll<any>(
                'guardians',
                { page: 1, pageSize: 1000 },
                { filters: { is_primary: true } }
              );
              
              const relevantGuardians = (guardiansData?.data || []).filter(g => studentIds.includes(g.student_id));
              
              for (const guardian of relevantGuardians) {
                if (guardian.phone) {
                  await zalo.sendNotification(guardian.phone, values.title, values.content);
                  sentCount++;
                }
              }
            }
          } else {
            // Send to first 3 primary guardians for demonstration
            const { data: guardiansData } = await api.getAll<any>(
              'guardians',
              { page: 1, pageSize: 3 },
              { filters: { is_primary: true } }
            );
            
            for (const guardian of (guardiansData?.data || [])) {
              if (guardian.phone) {
                await zalo.sendNotification(guardian.phone, values.title, values.content);
                sentCount++;
              }
            }
          }
          
          toast.success(`Đã gửi ${sentCount} tin nhắn Zalo OA thành công!`);
        } else {
          toast.success('Gửi thông báo thành công!');
        }
      }

      // Invalidate queries to refresh list
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      if (onSuccess) onSuccess();
      closePanel();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi gửi thông báo', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 select-none h-full bg-surface p-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 select-none flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
        <Input
          label="Tiêu đề thông báo"
          placeholder="Nhập tiêu đề thông báo..."
          leftIcon={<Bell />}
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Loại thông báo"
            options={[
              { value: 'announcement', label: 'Thông báo chung' },
              { value: 'reminder', label: 'Nhắc nhở' },
              { value: 'alert', label: 'Cảnh báo khẩn cấp' },
            ]}
            error={errors.type?.message}
            {...register('type')}
          />

          <Select
            label="Đối tượng nhận"
            options={[
              { value: 'all', label: 'Toàn bộ trường học' },
              { value: 'class', label: 'Theo lớp học' },
              { value: 'individual', label: 'Cá nhân học sinh' },
            ]}
            error={errors.target?.message}
            {...register('target')}
          />
        </div>

        {selectedTarget === 'class' && (
          <Select
            label="Chọn lớp nhận thông báo"
            options={[
              { value: '', label: '-- Chọn lớp học --' },
              ...classesList.map((c) => ({ value: c.id, label: `Lớp ${c.name}` })),
            ]}
            error={errors.target_id?.message}
            {...register('target_id')}
          />
        )}

        {selectedTarget === 'individual' && (
          <Select
            label="Chọn học sinh nhận thông báo"
            options={[
              { value: '', label: '-- Chọn học sinh --' },
              ...studentsList.map((s) => ({ value: s.id, label: `${s.full_name} (${s.student_code})` })),
            ]}
            error={errors.target_id?.message}
            {...register('target_id')}
          />
        )}

        <Textarea
          label="Nội dung chi tiết thông báo"
          placeholder="Nhập nội dung thông báo đầy đủ ở đây..."
          rows={5}
          error={errors.content?.message}
          {...register('content')}
        />

        {/* Zalo OA Send Switch */}
        <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-primary" />
              Đồng bộ Zalo OA
            </span>
            <span className="text-xs text-on-surface-variant">
              Tự động gửi tin nhắn SMS Zalo OA trực tiếp tới điện thoại của phụ huynh.
            </span>
          </div>

          <Controller
            control={control}
            name="send_zalo"
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
              {notification ? 'Lưu thay đổi' : 'Gửi thông báo'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
