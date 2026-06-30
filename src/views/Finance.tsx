import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Download, 
  Plus, 
  TrendingUp, 
  AlertCircle, 
  MessageCircle, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Edit2,
  Eye,
  DollarSign
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { DatePicker, Table, type TableColumn, Button, useSlidePanel, ErrorState } from "../components/ui";
import { FeeForm } from "../components/forms/FeeForm";
import { FeeDetailPanel } from "../components/details/FeeDetailPanel";
import { toast } from "../stores/toastStore";
import { zalo } from "../lib/zalo";
import { format } from "date-fns";
import { useAppStore } from "../stores/appStore";
import type { TuitionFeeRow, ClassRow, GuardianRow, FeeStatus } from "../types";

/** Fee row joined with student, class and guardian relations */
interface FeeStudentRelation {
  id: string;
  full_name: string;
  student_code: string;
  classes: Pick<ClassRow, 'name'> | null;
  guardians: GuardianRow[];
}

interface FeeWithStudent extends TuitionFeeRow {
  students: FeeStudentRelation | null;
}

/** Lightweight row returned by the aggregation query */
interface FeeAggregate {
  total_amount: number;
  paid_amount: number;
  status: FeeStatus;
}

/** Chart data point for the monthly revenue chart */
interface ChartDataPoint {
  month: string;
  expected: number;
  paid: number;
}
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export function Finance() {
  const queryClient = useQueryClient();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const { openPanel } = useSlidePanel();

  // Filters state
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Sending status
  const [isZaloSendingId, setIsZaloSendingId] = useState<string | null>(null);

  const [yearStr, monthStr] = selectedMonthYear.split('-');
  const currentMonth = parseInt(monthStr || '1');
  const currentYear = parseInt(yearStr || '2026');

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedMonthYear, selectedClassId, selectedStatus]);

  // Reset class filter when academic year changes
  useEffect(() => {
    setSelectedClassId("all");
  }, [selectedAcademicYearId]);

  // 1. Fetch classes list for filter dropdown
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list', selectedAcademicYearId],
    queryFn: () => {
      const filters: Record<string, string | number | boolean> = { is_active: true };
      if (selectedAcademicYearId) {
        filters.academic_year_id = selectedAcademicYearId;
      }
      return api.getAll<Pick<ClassRow, 'id' | 'name'>>('classes', { page: 1, pageSize: 100 }, { filters }, 'id, name');
    },
    enabled: !!selectedAcademicYearId
  });
  const classesList = classesResponse?.data?.data || [];

  // 2. Fetch tuition fees records
  const { data: feesResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['tuition-fees-list', selectedAcademicYearId, selectedMonthYear, selectedClassId, selectedStatus, page],
    queryFn: async () => {
      const filters: Record<string, string | number | boolean> = {
        month: currentMonth,
        year: currentYear
      };

      if (selectedStatus !== "all") {
        filters.status = selectedStatus;
      }

      // Filter by class_id if selected (requires querying students first because of PostgREST schema nesting)
      if (selectedClassId !== "all") {
        const { data: studentData } = await api.getAll<Pick<{ id: string }, 'id'>>(
          'students',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: selectedClassId } },
          'id'
        );
        const studentIds = studentData?.data?.map((s) => s.id) || [];

        if (studentIds.length > 0) {
          filters.student_id = `in.(${studentIds.join(',')})`;
        } else {
          return { data: { data: [], count: 0 }, error: null, count: 0 };
        }
      }

      return api.getAll<FeeWithStudent>(
        'tuition_fees',
        { page, pageSize },
        { filters },
        '*, students(id, full_name, student_code, classes(name), guardians(*))'
      );
    }
  });

  const rawFeesData = feesResponse?.data?.data || [];
  
  // Sort fees by student full_name
  const feesData = [...rawFeesData].sort((a, b) => {
    const nameA = a.students?.full_name || '';
    const nameB = b.students?.full_name || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  const totalCount = feesResponse?.data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // 3. Mark Paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (feeId: string) => {
      const feeItem = rawFeesData.find((f) => f.id === feeId);
      if (!feeItem) throw new Error('Không tìm thấy phiếu thu');

      return api.update('tuition_fees', feeId, {
        paid_amount: feeItem.total_amount,
        status: 'paid',
        paid_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi cập nhật thanh toán', res.error);
      } else {
        toast.success('Đã xác nhận thu đủ học phí!');
        queryClient.invalidateQueries({ queryKey: ['tuition-fees-list'] });
      }
    },
    onError: (err: Error) => {
      toast.error('Lỗi khi cập nhật thanh toán', err.message || 'Lỗi hệ thống');
    }
  });

  // Calculate aggregates (Total expected, Collected, Remaining) from all fees in the current filter month
  const { data: monthAggregates } = useQuery({
    queryKey: ['month-aggregates-finance', selectedMonthYear, selectedClassId],
    queryFn: async () => {
      const filters: Record<string, string | number | boolean> = {
        month: currentMonth,
        year: currentYear
      };

      if (selectedClassId !== "all") {
        const { data: studentData } = await api.getAll<Pick<{ id: string }, 'id'>>(
          'students',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: selectedClassId } },
          'id'
        );
        const studentIds = studentData?.data?.map((s) => s.id) || [];
        if (studentIds.length > 0) {
          filters.student_id = `in.(${studentIds.join(',')})`;
        } else {
          return [];
        }
      }

      const res = await api.getAll<FeeAggregate>('tuition_fees', { page: 1, pageSize: 1000 }, { filters }, 'total_amount, paid_amount, status');
      return res.data?.data || [];
    }
  });

  const aggregates = {
    expected: 0,
    paid: 0,
    remaining: 0,
    overdueCount: 0,
    unpaidCount: 0,
  };

  if (monthAggregates) {
    monthAggregates.forEach((fee) => {
      aggregates.expected += Number(fee.total_amount || 0);
      aggregates.paid += Number(fee.paid_amount || 0);
      if (fee.status !== 'paid') {
        aggregates.remaining += (Number(fee.total_amount || 0) - Number(fee.paid_amount || 0));
        aggregates.unpaidCount++;
      }
      if (fee.status === 'overdue') {
        aggregates.overdueCount++;
      }
    });
  }

  // Fetch monthly summary via RPC (replaces client-side 5000-row aggregation)
  const { data: chartData = [] } = useQuery<ChartDataPoint[]>({
    queryKey: ['finance-chart-data', selectedAcademicYearId],
    queryFn: async () => {
      if (!selectedAcademicYearId) return [];

      // supabase.rpc typing requires `as any` due to dynamic RPC function signatures
      const { data, error } = await (supabase.rpc as any)('finance_monthly_summary', {
        p_academic_year_id: selectedAcademicYearId,
      });
      if (error) throw error;

      return ((data as Record<string, unknown>[]) || []).map((row) => ({
        month: `Tháng ${row.month}`,
        expected: Number(row.expected || 0),
        paid: Number(row.paid || 0),
      }));
    },
    enabled: !!selectedAcademicYearId,
  });

  const handleExportCSV = () => {
    if (feesData.length === 0) {
      toast.warning('Không có dữ liệu', 'Không có dữ liệu phiếu thu để xuất file.');
      return;
    }

    try {
      const headers = ['Mã học sinh', 'Họ tên học sinh', 'Lớp học', 'Khoản thu cơ bản (VND)', 'Tiền ăn (VND)', 'Khoản thu khác (VND)', 'Miễn giảm (VND)', 'Tổng cộng (VND)', 'Đã đóng (VND)', 'Trạng thái', 'Hạn đóng'];
      
      const rows = feesData.map((fee) => [
        fee.students?.student_code || '',
        fee.students?.full_name || '',
        fee.students?.classes?.name || 'Chưa xếp lớp',
        fee.base_amount || 0,
        fee.meal_amount || 0,
        fee.extra_amount || 0,
        fee.discount || 0,
        fee.total_amount || 0,
        fee.paid_amount || 0,
        fee.status === 'paid' ? 'Đã đóng' : fee.status === 'partial' ? 'Đóng một phần' : fee.status === 'overdue' ? 'Quá hạn' : 'Chờ thanh toán',
        fee.due_date || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((e: (string | number)[]) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `HocPhi_Thang_${currentMonth}_${currentYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Xuất file thành công!', 'File danh sách học phí đã được tải về máy của bạn.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
      toast.error('Lỗi khi xuất file', message);
    }
  };

  // Handle Zalo Reminder action
  const handleZaloReminder = async (feeItem: FeeWithStudent) => {
    const primaryGuardian = feeItem.students?.guardians?.find((g) => g.is_primary) || feeItem.students?.guardians?.[0];
    const phone = primaryGuardian?.phone;
    const studentName = feeItem.students?.full_name || 'Học sinh';

    if (!phone) {
      toast.error('Không thể nhắc nợ', `Học sinh ${studentName} chưa cập nhật số điện thoại phụ huynh.`);
      return;
    }

    setIsZaloSendingId(feeItem.id);
    try {
      const remaining = Number(feeItem.total_amount) - Number(feeItem.paid_amount);
      const res = await zalo.sendFeeReminder(phone, studentName, remaining, feeItem.month);
      if (res.success) {
        toast.success(`Đã gửi tin nhắn nhắc nợ qua Zalo OA đến phụ huynh của em ${studentName} (${phone})`);
      } else {
        throw new Error(res.error || 'Lỗi gửi tin nhắn');
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      toast.error('Lỗi khi gửi Zalo OA', message);
    } finally {
      setIsZaloSendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-emerald-600 text-white font-extrabold tracking-wide shadow-2xs select-none">
            Đã đóng
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-sky-600 text-white font-extrabold tracking-wide shadow-2xs select-none">
            Đóng một phần
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-rose-600 text-white font-extrabold tracking-wide shadow-2xs select-none">
            Quá hạn
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-amber-500 text-white font-extrabold tracking-wide shadow-2xs select-none">
            Chờ thanh toán
          </span>
        );
    }
  };

  // SlidePanel triggers
  const handleOpenDetail = (feeId: string) => {
    openPanel({
      title: 'Chi tiết phiếu thu học phí',
      icon: <DollarSign size={14} />,
      width: 768,
      component: (
        <FeeDetailPanel 
          feeId={feeId} 
          onDeleteSuccess={() => refetch()}
        />
      )
    });
  };

  const handleCreateFee = () => {
    openPanel({
      title: 'Tạo phiếu thu học phí mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <FeeForm 
          onSuccess={() => refetch()}
        />
      )
    });
  };

  const handleEditFee = (fee: FeeWithStudent) => {
    openPanel({
      title: 'Chỉnh sửa phiếu thu học phí',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <FeeForm 
          fee={fee}
          onSuccess={() => refetch()}
        />
      )
    });
  };

  const tableColumns: TableColumn<FeeWithStudent>[] = [
    {
      key: "student",
      header: "Học sinh",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center text-primary font-bold text-[11px] shrink-0 font-playfair">
            {row.students?.full_name?.substring(0, 2).toUpperCase() || 'HS'}
          </div>
          <div>
            <p className="font-bold text-[14px] text-on-surface leading-tight font-inter">{row.students?.full_name}</p>
            <p className="text-[11px] font-semibold text-on-surface-variant/70 uppercase tracking-widest mt-0.5 select-all">
              {row.students?.student_code}
            </p>
          </div>
        </div>
      )
    },
    {
      key: "class",
      header: "Lớp học",
      render: (row) => (
        <span className="font-semibold text-[13px] text-on-surface-variant">
          {row.students?.classes?.name || 'Chưa xếp lớp'}
        </span>
      )
    },
    {
      key: "total_amount",
      header: "Cần đóng (VNĐ)",
      render: (row) => (
        <span className="font-bold text-[14px] text-on-surface">
          {Number(row.total_amount).toLocaleString('vi-VN')} ₫
        </span>
      )
    },
    {
      key: "paid_amount",
      header: "Đã đóng (VNĐ)",
      render: (row) => (
        <span className={cn(
          "font-semibold text-[13px]",
          row.status === 'paid' ? "text-green-700" : "text-on-surface-variant"
        )}>
          {Number(row.paid_amount).toLocaleString('vi-VN')} ₫
        </span>
      )
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => getStatusBadge(row.status)
    },
    {
      key: "due_date",
      header: "Hạn đóng",
      render: (row) => (
        <span className={cn(
          "text-[13px]",
          row.status === 'overdue' ? "text-red-700 font-bold" : "text-on-surface-variant"
        )}>
          {row.due_date ? format(new Date(row.due_date), 'dd/MM/yyyy') : '—'}
        </span>
      )
    },
    {
      key: "actions",
      header: "Hành động",
      render: (row) => {
        const hasPhone = !!(row.students?.guardians?.find((g) => g.is_primary)?.phone || row.students?.guardians?.[0]?.phone);

        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleOpenDetail(row.id)}
              className="p-1.5 text-primary hover:bg-primary/5 rounded-lg border border-primary/20 hover:border-primary transition-all cursor-pointer flex items-center justify-center"
              title="Xem chi tiết"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>

            {/* Quick payment update */}
            {row.status !== 'paid' && (
              <button
                type="button"
                onClick={() => markPaidMutation.mutate(row.id)}
                className="p-1.5 text-green-700 hover:bg-green-50 rounded-lg border border-green-200/50 hover:border-green-300 transition-all cursor-pointer flex items-center justify-center"
                title="Đã đóng đủ"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Zalo Reminder */}
            {row.status !== 'paid' && (
              <button
                type="button"
                onClick={() => handleZaloReminder(row)}
                disabled={isZaloSendingId === row.id || !hasPhone}
                className={cn(
                  "p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer",
                  hasPhone 
                    ? "text-blue-700 border-blue-200/60 hover:bg-blue-50/70 hover:border-blue-300"
                    : "text-slate-400 border-slate-200/50 cursor-not-allowed opacity-40 bg-slate-50"
                )}
                title={hasPhone ? "Gửi nhắc nợ Zalo" : "Phụ huynh chưa đăng ký SĐT"}
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Edit details */}
            <button
              type="button"
              onClick={() => handleEditFee(row)}
              className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg border border-outline-variant/40 hover:border-outline transition-all cursor-pointer flex items-center justify-center"
              title="Sửa thông tin"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">
            Quản lý Học phí
          </h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1 font-inter">
            Tạo và theo dõi phiếu thu học phí bán trú hàng tháng của học sinh.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4" />}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl text-[13px] font-bold border-outline-variant/50 hover:bg-surface-container-low cursor-pointer whitespace-nowrap shrink-0"
          >
            Xuất Excel
          </Button>
          <Button
            type="button"
            onClick={handleCreateFee}
            leftIcon={<Plus className="w-4 h-4" />}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm text-[13px] font-bold cursor-pointer whitespace-nowrap shrink-0"
          >
            Tạo phiếu thu
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Stat Card 1 */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-outline-variant/30 flex flex-col justify-between min-h-[120px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider">Dự kiến thu (Tháng {currentMonth}/{currentYear})</p>
              <h3 className="text-[22px] font-extrabold tracking-tight text-on-surface mt-1">
                {aggregates.expected.toLocaleString('vi-VN')} ₫
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-emerald-600 font-bold">
            <span>Sĩ số đóng phí</span>
            <span>{totalCount} học sinh</span>
          </div>
        </div>
        
        {/* Stat Card 2 */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-outline-variant/30 flex flex-col justify-between min-h-[120px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider">Đã thực thu</p>
              <h3 className="text-[22px] font-extrabold tracking-tight text-green-600 mt-1">
                {aggregates.paid.toLocaleString('vi-VN')} ₫
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 shrink-0">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant font-bold">
            <span>Tỷ lệ hoàn thành</span>
            <span className="text-green-600 font-extrabold">
              Đạt {aggregates.expected > 0 ? Math.round((aggregates.paid / aggregates.expected) * 100) : 0}% kế hoạch
            </span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-red-50/50 dark:bg-red-950/5 rounded-2xl p-5 shadow-xs border border-red-200/50 dark:border-red-900/20 flex flex-col justify-between min-h-[120px] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-extrabold text-red-750 dark:text-red-400 uppercase tracking-wider">Còn nợ / Chưa thanh toán</p>
              <h3 className="text-[22px] font-extrabold tracking-tight text-red-600 dark:text-red-400 mt-1">
                {aggregates.remaining.toLocaleString('vi-VN')} ₫
              </h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-red-200/30 dark:border-red-900/10 flex items-center justify-between text-[11px] text-red-700 dark:text-red-400 font-bold">
            <span>Chưa hoàn thành</span>
            <span>
              {aggregates.unpaidCount} học sinh ({aggregates.overdueCount} quá hạn)
            </span>
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart Card */}
      {chartData.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-6 shadow-sm mb-8 animate-in fade-in duration-300">
          <h3 className="text-[20px] font-bold italic font-playfair text-on-surface mb-6">Xu hướng doanh thu học phí</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-outline-variant/30" />
                <XAxis dataKey="month" className="text-[11px] font-bold text-on-surface-variant" />
                <YAxis
                  className="text-[11px] font-bold text-on-surface-variant"
                  tickFormatter={(tick) => `${(tick / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  formatter={(value: any) => [`${Number(value).toLocaleString('vi-VN')} ₫`]}
                  contentStyle={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-outline-variant)' }}
                />
                <Legend className="text-[12px] font-semibold" />
                <Area type="monotone" name="Dự kiến thu" dataKey="expected" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpected)" />
                <Area type="monotone" name="Thực tế đã thu" dataKey="paid" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPaid)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Main Table section */}
      <div className="bg-surface-container-lowest rounded-[32px] shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
        {/* Filters Toolbar */}
        <div className="p-5 border-b border-outline-variant/30 flex flex-wrap md:flex-nowrap justify-between items-center gap-4 bg-surface-container-low/30">
          
          {/* Month picker filter */}
          <div className="w-full md:w-56">
            <DatePicker
              mode="month"
              value={selectedMonthYear}
              onChange={(val) => val && setSelectedMonthYear(val)}
            />
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-4 w-full md:w-auto">
            {/* Class filter */}
            <div className="flex flex-col gap-1 w-full md:w-44">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm h-10 px-3 text-on-surface focus:outline-none focus:border-primary transition-all"
              >
                <option value="all">Tất cả lớp học</option>
                {classesList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex flex-col gap-1 w-full md:w-44">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm h-10 px-3 text-on-surface focus:outline-none focus:border-primary transition-all"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="paid">Đã thanh toán</option>
                <option value="pending">Chờ thanh toán</option>
                <option value="partial">Đóng một phần</option>
                <option value="overdue">Quá hạn đóng</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="p-4">
          {isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
          <Table
            columns={tableColumns}
            data={feesData}
            rowKey={(row) => row.id}
            onRowClick={(row) => handleOpenDetail(row.id)}
            loading={isLoading}
            emptyTitle="Không có dữ liệu phiếu thu"
            emptyDescription="Không tìm thấy phiếu thu nào khớp với bộ lọc tháng học hoặc trạng thái đã chọn."
          />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-5 border-t border-outline-variant/30 flex items-center justify-between text-[14px] text-on-surface-variant bg-surface-container-low/30">
            <span className="text-[13px] font-semibold text-on-surface-variant">
              Hiển thị bản ghi từ <strong>{((page - 1) * pageSize) + 1}</strong> đến <strong>{Math.min(page * pageSize, totalCount)}</strong> trong tổng số <strong>{totalCount}</strong> phiếu thu
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-outline-variant/50 rounded-xl hover:bg-surface-container-low disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
              </button>
              <span className="text-[14px] font-bold text-on-surface px-3">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-outline-variant/50 rounded-xl hover:bg-surface-container-low disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
