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
  Clock,
  MessageSquare
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { supabase, uploadFile } from "../lib/supabase";
import { toast } from "../stores/toastStore";
import { useAuthStore } from "../stores/authStore";
import { useAppStore } from "../stores/appStore";
import { Input, Button, Tabs, Modal, Table, type TableColumn } from "../components/ui";
import { Avatar } from "../components/ui/Avatar";

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

const zaloSchema = z.object({
  zalo_oa_id: z.string().min(1, 'Zalo OA ID là bắt buộc'),
  zalo_access_token: z.string().min(1, 'Access Token là bắt buộc'),
  zalo_refresh_token: z.string().optional(),
  zalo_template_fee: z.string().optional(),
  zalo_template_attendance: z.string().optional(),
});

type ZaloValues = z.infer<typeof zaloSchema>;

const profileSchema = z.object({
  full_name: z.string().min(1, 'Họ tên là bắt buộc'),
  phone: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
});

type ProfileValues = z.infer<typeof profileSchema>;

export function Settings() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const setSelectedAcademicYearId = useAppStore((state) => state.setSelectedAcademicYearId);

  const [activeTab, setActiveTab] = useState<'school' | 'years' | 'security' | 'zalo' | 'profile'>('school');
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

  const {
    register: registerZalo,
    handleSubmit: handleSubmitZalo,
    formState: { errors: zaloErrors },
    reset: resetZalo
  } = useForm<ZaloValues>({
    resolver: zodResolver(zaloSchema) as any,
    values: schoolData ? {
      zalo_oa_id: schoolData.zalo_oa_id || '',
      zalo_access_token: schoolData.zalo_access_token || '',
      zalo_refresh_token: schoolData.zalo_refresh_token || '',
      zalo_template_fee: schoolData.zalo_template_fee || '',
      zalo_template_attendance: schoolData.zalo_template_attendance || '',
    } : undefined
  });

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
    reset: resetProfile
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema) as any,
    values: user ? {
      full_name: user.full_name || '',
      phone: user.phone || '',
      job_title: user.job_title || '',
    } : undefined
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

  const onSaveZalo = async (values: ZaloValues) => {
    if (!schoolData?.id) return;
    setLoading(true);
    try {
      const res = await api.update('schools', schoolData.id, {
        ...values,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      
      toast.success('Cập nhật cấu hình Zalo OA thành công!');
      queryClient.invalidateQueries({ queryKey: ['school-details'] });
    } catch (err: any) {
      toast.error('Lỗi khi lưu cấu hình', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const onSaveProfile = async (values: ProfileValues) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.update('users', user.id, {
        ...values,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      
      setUser({
        ...user,
        ...values
      });
      
      toast.success('Cập nhật hồ sơ cá nhân thành công!');
    } catch (err: any) {
      toast.error('Lỗi cập nhật hồ sơ', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    
    setLoading(true);
    try {
      toast.info('Đang tải ảnh lên...');
      
      const fileExt = file.name.split('.').pop();
      const path = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      
      const publicUrl = await uploadFile('avatars', path, file);
      
      const res = await api.update('users', user.id, {
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw new Error(res.error);
      
      setUser({
        ...user,
        avatar_url: publicUrl
      });
      
      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch (err: any) {
      toast.error('Lỗi tải ảnh', err.message || 'Lỗi hệ thống');
    } finally {
      setLoading(false);
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
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap lg:w-full",
              activeTab === 'profile'
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <User className="w-4 h-4" />
            Hồ sơ cá nhân
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
            onClick={() => setActiveTab('zalo')}
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap lg:w-full",
              activeTab === 'zalo'
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Cấu hình Zalo OA
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

          {/* TAB 5: Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Hồ sơ cá nhân
                </h2>
                <p className="text-xs text-on-surface-variant">Cập nhật thông tin cá nhân và ảnh đại diện tài khoản của bạn.</p>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex flex-col items-center gap-4 shrink-0 w-full md:w-auto">
                  <Avatar
                    src={user?.avatar_url || undefined}
                    name={user?.full_name || "U"}
                    size="lg"
                    className="w-24 h-24 text-2xl ring-4 ring-primary/20"
                  />
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={loading}
                      className="hidden"
                      id="avatar-upload-input"
                    />
                    <label
                      htmlFor="avatar-upload-input"
                      className="px-4 py-2 border border-outline-variant/60 hover:bg-surface-container rounded-xl text-xs font-bold text-on-surface transition-all cursor-pointer block text-center"
                    >
                      Thay ảnh đại diện
                    </label>
                  </div>
                </div>

                <form onSubmit={handleSubmitProfile(onSaveProfile)} className="flex-1 w-full space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Họ và tên"
                      placeholder="Nhập họ tên của bạn..."
                      error={profileErrors.full_name?.message}
                      {...registerProfile('full_name')}
                    />

                    <Input
                      label="Số điện thoại"
                      placeholder="Nhập số điện thoại..."
                      error={profileErrors.phone?.message}
                      {...registerProfile('phone')}
                    />

                    <div className="sm:col-span-2">
                      <Input
                        label="Chức danh / Vị trí công việc"
                        placeholder="Ví dụ: Giáo viên chủ nhiệm lớp Mầm 1"
                        error={profileErrors.job_title?.message}
                        {...registerProfile('job_title')}
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
                      Lưu thông tin cá nhân
                    </Button>
                  </div>
                </form>
              </div>
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
                <Table
                  className="rounded-2xl border border-outline-variant/30 overflow-hidden bg-white"
                  columns={[
                    {
                      key: "name",
                      header: "Tên năm học",
                      render: (row: any) => (
                        <span className="font-bold text-on-surface">
                          Năm học {row.name}
                        </span>
                      )
                    },
                    {
                      key: "start_date",
                      header: "Ngày bắt đầu",
                      render: (row: any) => (
                        <span className="text-xs text-on-surface-variant">
                          {new Date(row.start_date).toLocaleDateString('vi-VN')}
                        </span>
                      )
                    },
                    {
                      key: "end_date",
                      header: "Ngày kết thúc",
                      render: (row: any) => (
                        <span className="text-xs text-on-surface-variant">
                          {new Date(row.end_date).toLocaleDateString('vi-VN')}
                        </span>
                      )
                    },
                    {
                      key: "status",
                      header: "Trạng thái",
                      render: (row: any) => row.is_current ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white font-extrabold shadow-2xs select-none">
                          Hiện tại
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant/60 font-medium italic select-none">
                          Lịch sử / Chờ
                        </span>
                      )
                    },
                    {
                      key: "actions",
                      header: "Thao tác",
                      align: "right",
                      render: (row: any) => row.is_current ? (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-end select-none">
                          <Clock className="w-3.5 h-3.5" />
                          Đang chạy
                        </span>
                      ) : (
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSetCurrentYear(row)}
                            className="inline-flex items-center px-3 py-1.5 bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/40 transition-all cursor-pointer"
                          >
                            Kích hoạt
                          </button>
                        </div>
                      )
                    }
                  ]}
                  data={academicYears}
                  rowKey={(row) => row.id}
                />
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
                  Đổi mật khẩu tài khoản sẽ ảnh hưởng đến toàn bộ người dùng. Hãy chỉ thay đổi khi được cấp quyền từ quản trị viên.
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

          {/* TAB 4: Zalo OA */}
          {activeTab === 'zalo' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Cấu hình Zalo OA & ZNS
                </h2>
                <p className="text-xs text-on-surface-variant">Cấu hình kết nối Zalo Official Account để tự động gửi thông báo học phí, điểm danh đến phụ huynh học sinh.</p>
              </div>

              {isLoadingSchool ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-surface-container-low rounded-xl" />
                  <div className="h-10 bg-surface-container-low rounded-xl" />
                  <div className="h-10 bg-surface-container-low rounded-xl" />
                </div>
              ) : (
                <form onSubmit={handleSubmitZalo(onSaveZalo)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Zalo OA ID"
                      placeholder="Nhập ID Zalo OA của nhà trường..."
                      error={zaloErrors.zalo_oa_id?.message}
                      {...registerZalo('zalo_oa_id')}
                    />

                    <Input
                      label="Access Token"
                      placeholder="Zalo API Access Token..."
                      error={zaloErrors.zalo_access_token?.message}
                      {...registerZalo('zalo_access_token')}
                    />

                    <Input
                      label="Refresh Token"
                      placeholder="Zalo API Refresh Token..."
                      error={zaloErrors.zalo_refresh_token?.message}
                      {...registerZalo('zalo_refresh_token')}
                    />

                    <Input
                      label="Template ID Nhắc học phí (ZNS)"
                      placeholder="Ví dụ: 123456"
                      error={zaloErrors.zalo_template_fee?.message}
                      {...registerZalo('zalo_template_fee')}
                    />

                    <div className="sm:col-span-2">
                      <Input
                        label="Template ID Điểm danh hàng ngày (ZNS)"
                        placeholder="Ví dụ: 789012"
                        error={zaloErrors.zalo_template_attendance?.message}
                        {...registerZalo('zalo_template_attendance')}
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
              )}
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
