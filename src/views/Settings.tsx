import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building, 
  Calendar, 
  Key, 
  Save, 
  Plus, 
  Check, 
  ShieldAlert, 
  Mail, 
  Phone, 
  User, 
  MapPin, 
  Clock 
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { toast } from "../stores/toastStore";
import { useAuthStore } from "../stores/authStore";
import { useAppStore } from "../stores/appStore";
import { Input, Button, Tabs, Modal } from "../components/ui";

// Validation Schemas
const schoolSchema = z.object({
  name: z.string().min(1, 'Tên trường học là bắt buộc'),
  address: z.string().min(1, 'Địa chỉ trường học là bắt buộc'),
  phone: z.string().min(10, 'Số điện thoại không hợp lệ').max(11, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').min(1, 'Email là bắt buộc'),
  principal_name: z.string().min(1, 'Họ tên Hiệu trưởng là bắt buộc'),
});

const passwordSchema = z.object({
  password: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
  confirmPassword: z.string().min(6, 'Xác nhận mật khẩu tối thiểu 6 ký tự'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

const yearSchema = z.object({
  name: z.string().min(1, 'Tên năm học là bắt buộc (Ví dụ: 2025-2026)'),
  start_date: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  end_date: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
});

type SchoolValues = z.infer<typeof schoolSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type YearValues = z.infer<typeof yearSchema>;

export function Settings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const setSelectedAcademicYearId = useAppStore((state) => state.setSelectedAcademicYearId);

  const [activeTab, setActiveTab] = useState<'school' | 'years' | 'security'>('school');
  const [loading, setLoading] = useState(false);
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [yearLoading, setYearLoading] = useState(false);

  // 1. Fetch School Info
  const { data: schoolResponse, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['school-details'],
    queryFn: async () => {
      const res = await api.getAll<any>('schools', { page: 1, pageSize: 1 });
      return res.data?.data?.[0] || null;
    }
  });
  const schoolData = schoolResponse;

  // 2. Fetch Academic Years
  const { data: yearsResponse, isLoading: isLoadingYears } = useQuery({
    queryKey: ['academic-years-settings'],
    queryFn: () => api.getAll<any>('academic_years', { page: 1, pageSize: 100, sortBy: 'start_date', sortOrder: 'desc' })
  });
  const academicYears = (yearsResponse?.data?.data as any[]) || [];

  // Form hooks
  const {
    register: registerSchool,
    handleSubmit: handleSubmitSchool,
    formState: { errors: schoolErrors },
    reset: resetSchool
  } = useForm<SchoolValues>({
    resolver: zodResolver(schoolSchema) as any,
    values: schoolData ? {
      name: schoolData.name || '',
      address: schoolData.address || '',
      phone: schoolData.phone || '',
      email: schoolData.email || '',
      principal_name: schoolData.principal_name || '',
    } : undefined
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPassword
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema) as any,
  });

  const {
    register: registerYear,
    handleSubmit: handleSubmitYear,
    formState: { errors: yearErrors },
    reset: resetYear
  } = useForm<YearValues>({
    resolver: zodResolver(yearSchema) as any,
  });

  // Submit handlers
  const onSaveSchool = async (values: SchoolValues) => {
    if (!schoolData?.id) return;
    setLoading(true);
    try {
      const res = await api.update('schools', schoolData.id, {
        ...values,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      
      toast.success('Cập nhật thông tin trường thành công!');
      queryClient.invalidateQueries({ queryKey: ['school-details'] });
    } catch (err: any) {
      toast.error('Lỗi lưu thông tin', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async (values: PasswordValues) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password
      });
      if (error) throw error;
      
      toast.success('Thay đổi mật khẩu tài khoản thành công!');
      resetPassword({ password: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error('Lỗi khi đổi mật khẩu', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const onCreateYear = async (values: YearValues) => {
    if (!schoolData?.id) return;
    setYearLoading(true);
    try {
      const res = await api.create('academic_years', {
        school_id: schoolData.id,
        name: values.name.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        is_current: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);
      
      toast.success('Tạo năm học mới thành công!');
      queryClient.invalidateQueries({ queryKey: ['academic-years-settings'] });
      setIsYearModalOpen(false);
      resetYear();
    } catch (err: any) {
      toast.error('Lỗi khi tạo năm học', err.message || 'Lỗi hệ thống');
    } finally {
      setYearLoading(false);
    }
  };

  const handleSetCurrentYear = async (year: any) => {
    try {
      toast.info('Đang chuyển đổi năm học...');
      
      // 1. Deactivate other years
      for (const y of academicYears) {
        if (y.is_current) {
          await api.update('academic_years', y.id, { is_current: false });
        }
      }
      
      // 2. Activate selected year
      const res = await api.update('academic_years', year.id, {
        is_current: true,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);

      // 3. Update store context
      setSelectedAcademicYearId(year.id);
      
      toast.success(`Đã chuyển sang năm học ${year.name} thành công!`);
      queryClient.invalidateQueries({ queryKey: ['academic-years-settings'] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      queryClient.invalidateQueries({ queryKey: ['classes-summary'] });
    } catch (err: any) {
      toast.error('Lỗi', 'Không thể cấu hình năm học mặc định');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Cài Đặt Hệ Thống</h1>
        <p className="text-sm text-on-surface-variant">
          Quản lý thông tin nhà trường, thiết lập năm học nghiệp vụ và bảo mật tài khoản cá nhân.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Tabs */}
        <div className="w-full lg:w-64 shrink-0 bg-surface border border-outline-variant/40 rounded-3xl p-4 flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible">
          <button
            onClick={() => setActiveTab('school')}
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap lg:w-full",
              activeTab === 'school'
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <Building className="w-4 h-4" />
            Thông tin trường học
          </button>
          
          <button
            onClick={() => setActiveTab('years')}
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap lg:w-full",
              activeTab === 'years'
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <Calendar className="w-4 h-4" />
            Cấu hình năm học
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap lg:w-full",
              activeTab === 'security'
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <Key className="w-4 h-4" />
            Bảo mật tài khoản
          </button>
        </div>

        {/* Tab content area */}
        <div className="flex-1 bg-surface border border-outline-variant/40 rounded-3xl p-6 shadow-sm">
          
          {/* TAB 1: School Profile */}
          {activeTab === 'school' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Hồ sơ trường học
                </h2>
                <p className="text-xs text-on-surface-variant">Thông tin chính thức của trường mầm non dùng cho các báo cáo, thông báo và học phí.</p>
              </div>

              {isLoadingSchool ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-surface-container-low rounded-xl" />
                  <div className="h-10 bg-surface-container-low rounded-xl" />
                  <div className="h-10 bg-surface-container-low rounded-xl" />
                </div>
              ) : (
                <form onSubmit={handleSubmitSchool(onSaveSchool)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Tên trường học"
                      placeholder="Ví dụ: Trường Mầm Non Doraemon"
                      leftIcon={<Building className="w-4 h-4" />}
                      error={schoolErrors.name?.message}
                      {...registerSchool('name')}
                    />

                    <Input
                      label="Người đại diện / Hiệu trưởng"
                      placeholder="Nhập tên hiệu trưởng..."
                      leftIcon={<User className="w-4 h-4" />}
                      error={schoolErrors.principal_name?.message}
                      {...registerSchool('principal_name')}
                    />

                    <Input
                      label="Số điện thoại liên hệ"
                      placeholder="Ví dụ: 024xxxxxxx"
                      leftIcon={<Phone className="w-4 h-4" />}
                      error={schoolErrors.phone?.message}
                      {...registerSchool('phone')}
                    />

                    <Input
                      label="Địa chỉ email trường"
                      placeholder="contact@doraemon.edu.vn"
                      leftIcon={<Mail className="w-4 h-4" />}
                      error={schoolErrors.email?.message}
                      {...registerSchool('email')}
                    />

                    <div className="sm:col-span-2">
                      <Input
                        label="Địa chỉ trường học"
                        placeholder="Nhập địa chỉ đầy đủ của cơ sở chính..."
                        leftIcon={<MapPin className="w-4 h-4" />}
                        error={schoolErrors.address?.message}
                        {...registerSchool('address')}
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
                      Lưu thông tin trường
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Academic Years management */}
          {activeTab === 'years' && (
            <div className="space-y-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Quản lý năm học
                  </h2>
                  <p className="text-xs text-on-surface-variant">Kích hoạt hoặc khởi tạo các năm học mới. Các lớp học và học phí sẽ phân nhóm theo năm học này.</p>
                </div>
                <button
                  onClick={() => setIsYearModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Năm học mới
                </button>
              </div>

              {isLoadingYears ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-12 bg-surface-container-low rounded-xl" />
                  <div className="h-12 bg-surface-container-low rounded-xl" />
                </div>
              ) : (
                <div className="border border-outline-variant/30 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse bg-white">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant/30">
                        <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Tên năm học</th>
                        <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Ngày bắt đầu</th>
                        <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Ngày kết thúc</th>
                        <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs">Trạng thái</th>
                        <th className="px-4 py-3 font-semibold text-on-surface-variant text-xs text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {academicYears.map((year: any) => {
                        const isCurrent = year.is_current;
                        const isSelectedInContext = selectedAcademicYearId === year.id;
                        
                        return (
                          <tr key={year.id} className="hover:bg-surface-container-lowest/50 transition-all">
                            <td className="px-4 py-3 font-bold text-on-surface">
                              Năm học {year.name}
                            </td>
                            <td className="px-4 py-3 text-xs text-on-surface-variant">
                              {new Date(year.start_date).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-xs text-on-surface-variant">
                              {new Date(year.end_date).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3">
                              {isCurrent ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-container/20 text-success border border-success/30">
                                  <Check className="w-3.5 h-3.5" />
                                  Hiện tại
                                </span>
                              ) : (
                                <span className="text-xs text-on-surface-variant/60 font-medium italic">
                                  Lịch sử / Chờ
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!isCurrent ? (
                                <button
                                  onClick={() => handleSetCurrentYear(year)}
                                  className="inline-flex items-center px-3 py-1.5 bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/40 transition-all cursor-pointer"
                                >
                                  Kích hoạt
                                </button>
                              ) : (
                                <span className="text-xs text-success/80 font-bold flex items-center gap-1 justify-end">
                                  <Clock className="w-3.5 h-3.5" />
                                  Đang chạy
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Account Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Đổi mật khẩu tài khoản
                </h2>
                <p className="text-xs text-on-surface-variant">Nên thiết lập mật khẩu mạnh có chứa ký tự chữ cái, chữ số để bảo mật tuyệt đối cho tài khoản.</p>
              </div>

              <form onSubmit={handleSubmitPassword(onChangePassword)} className="space-y-5 max-w-md">
                <div className="p-4 rounded-2xl bg-warning-container/10 border border-warning-container/20 flex gap-3 text-xs text-warning leading-relaxed font-semibold">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  Mật khẩu tài khoản đăng nhập chung hiện tại là Admin / 123456. Để phục vụ công việc của toàn trường, hãy chỉ đổi khi được cấp quyền.
                </div>

                <Input
                  label="Mật khẩu mới"
                  type="password"
                  placeholder="Nhập mật khẩu mới..."
                  error={passwordErrors.password?.message}
                  {...registerPassword('password')}
                />

                <Input
                  label="Xác nhận mật khẩu mới"
                  type="password"
                  placeholder="Nhập lại mật khẩu mới..."
                  error={passwordErrors.confirmPassword?.message}
                  {...registerPassword('confirmPassword')}
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
          )}
        </div>
      </div>

      {/* Year Modal Form */}
      {isYearModalOpen && (
        <Modal
          open={isYearModalOpen}
          onClose={() => setIsYearModalOpen(false)}
          title="Tạo năm học nghiệp vụ mới"
          size="md"
        >
          <form onSubmit={handleSubmitYear(onCreateYear)} className="space-y-5 select-none">
            <Input
              label="Tên năm học"
              placeholder="Ví dụ: 2026-2027"
              error={yearErrors.name?.message}
              {...registerYear('name')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ngày bắt đầu"
                type="date"
                error={yearErrors.start_date?.message}
                {...registerYear('start_date')}
              />

              <Input
                label="Ngày kết thúc"
                type="date"
                error={yearErrors.end_date?.message}
                {...registerYear('end_date')}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setIsYearModalOpen(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
                disabled={yearLoading}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={yearLoading}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                {yearLoading ? 'Đang tạo...' : 'Tạo mới'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
