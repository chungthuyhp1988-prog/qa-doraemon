import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Copy, 
  Trash2, 
  Flame, 
  Coffee, 
  UtensilsCrossed, 
  Apple, 
  Calendar,
  AlertCircle
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog } from "../components/ui";
import { MealPlanForm } from "../components/forms/MealPlanForm";
import { useAuthStore } from "../stores/authStore";
import { useAppStore } from "../stores/appStore";

export function Nutrition() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isPrivileged = user?.role === 'admin' || user?.role === 'teacher';
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);

  // States
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  
  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Form helpers for quick add
  const [quickAddDate, setQuickAddDate] = useState<string>("");
  const [quickAddMealType, setQuickAddMealType] = useState<string>("");

  // 1. Fetch classes for creation form & filter
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list-nutrition', selectedAcademicYearId],
    queryFn: () => {
      if (!selectedAcademicYearId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>('classes', { page: 1, pageSize: 100 }, { filters: { academic_year_id: selectedAcademicYearId } });
    },
    enabled: !!selectedAcademicYearId
  });
  const classesList = classesResponse?.data?.data || [];

  // Helper: Get Monday of the week for currentDate
  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  };

  const monday = getMonday(new Date(currentDate));
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const startOfWeekStr = weekDates[0].toISOString().split('T')[0];
  const endOfWeekStr = weekDates[4].toISOString().split('T')[0];

  // 2. Fetch meal plans for the selected week
  const { data: mealPlansResponse, isLoading } = useQuery({
    queryKey: ['meal-plans-weekly', startOfWeekStr, endOfWeekStr, selectedClassId],
    queryFn: () => {
      const filters: Record<string, any> = {};
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      }
      return api.getAll<any>(
        'meal_plans',
        { page: 1, pageSize: 500, sortBy: 'date', sortOrder: 'asc' },
        {
          dateRange: {
            column: 'date',
            from: startOfWeekStr,
            to: endOfWeekStr
          },
          filters: Object.keys(filters).length > 0 ? filters : undefined
        }
      );
    }
  });
  const mealPlans = mealPlansResponse?.data?.data || [];

  // Organize meal plans in a day-meal grid
  // Days: 0 (Mon) to 4 (Fri)
  // Meals: breakfast, lunch, afternoon_snack
  const getMealPlanForCell = (dateStr: string, mealType: string) => {
    return mealPlans.find(mp => mp.date === dateStr && mp.meal_type === mealType);
  };

  // Navigating weeks
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEditClick = (plan: any) => {
    setSelectedMealPlan(plan);
    setIsFormOpen(true);
  };

  const handleQuickAddClick = (dateStr: string, mealType: string) => {
    setSelectedMealPlan({
      date: dateStr,
      meal_type: mealType,
      class_id: selectedClassId === "all" ? "" : selectedClassId
    });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (plan: any) => {
    setSelectedMealPlan(plan);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedMealPlan) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('meal_plans', selectedMealPlan.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa món thực đơn thành công!');
      queryClient.invalidateQueries({ queryKey: ['meal-plans-weekly'] });
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi xóa thực đơn', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  // Clone from last week logic
  const handleCloneLastWeek = async () => {
    setCloning(true);
    try {
      // Calculate last week's Monday and Friday dates
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      const lastFriday = new Date(monday);
      lastFriday.setDate(monday.getDate() - 3);

      const lastStartStr = lastMonday.toISOString().split('T')[0];
      const lastEndStr = lastFriday.toISOString().split('T')[0];

      // Fetch last week's meal plans
      const filters: Record<string, any> = {};
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      }
      const lastWeekRes = await api.getAll<any>(
        'meal_plans',
        { page: 1, pageSize: 500 },
        {
          dateRange: {
            column: 'date',
            from: lastStartStr,
            to: lastEndStr
          },
          filters: Object.keys(filters).length > 0 ? filters : undefined
        }
      );

      const lastWeekPlans = lastWeekRes.data?.data || [];
      if (lastWeekPlans.length === 0) {
        toast.warning('Không có dữ liệu', 'Không tìm thấy thực đơn nào ở tuần trước để sao chép.');
        return;
      }

      // Check if we already have plans this week
      if (mealPlans.length > 0) {
        const confirmOverwrite = window.confirm("Tuần này đã có thực đơn. Bạn có chắc chắn muốn sao chép đè từ tuần trước?");
        if (!confirmOverwrite) return;

        // Delete current week's plans first
        for (const mp of mealPlans) {
          await api.remove('meal_plans', mp.id);
        }
      }

      // Prepare cloned plans
      const schoolId = user?.school_id || '00000000-0000-0000-0000-000000000001';
      const clonedPayloads = lastWeekPlans.map(mp => {
        // Find offset from last week's Monday
        const mpDate = new Date(mp.date);
        const dayOffset = mpDate.getDay() - 1; // 0 for Mon, 4 for Fri
        
        // Calculate new date
        const newDate = new Date(monday);
        newDate.setDate(monday.getDate() + dayOffset);
        
        return {
          school_id: schoolId,
          class_id: mp.class_id,
          date: newDate.toISOString().split('T')[0],
          meal_type: mp.meal_type,
          menu_items: mp.menu_items,
          calories: mp.calories,
          notes: mp.notes,
          created_by: user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // Bulk insert
      const res = await api.createMany('meal_plans', clonedPayloads);
      if (res.error) throw new Error(res.error);

      toast.success(`Sao chép thành công ${clonedPayloads.length} thực đơn từ tuần trước!`);
      queryClient.invalidateQueries({ queryKey: ['meal-plans-weekly'] });
    } catch (err: any) {
      toast.error('Lỗi khi sao chép thực đơn', err.message || 'Lỗi hệ thống');
    } finally {
      setCloning(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMealTypeLabel = (type: string) => {
    switch (type) {
      case 'breakfast': return 'Bữa Sáng';
      case 'lunch': return 'Bữa Trưa';
      case 'afternoon_snack': return 'Bữa Phụ';
      default: return type;
    }
  };

  const getMealTypeIcon = (type: string) => {
    switch (type) {
      case 'breakfast':
        return <Coffee className="w-4 h-4 text-amber-500" />;
      case 'lunch':
        return <UtensilsCrossed className="w-4 h-4 text-primary" />;
      case 'afternoon_snack':
        return <Apple className="w-4 h-4 text-success" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Header section - hidden in printing */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Dinh Dưỡng & Thực Đơn</h1>
          <p className="text-sm text-on-surface-variant">
            Lập kế hoạch thực đơn dinh dưỡng hàng tuần và in gửi phụ huynh học sinh.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isPrivileged && (
            <button
              onClick={handleCloneLastWeek}
              disabled={cloning}
              className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-container border border-outline-variant/40 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-4 h-4 text-on-surface-variant" />
              {cloning ? 'Đang sao chép...' : 'Nhân Bản Tuần Trước'}
            </button>
          )}

          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-container border border-outline-variant/40 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-on-surface-variant" />
            In Thực Đơn
          </button>

          {isPrivileged && (
            <button
              onClick={() => {
                setSelectedMealPlan(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Thêm Thực Đơn
            </button>
          )}
        </div>
      </div>

      {/* Week navigator & Filters - hidden in printing */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-outline-variant/40 rounded-2xl p-4 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            className="p-2 hover:bg-surface-container-high/60 rounded-xl text-on-surface transition-all cursor-pointer border border-outline-variant/30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleToday}
            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface rounded-xl transition-all cursor-pointer"
          >
            Tuần Này
          </button>

          <span className="text-sm font-bold text-on-surface px-2">
            Tuần: {weekDates[0].toLocaleDateString('vi-VN')} - {weekDates[4].toLocaleDateString('vi-VN')}
          </span>

          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-surface-container-high/60 rounded-xl text-on-surface transition-all cursor-pointer border border-outline-variant/30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="bg-surface-container-low text-on-surface py-2 px-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm font-semibold cursor-pointer"
        >
          <option value="all">Thực đơn chung toàn trường</option>
          {classesList.map((c) => (
            <option key={c.id} value={c.id}>
              Thực đơn riêng lớp {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block text-center py-6 border-b border-double border-slate-300">
        <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-800">THỰC ĐƠN DINH DƯỠNG TUẦN</h1>
        <p className="text-sm font-semibold text-slate-600 mt-1">
          Từ ngày: {weekDates[0].toLocaleDateString('vi-VN')} đến ngày {weekDates[4].toLocaleDateString('vi-VN')}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {selectedClassId === "all" ? "Áp dụng: Toàn trường" : `Áp dụng riêng cho lớp: ${classesList.find(c => c.id === selectedClassId)?.name}`}
        </p>
      </div>

      {/* Weekly Grid */}
      {isLoading ? (
        <div className="h-96 bg-surface border border-outline-variant/20 rounded-3xl animate-pulse" />
      ) : (
        <div className="overflow-x-auto bg-surface border border-outline-variant/40 rounded-3xl print:border-slate-300 print:rounded-none">
          <table className="w-full text-left text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/30 print:bg-slate-100 print:border-slate-300">
                <th className="px-4 py-3.5 font-bold text-on-surface-variant text-xs w-[12%]">Bữa ăn</th>
                {weekDates.map((d, index) => {
                  const dayName = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'][index];
                  const isToday = new Date().toDateString() === d.toDateString();
                  return (
                    <th
                      key={index}
                      className={cn(
                        "px-4 py-3.5 font-bold text-xs text-center border-l border-outline-variant/30 print:border-slate-300",
                        isToday ? "bg-primary-container/20 text-primary print:bg-transparent print:text-slate-800" : "text-on-surface-variant"
                      )}
                    >
                      <div className="font-bold">{dayName}</div>
                      <div className="text-[10px] opacity-75 mt-0.5 font-medium">{d.toLocaleDateString('vi-VN')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 print:divide-slate-300">
              {['breakfast', 'lunch', 'afternoon_snack'].map((mealType) => (
                <tr key={mealType} className="hover:bg-surface-container-lowest/30 transition-all">
                  {/* Meal column */}
                  <td className="px-4 py-6 font-bold text-on-surface flex flex-col items-center justify-center gap-1.5 border-r border-outline-variant/10 print:border-slate-200 min-h-[120px]">
                    {getMealTypeIcon(mealType)}
                    <span className="text-xs font-extrabold uppercase tracking-wider">{getMealTypeLabel(mealType)}</span>
                  </td>

                  {/* Days columns */}
                  {weekDates.map((d, dayIndex) => {
                    const dateStr = d.toISOString().split('T')[0];
                    const plan = getMealPlanForCell(dateStr, mealType);
                    
                    return (
                      <td 
                        key={dayIndex} 
                        className="px-4 py-4 text-center border-l border-outline-variant/10 print:border-slate-200 align-top relative group min-w-[150px]"
                      >
                        {plan ? (
                          <div className="flex flex-col justify-between h-full min-h-[90px] text-left">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-on-surface whitespace-pre-line leading-relaxed">
                                {plan.menu_items}
                              </p>
                              {plan.calories && (
                                <div className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md">
                                  <Flame className="w-3 h-3 shrink-0" />
                                  {plan.calories} kcal
                                </div>
                              )}
                              {plan.notes && (
                                <p className="text-[10px] text-on-surface-variant italic leading-tight">
                                  Lưu ý: {plan.notes}
                                </p>
                              )}
                            </div>

                            {/* Actions on hover (only for privileged) - hidden in printing */}
                            {isPrivileged && (
                              <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity mt-3 print:hidden">
                                <button
                                  onClick={() => handleEditClick(plan)}
                                  className="p-1 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer border border-outline-variant/20"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(plan)}
                                  className="p-1 hover:bg-error-container/20 rounded-lg text-on-surface-variant hover:text-error transition-all cursor-pointer border border-outline-variant/20"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center min-h-[90px] h-full">
                            {isPrivileged ? (
                              <button
                                onClick={() => handleQuickAddClick(dateStr, mealType)}
                                className="w-8 h-8 rounded-full border border-dashed border-outline-variant/60 hover:border-primary text-on-surface-variant/40 hover:text-primary hover:bg-primary-container/10 flex items-center justify-center transition-all cursor-pointer print:hidden"
                                title="Thêm thực đơn nhanh"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-xs text-on-surface-variant/40 italic">Chưa lên thực đơn</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer notes on printed menu */}
      <div className="hidden print:flex justify-between items-center text-[10px] text-slate-500 mt-8 border-t border-slate-200 pt-4">
        <span>BGH TRƯỜNG MẦM NON DORAEMON</span>
        <span>Phụ huynh vui lòng theo dõi chế độ dinh dưỡng hàng ngày của trẻ tại app.</span>
      </div>

      {/* Meal Plan Form Modal */}
      {isFormOpen && (
        <MealPlanForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          mealPlan={selectedMealPlan}
          classesList={classesList}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Xóa thực đơn?"
        message="Bạn có chắc chắn muốn xóa thực đơn này khỏi bảng biểu dinh dưỡng tuần?"
        confirmText="Xóa thực đơn"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
}
