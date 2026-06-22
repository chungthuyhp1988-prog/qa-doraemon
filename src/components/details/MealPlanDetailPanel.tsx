import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Flame, 
  Coffee, 
  UtensilsCrossed, 
  Apple, 
  User, 
  Edit2, 
  Trash2, 
  FileText,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { MealPlanForm } from '../forms/MealPlanForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';

interface MealPlanDetailPanelProps {
  mealPlanId: string;
  classesList: any[];
  onDeleteSuccess?: () => void;
}

export const MealPlanDetailPanel: React.FC<MealPlanDetailPanelProps> = ({
  mealPlanId,
  classesList,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch Meal Plan Detail
  const { data: mealResponse, isLoading: isLoadingMeal } = useQuery({
    queryKey: ['meal-plan-detail', mealPlanId],
    queryFn: () => api.getById('meal_plans', mealPlanId, '*, classes(name), users(full_name)')
  });
  const mealPlan = mealResponse?.data;

  const handleEdit = () => {
    if (!mealPlan) return;
    openPanel({
      title: 'Chỉnh sửa thực đơn',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <MealPlanForm 
          mealPlan={mealPlan} 
          classesList={classesList} 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['meal-plan-detail', mealPlanId] });
            queryClient.invalidateQueries({ queryKey: ['meal-plans-weekly'] });
          }}
        />
      )
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await api.remove('meal_plans', mealPlanId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa món thực đơn thành công!');
      queryClient.invalidateQueries({ queryKey: ['meal-plans-weekly'] });
      setIsDeleteDialogOpen(false);
      closePanel();
      if (onDeleteSuccess) onDeleteSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa thực đơn', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getMealTypeLabel = (type: string) => {
    switch (type) {
      case 'breakfast': return 'Bữa Sáng';
      case 'lunch': return 'Bữa Trưa';
      case 'afternoon_snack': return 'Bữa Phụ chiều';
      default: return type;
    }
  };

  const getMealTypeIcon = (type: string) => {
    switch (type) {
      case 'breakfast':
        return <Coffee className="w-5 h-5 text-amber-500" />;
      case 'lunch':
        return <UtensilsCrossed className="w-5 h-5 text-primary" />;
      case 'afternoon_snack':
        return <Apple className="w-5 h-5 text-success" />;
      default:
        return null;
    }
  };

  if (isLoadingMeal) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-20 animate-pulse space-y-4">
        <div className="w-16 h-16 bg-surface-container rounded-full" />
        <div className="h-4 bg-surface-container rounded w-1/3" />
        <div className="h-3 bg-surface-container rounded w-1/4" />
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy thông tin thực đơn.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      
      {/* ═══ DETAIL HEADER ═══ */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl overflow-hidden border border-primary/20 shrink-0 flex items-center justify-center">
            {getMealTypeIcon(mealPlan.meal_type)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
                Chi tiết thực đơn: {getMealTypeLabel(mealPlan.meal_type)}
              </h2>
            </div>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Áp dụng: {mealPlan.classes?.name ? `Riêng lớp ${mealPlan.classes.name}` : 'Toàn trường'}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5">
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
        </div>
      </div>

      {/* ═══ DETAIL CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Main Info */}
        <div className="bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs space-y-5">
          <div>
            <h4 className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">Ngày áp dụng thực đơn</h4>
            <div className="flex items-center gap-2 text-on-surface font-semibold text-sm">
              <Calendar className="w-4.5 h-4.5 text-primary" />
              <span className="capitalize">{formatDate(mealPlan.date)}</span>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">Lớp áp dụng</h4>
            <div className="flex items-center gap-2 text-on-surface font-semibold text-sm">
              <Layers className="w-4.5 h-4.5 text-primary" />
              <span>{mealPlan.classes?.name ? `Lớp ${mealPlan.classes.name}` : 'Thực đơn chung toàn trường'}</span>
            </div>
          </div>

          {mealPlan.calories && (
            <div>
              <h4 className="text-[11px] font-extrabold text-on-surface-variant uppercase tracking-wider mb-2">Hàm lượng dinh dưỡng dự kiến</h4>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold">
                <Flame className="w-4 h-4 shrink-0" />
                {mealPlan.calories} kcal / bé
              </div>
            </div>
          )}
        </div>

        {/* Menu Items list */}
        <div className="bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs space-y-3">
          <h4 className="text-[12px] font-extrabold text-primary uppercase tracking-wider border-b border-outline-variant/20 pb-2 flex items-center gap-1.5">
            <UtensilsCrossed className="w-4 h-4" /> Danh sách món ăn chi tiết
          </h4>
          <p className="text-[14.5px] font-semibold text-on-surface whitespace-pre-line leading-relaxed pl-1 pt-1">
            {mealPlan.menu_items}
          </p>
        </div>

        {/* Allergy warnings or notes */}
        {mealPlan.notes && (
          <div className="bg-red-50/40 p-5 rounded-2xl border border-red-100 space-y-2">
            <h4 className="text-xs font-extrabold text-red-600 flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              Lưu ý & Ghi chú dinh dưỡng
            </h4>
            <p className="text-xs text-on-surface font-semibold leading-relaxed">
              {mealPlan.notes}
            </p>
          </div>
        )}

        {/* Metadata Creator */}
        {mealPlan.users?.full_name && (
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-medium justify-end pr-1">
            <User className="w-3.5 h-3.5" />
            <span>Người lập thực đơn: <strong>{mealPlan.users.full_name}</strong></span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Xóa thực đơn?"
        message="Bạn có chắc chắn muốn xóa thực đơn này khỏi bảng biểu dinh dưỡng tuần? Thao tác này không thể khôi phục."
        confirmText="Xóa thực đơn"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
