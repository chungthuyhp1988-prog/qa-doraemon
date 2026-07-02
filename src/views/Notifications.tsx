import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Bell, 
  Mail, 
  MailOpen, 
  Trash2, 
  Calendar, 
  Tag, 
  Users, 
  MessageSquare,
  AlertTriangle,
  Info
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog, useSlidePanel, ErrorState } from "../components/ui";
import { NotificationForm } from "../components/forms/NotificationForm";
import { NotificationDetailPanel } from "../components/details/NotificationDetailPanel";
import { useAuthStore } from "../stores/authStore";
import type { NotificationRow, ClassRow } from "../types";

/** Notification row with joined user info from the `created_by` foreign key. */
interface NotificationWithUser extends NotificationRow {
  users?: { full_name: string; role: string } | null;
}

import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { supabase } from "../lib/supabase";
import { useClassesList } from "../hooks/useClassesList";

export function Notifications() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isPrivileged = user?.role === 'admin' || user?.role === 'teacher';
  const { openPanel } = useSlidePanel();

  // Modal / Form States
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationWithUser | null>(null);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all"); // all, read, unread
  const debouncedSearch = useDebouncedValue(search, 300);

  // 1. Fetch classes for the creation form
  const { classesList } = useClassesList();

  // 2. Fetch notifications list
  const { data: notificationsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications-list', selectedType, selectedStatus, debouncedSearch],
    queryFn: () => {
      const filters: Record<string, string | number | boolean | null> = {};

      if (selectedType !== "all") {
        filters.type = selectedType;
      }

      if (selectedStatus !== "all") {
        filters.is_read = selectedStatus === "read";
      }

      return api.getAll<NotificationWithUser>(
        'notifications',
        { page: 1, pageSize: 100, sortBy: 'sent_at', sortOrder: 'desc' },
        { 
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, users:created_by(full_name, role)'
      );
    }
  });
  const notifications = (notificationsResponse?.data?.data as NotificationWithUser[]) || [];

  const handleMarkAsRead = async (notif: NotificationWithUser) => {
    try {
      const res = await api.update('notifications', notif.id, {
        is_read: true,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);

      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    } catch (err) {
      toast.error('Lỗi', err instanceof Error ? err.message : 'Lỗi hệ thống');
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    if (unread.length === 0) return;
    
    const unreadIds = unread.map(n => n.id);
    
    try {
      toast.info('Đang xử lý...');
      const { error } = await (supabase.from('notifications') as any)
        .update({
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .in('id', unreadIds);

      if (error) throw error;

      toast.success('Đã đánh dấu tất cả thông báo là đã đọc!');
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    } catch (err: any) {
      toast.error('Lỗi', 'Không thể đánh dấu đã đọc toàn bộ');
    }
  };

  const handleDeleteClick = (notif: any) => {
    setSelectedNotification(notif);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedNotification) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('notifications', selectedNotification.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa thông báo thành công!');
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi xóa thông báo', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateNotification = () => {
    openPanel({
      title: 'Soạn thông báo mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <NotificationForm 
          classesList={classesList}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
          }}
        />
      )
    });
  };

  const handleViewDetail = async (notif: any) => {
    if (!notif.is_read) {
      await handleMarkAsRead(notif);
    }
    openPanel({
      title: 'Chi tiết thông báo',
      icon: <Bell size={14} />,
      width: 768,
      component: (
        <NotificationDetailPanel 
          notificationId={notif.id}
          classesList={classesList}
          onDeleteSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
          }}
        />
      )
    });
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'announcement':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Info className="w-3 h-3" />
            Thông báo
          </span>
        );
      case 'reminder':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning-container/30 text-warning border border-warning/20">
            <Calendar className="w-3 h-3" />
            Nhắc nhở
          </span>
        );
      case 'alert':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error-container/20 text-error border border-error/20 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
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
        return 'Cá nhân';
      default:
        return 'Khác';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Thông Báo</h1>
          <p className="text-sm text-on-surface-variant">
            Quản lý thông báo chung của trường, thông báo theo lớp và tương tác với phụ huynh qua Zalo OA.
          </p>
        </div>
        
        <div className="flex gap-2">
          {notifications.some(n => !n.is_read) && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-container border border-outline-variant/40 px-4 py-2.5 rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
            >
              <MailOpen className="w-4 h-4 text-on-surface-variant" />
              Đọc Tất Cả
            </button>
          )}

          {isPrivileged && (
            <button
              onClick={handleCreateNotification}
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Soạn Thông Báo
            </button>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-outline-variant/40 rounded-2xl p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Tìm kiếm nội dung thông báo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-low hover:bg-surface-container-low/80 focus:bg-white text-on-surface placeholder-on-surface-variant pl-10 pr-4 py-2 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-surface-container-low text-on-surface py-2 px-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm font-semibold cursor-pointer"
          >
            <option value="all">Tất cả phân loại</option>
            <option value="announcement">Thông báo chung</option>
            <option value="reminder">Nhắc nhở</option>
            <option value="alert">Khẩn cấp</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-surface-container-low text-on-surface py-2 px-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm font-semibold cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="unread">Chưa đọc</option>
            <option value="read">Đã đọc</option>
          </select>
        </div>
      </div>

      {/* Notifications list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-surface border border-outline-variant/20 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/20">
          <Bell className="w-12 h-12 text-on-surface-variant/40 mb-3 animate-pulse" />
          <h3 className="text-base font-bold text-on-surface mb-1">Hộp thư trống</h3>
          <p className="text-sm text-on-surface-variant text-center max-w-sm">
            Không tìm thấy thông báo nào phù hợp với bộ lọc tìm kiếm hiện tại.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif: any) => {
            const isRead = notif.is_read;
            const senderName = notif.users?.full_name || 'Hệ thống';
            const senderRole = notif.users?.role === 'admin' ? 'BGH' : 'Giáo viên';
            
            return (
              <div
                key={notif.id}
                onClick={() => handleViewDetail(notif)}
                className={cn(
                  "p-5 rounded-3xl border transition-all flex flex-col md:flex-row items-start justify-between gap-4 select-none relative hover:shadow-md cursor-pointer",
                  isRead
                    ? "bg-surface border-outline-variant/40 hover:border-outline"
                    : "bg-primary-container/10 border-primary/50 shadow-sm hover:border-primary"
                )}
              >
                <div className="space-y-2.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping shrink-0" />
                    )}
                    {getTypeBadge(notif.type)}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high/60 text-on-surface-variant border border-outline-variant/20">
                      <Users className="w-3 h-3" />
                      Gửi: {getTargetLabel(notif.target, notif.target_id)}
                    </span>
                  </div>

                  <h3 className={cn(
                    "text-base font-bold text-on-surface tracking-tight",
                    !isRead ? "text-primary" : ""
                  )}>
                    {notif.title}
                  </h3>

                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed max-w-4xl whitespace-pre-line">
                    {notif.content}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant/70 pt-2 border-t border-outline-variant/10">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(notif.sent_at || notif.created_at).toLocaleString('vi-VN')}
                    </span>
                    <span>|</span>
                    <span>Tác giả: <span className="font-semibold text-on-surface">{senderName} ({senderRole})</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-start shrink-0">
                  {!isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(notif);
                      }}
                      className="p-2.5 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-primary transition-all cursor-pointer border border-outline-variant/30"
                      title="Đánh dấu đã đọc"
                    >
                      <MailOpen className="w-4 h-4" />
                    </button>
                  )}
                  {isPrivileged && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(notif);
                      }}
                      className="p-2.5 hover:bg-error-container/20 rounded-xl text-on-surface-variant hover:text-error transition-all cursor-pointer border border-outline-variant/30"
                      title="Xóa thông báo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Xóa thông báo?"
        message="Bạn có chắc chắn muốn xóa thông báo này? Phụ huynh và các giáo viên sẽ không thể xem lại nội dung thông báo này trên bảng tin."
        confirmText="Xóa thông báo"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
}
