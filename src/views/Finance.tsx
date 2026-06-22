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
import { DatePicker, Table, type TableColumn, Button, useSlidePanel } from "../components/ui";
import { FeeForm } from "../components/forms/FeeForm";
import { FeeDetailPanel } from "../components/details/FeeDetailPanel";
import { toast } from "../stores/toastStore";
import { zalo } from "../lib/zalo";
import { format } from "date-fns";
import { useAppStore } from "../stores/appStore";
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

  // 1. Fetch classes list for filter dropdown
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.getAll('classes', { page: 1, pageSize: 100 }, { filters: { is_active: true } }, 'id, name')
  });
  const classesList = classesResponse?.data?.data || [];

  // 2. Fetch tuition fees records
  const { data: feesResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['tuition-fees-list', selectedMonthYear, selectedClassId, selectedStatus, page],
    queryFn: async () => {
      const filters: Record<string, any> = {
        month: currentMonth,
        year: currentYear
      };

      if (selectedStatus !== "all") {
        filters.status = selectedStatus;
      }

      // Filter by class_id if selected (requires querying students first because of PostgREST schema nesting)
      if (selectedClassId !== "all") {
        const { data: studentData } = await api.getAll(
          'students',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: selectedClassId } },
          'id'
        );
        const studentIds = studentData?.data?.map((s: any) => s.id) || [];
        
        if (studentIds.length > 0) {
          filters.student_id = `in.(${studentIds.join(',')})`;
        } else {
          return { data: { data: [], count: 0 }, error: null, count: 0 };
        }
      }

      return api.getAll(
        'tuition_fees',
        { page, pageSize },
        { filters },
        '*, students(id, full_name, student_code, classes(name), guardians(*))'
      );
    }
  });

  const rawFeesData = feesResponse?.data?.data || [];
  
  // Sort fees by student full_name
  const feesData = [...rawFeesData].sort((a: any, b: any) => {
    const nameA = a.students?.full_name || '';
    const nameB = b.students?.full_name || '';
    return nameA.localeCompare(nameB, 'vi');
  });

  const totalCount = feesResponse?.data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // 3. Mark Paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (feeId: string) => {
      const feeItem = rawFeesData.find((f: any) => f.id === feeId);
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
    onError: (err: any) => {
      toast.error('Lỗi khi cập nhật thanh toán', err.message || 'Lỗi hệ thống');
    }
  });

  // Calculate aggregates (Total expected, Collected, Remaining) from all fees in the current filter month
  const { data: monthAggregates } = useQuery({
    queryKey: ['month-aggregates-finance', selectedMonthYear, selectedClassId],
    queryFn: async () => {
      const filters: Record<string, any> = {
        month: currentMonth,
        year: currentYear
      };

      if (selectedClassId !== "all") {
        const { data: studentData } = await api.getAll(
          'students',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: selectedClassId } },
          'id'
        );
        const studentIds = studentData?.data?.map((s: any) => s.id) || [];
        if (studentIds.length > 0) {
          filters.student_id = `in.(${studentIds.join(',')})`;
        } else {
          return [];
        }
      }

      const res = await api.getAll('tuition_fees', { page: 1, pageSize: 1000 }, { filters }, 'total_amount, paid_amount, status');
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
    monthAggregates.forEach((fee: any) => {
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

  // Fetch tuition fees for all months in the selected academic year to compute the chart
  const { data: chartData = [] } = useQuery({
    queryKey: ['finance-chart-data', selectedAcademicYearId],
    queryFn: async () => {
      if (!selectedAcademicYearId) return [];
      
      const res = await api.getAll<any>(
        'tuition_fees',
        { page: 1, pageSize: 5000 },
        { filters: { academic_year_id: selectedAcademicYearId } },
        'month, total_amount, paid_amount'
      );
      const fees = res.data?.data || [];
      
      const monthlyTotals: Record<number, { month: string; expected: number; paid: number }> = {};
      
      fees.forEach((fee: any) => {
        const m = fee.month;
        if (!monthlyTotals[m]) {
          monthlyTotals[m] = {
            month: `Tháng ${m}`,
            expected: 0,
            paid: 0
          };
        }
        monthlyTotals[m].expected += Number(fee.total_amount || 0);
        monthlyTotals[m].paid += Number(fee.paid_amount || 0);
      });
      
      return Object.values(monthlyTotals).sort((a: any, b: any) => {
        const numA = parseInt(a.month.replace('Tháng ', ''));
        const numB = parseInt(b.month.replace('Tháng ', ''));
        return numA - numB;
      });
    },
    enabled: !!selectedAcademicYearId
  });

  const handleExportCSV = () => {
    if (feesData.length === 0) {
      toast.warning('Không có dữ liệu', 'Không có dữ liệu phiếu thu để xuất file.');
      return;
    }

    try {
      const headers = ['Mã học sinh', 'Họ tên học sinh', 'Lớp học', 'Khoản thu cơ bản (VND)', 'Tiền ăn (VND)', 'Khoản thu khác (VND)', 'Miễn giảm (VND)', 'Tổng cộng (VND)', 'Đã đóng (VND)', 'Trạng thái', 'Hạn đóng'];
      
      const rows = feesData.map((fee: any) => [
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
        ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
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
    } catch (err: any) {
      toast.error('Lỗi khi xuất file', err.message || 'Lỗi hệ thống');
    }
  };

  // Handle Zalo Reminder action
  const handleZaloReminder = async (feeItem: any) => {
    const primaryGuardian = feeItem.students?.guardians?.find((g: any) => g.is_primary) || feeItem.students?.guardians?.[0];
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
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi gửi Zalo OA', err.message || 'Lỗi kết nối');
    } finally {
      setIsZaloSendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 text-[12px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Đã đóng
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[12px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Đóng một phần
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[12px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> Quá hạn
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[12px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span> Chờ thanh toán
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

  const handleEditFee = (fee: any) => {
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

  const tableColumns: TableColumn<any>[] = [
    {
      key: "student",
      header: "Học sinh",
      render: (row: any) => (
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
      render: (row: any) => (
        <span className="font-semibold text-[13px] text-on-surface-variant">
          {row.students?.classes?.name || 'Chưa xếp lớp'}
        </span>
      )
    },
    {
      key: "total_amount",
      header: "Cần đóng (VNĐ)",
      render: (row: any) => (
        <span className="font-bold text-[14px] text-on-surface">
          {Number(row.total_amount).toLocaleString('vi-VN')} ₫
        </span>
      )
    },
    {
      key: "paid_amount",
      header: "Đã đóng (VNĐ)",
      render: (row: any) => (
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
      render: (row: any) => getStatusBadge(row.status)
    },
    {
      key: "due_date",
      header: "Hạn đóng",
      render: (row: any) => (
        <span className={cn(
          "text-[13px]",
          row.status === 'overdue' ? "text-red-700 font-bold" : "text-on-surface-variant"
        )}>
          {row.due_date ? format(new Date(row.due_date), 'dd/MM/yyyy') : '—'}
        </span>
      )
    },
    {
      key: "actions" as any,
      header: "Hành động",
      render: (row: any) => {
        const hasPhone = !!(row.students?.guardians?.find((g: any) => g.is_primary)?.phone || row.students?.guardians?.[0]?.phone);

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
          <h2 className="text-[32px] md:text-[40px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">
            Quản lý Học phí
          </h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1 font-inter">
            Tạo và theo dõi phiếu thu học phí bán trú hàng tháng của học sinh.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl text-[14px] font-bold border-outline-variant/50 hover:bg-surface-container-low cursor-pointer"
          >
            <Download className="w-4 h-4" /> Xuất Excel
          </Button>
          <Button
            type="button"
            onClick={handleCreateFee}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-sm text-[14px] font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo phiếu thu
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Stat Card 1 */}
        <div className="bg-surface-container-lowest rounded-[32px] p-6 shadow-sm border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl"></div>
          <div>
            <p className="text-[13px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Dự kiến thu (Tháng {currentMonth}/{currentYear})</p>
            <h3 className="text-[28px] font-bold italic font-playfair text-on-surface mt-2">
              {aggregates.expected.toLocaleString('vi-VN')} ₫
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-emerald-600">
            <TrendingUp className="w-4 h-4" />
            <span className="text-[12px] font-bold tracking-wide">Sĩ số đóng phí: {totalCount} học sinh</span>
          </div>
        </div>
        
        {/* Stat Card 2 */}
        <div className="bg-surface-container-lowest rounded-[32px] p-6 shadow-sm border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/5 rounded-full blur-2xl"></div>
          <div>
            <p className="text-[13px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">Đã thực thu</p>
            <h3 className="text-[28px] font-bold italic font-playfair text-green-700 mt-2">
              {aggregates.paid.toLocaleString('vi-VN')} ₫
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-on-surface-variant">
            <span className="text-[12px] font-bold tracking-wide">
              Đạt {aggregates.expected > 0 ? Math.round((aggregates.paid / aggregates.expected) * 100) : 0}% kế hoạch
            </span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-red-50/50 dark:bg-red-950/5 rounded-[32px] p-6 shadow-sm border border-red-200/50 dark:border-red-900/20 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/5 rounded-full blur-2xl"></div>
          <div>
            <p className="text-[13px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">Còn nợ / Chưa thanh toán</p>
            <h3 className="text-[28px] font-bold italic font-playfair text-red-700 dark:text-red-400 mt-2">
              {aggregates.remaining.toLocaleString('vi-VN')} ₫
            </h3>
          </div>
          <div className="mt-4 flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-[12px] font-bold tracking-wide">
              {aggregates.unpaidCount} học sinh chưa hoàn thành ({aggregates.overdueCount} quá hạn)
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
          <Table
            columns={tableColumns}
            data={feesData}
            rowKey={(row) => row.id}
            onRowClick={(row) => handleOpenDetail(row.id)}
            loading={isLoading}
            emptyTitle="Không có dữ liệu phiếu thu"
            emptyDescription="Không tìm thấy phiếu thu nào khớp với bộ lọc tháng học hoặc trạng thái đã chọn."
          />
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
