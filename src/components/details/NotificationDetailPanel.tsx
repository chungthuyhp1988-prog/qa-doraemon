import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  User, 
  Edit2, 
  Trash2, 
  Bell,
  Users,
  Info,
  AlertTriangle,
  Mail,
  MailOpen
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { NotificationForm } from '../forms/NotificationForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';

interface NotificationDetailPanelProps {
  notificationId: string;
  classesList: any[];
  onDeleteSuccess?: () => void;
}

export const NotificationDetailPanel: React.FC<NotificationDetailPanelProps> = ({
  notificationId,
  classesList,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();
  const user = useAuthStore((state) => state.user);
  const isPrivileged = user?.role === 'admin' || user?.role === 'teacher';

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch Notification Detail
  const { data: notificationResponse, isLoading: isLoadingNotif } = useQuery({
    queryKey: ['notification-detail', notificationId],
    queryFn: () => api.getById('notifications', notificationId, '*, users:created_by(full_name, role)')
  });
  const notification = notificationResponse?.data as any;

  // 2. Fetch specific target name if individual
  const { data: studentResponse } = useQuery({
    queryKey: ['student-target-name', notification?.target_id],
    queryFn: () => {
      if (notification?.target !== 'individual' || !notification?.target_id) return null;
      return api.getById('students', notification.target_id);
    },
    enabled: notification?.target === 'individual' && !!notification?.target_id
  });
  const targetStudent = studentResponse?.data as any;

  const handleEdit = () => {
    if (!notification) return;
    openPanel({
      title: 'Chỉnh sửa thông báo',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <NotificationForm 
          notification={notification} 
          classesList={classesList} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['notification-detail', notificationId] });
            queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
          }}
        />
      )
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.remove('notifications', notificationId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa thông báo thành công!');
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      setIsDeleteDialogOpen(false);
      closePanel();
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa thông báo', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkAsRead = async () => {
    if (!notification || notification.is_read) return;
    try {
      const res = await api.update('notifications', notificationId, {
        is_read: true,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      queryClient.invalidateQueries({ queryKey: ['notification-detail', notificationId] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    } catch (err: any) {
      toast.error('Lỗi', err.message || 'Lỗi hệ thống');
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'announcement':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Info className="w-3.5 h-3.5" />
            Thông báo chung
          </span>
        );
      case 'reminder':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-warning-container/30 text-warning border border-warning/20">
            <Calendar className="w-3.5 h-3.5" />
            Nhắc nhở
          </span>
        );
      case 'alert':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-error-container/20 text-error border border-error/20 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Khẩn cấp
          </span>
        );
      default:
        return null;
    }
  };

  const getTargetLabel = (target: string, targetId: string | null) => {
    switch (target) {
      case 'all':
        return 'Toàn trường';
      case 'class':
        const cls = classesList.find(c => c.id === targetId);
        return `Lớp ${cls?.name || 'Đã phân phối'}`;
      case 'individual':
        return targetStudent ? `Học sinh: ${targetStudent.full_name} (${targetStudent.student_code})` : 'Cá nhân học sinh';
      default:
        return 'Khác';
    }
  };

  if (isLoadingNotif) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 animate-pulse space-y-4">
        <div className="w-16 h-16 bg-surface-container rounded-full" />
        <div className="h-4 bg-surface-container rounded w-1/3" />
        <div className="h-3 bg-surface-container rounded w-1/4" />
      </div>
    );
  }

  if (!notification) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy thông tin thông báo.
      </div>
    );
  }

  const isRead = notification.is_read;
  const senderName = notification.users?.full_name || 'Hệ thống';
  const senderRole = notification.users?.role === 'admin' ? 'BGH' : 'Giáo viên';

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      
      {/* ═══ DETAIL HEADER ═══ */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center border",
            isRead ? "bg-surface border-outline-variant/20 text-on-surface-variant" : "bg-primary-container/20 border-primary/20 text-primary"
          )}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
                {notification.title}
              </h2>
            </div>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Người gửi: {senderName} ({senderRole})
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {!isRead && (
            <Button
              onClick={handleMarkAsRead}
              variant="outline"
              size="sm"
              className="rounded-xl flex items-center gap-1 cursor-pointer text-xs"
            >
              <MailOpen className="w-3.5 h-3.5" /> Đã đọc
            </Button>
          )}
          {isPrivileged && (
            <>
              <Button
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="rounded-xl flex items-center gap-1 cursor-pointer text-xs"
              >
                <Edit2 className="w-3.5 h-3.5" /> Sửa
              </Button>
              <Button
                onClick={() => setIsDeleteDialogOpen(true)}
                variant="outline"
                size="sm"
                className="rounded-xl border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 flex items-center gap-1 cursor-pointer text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ═══ DETAIL CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Metadata Badges */}
        <div className="bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs flex flex-wrap gap-4">
          <div className="flex flex-col gap-1 pr-4 border-r border-outline-variant/20 min-w-[120px]">
            <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider">Phân loại</span>
            <div className="pt-0.5">{getTypeBadge(notification.type)}</div>
          </div>

          <div className="flex flex-col gap-1 pr-4 border-r border-outline-variant/20 min-w-[150px]">
            <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider">Đối tượng nhận</span>
            <span className="text-sm font-semibold text-on-surface flex items-center gap-1.5 pt-0.5">
              <Users className="w-4 h-4 text-primary" />
              {getTargetLabel(notification.target, notification.target_id)}
            </span>
          </div>

          <div className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider">Thời gian gửi</span>
            <span className="text-sm font-semibold text-on-surface flex items-center gap-1.5 pt-0.5">
              <Calendar className="w-4 h-4 text-primary" />
              {new Date(notification.sent_at || notification.created_at).toLocaleString('vi-VN')}
            </span>
          </div>
        </div>

        {/* Notification content body */}
        <div className="bg-white p-6 rounded-2xl border border-outline-variant/40 shadow-xs space-y-4">
          <h3 className="text-sm font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 flex items-center gap-1.5">
            <Mail className="w-4.5 h-4.5" /> Nội dung thông báo
          </h3>
          <p className="text-[15px] text-on-surface whitespace-pre-line leading-relaxed pl-1 pt-1 font-medium">
            {notification.content}
          </p>
        </div>

        {/* Zalo Status info box for demonstration */}
        <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-primary">Thông tin đồng bộ</h5>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Thông báo này đã được đồng bộ để gửi tới hệ thống Zalo OA của phụ huynh có con thuộc đối tượng nhận tin.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Xóa thông báo?"
        message="Bạn có chắc chắn muốn xóa thông báo này? Phụ huynh và các giáo viên sẽ không thể xem lại nội dung thông báo này trên bảng tin."
        confirmText="Xóa thông báo"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
