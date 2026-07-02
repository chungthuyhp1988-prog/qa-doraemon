import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Building, 
  Calendar, 
  Key, 
  User, 
  MessageSquare
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { useAuthStore } from "../stores/authStore";
import { useAppStore } from "../stores/appStore";
import type { SchoolRow, AcademicYearRow } from "../types";

// Import sub-components
import { SchoolSettingsTab } from "../components/settings/SchoolSettingsTab";
import { YearsSettingsTab } from "../components/settings/YearsSettingsTab";
import { SecuritySettingsTab } from "../components/settings/SecuritySettingsTab";
import { ZaloSettingsTab } from "../components/settings/ZaloSettingsTab";
import { ProfileSettingsTab } from "../components/settings/ProfileSettingsTab";

export function Settings() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const setSelectedAcademicYearId = useAppStore((state) => state.setSelectedAcademicYearId);

  const [activeTab, setActiveTab] = useState<'school' | 'years' | 'security' | 'zalo' | 'profile'>('school');

  // 1. Fetch School Info
  const { data: schoolData, isLoading: isLoadingSchool } = useQuery({
    queryKey: ['school-details'],
    queryFn: async () => {
      const res = await api.getAll<SchoolRow>('schools', { page: 1, pageSize: 1 });
      return res.data?.data?.[0] || null;
    }
  });

  // 2. Fetch Academic Years
  const { data: yearsResponse, isLoading: isLoadingYears } = useQuery({
    queryKey: ['academic-years-settings'],
    queryFn: () => api.getAll<AcademicYearRow>('academic_years', { page: 1, pageSize: 100, sortBy: 'start_date', sortOrder: 'desc' })
  });
  const academicYears = (yearsResponse?.data?.data as AcademicYearRow[]) || [];

  const handleSetCurrentYear = async (year: AcademicYearRow) => {
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
    } catch {
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
          {activeTab === 'school' && (
            <SchoolSettingsTab schoolData={schoolData} isLoadingSchool={isLoadingSchool} />
          )}

          {activeTab === 'profile' && (
            <ProfileSettingsTab user={user} setUser={setUser} />
          )}
          
          {activeTab === 'years' && (
            <YearsSettingsTab
              schoolData={schoolData}
              academicYears={academicYears}
              isLoadingYears={isLoadingYears}
              handleSetCurrentYear={handleSetCurrentYear}
            />
          )}

          {activeTab === 'security' && (
            <SecuritySettingsTab />
          )}

          {activeTab === 'zalo' && (
            <ZaloSettingsTab schoolData={schoolData} isLoadingSchool={isLoadingSchool} />
          )}
        </div>
      </div>
    </div>
  );
}
export default Settings;
