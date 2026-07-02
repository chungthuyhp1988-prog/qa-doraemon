import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { exportToExcel, parseExcelDate } from '../lib/excelHelper';
import { useAuthStore } from '../stores/authStore';
import { useClassesList } from './useClassesList';
import { toast } from '../stores/toastStore';
import type { UserRole } from '../types';

export interface TeacherRow {
  id: string;
  school_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean;
  work_status: 'active' | 'maternity_leave' | 'inactive' | 'on_leave';
  date_of_birth: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  class_teachers?: { class_id: string; classes: { name: string } | null }[];
}

export interface ExcelTeacherRow {
  [key: string]: string | number | null | undefined;
  'Họ tên'?: string;
  'Email'?: string;
  'Số điện thoại'?: string | number;
  'SĐT'?: string | number;
  'Vai trò'?: string;
  'Chức vụ'?: string;
  'Chức danh'?: string;
  'Ngày sinh'?: string | number;
  'Địa chỉ'?: string;
  'Trạng thái hoạt động'?: string;
  'Trạng thái'?: string;
  'Lớp'?: string;
  'Lớp phụ trách'?: string;
}

const compareVietnameseNames = (nameA: string, nameB: string) => {
  const cleanA = (nameA || '').trim();
  const cleanB = (nameB || '').trim();

  if (!cleanA && !cleanB) return 0;
  if (!cleanA) return 1;
  if (!cleanB) return -1;

  const partsA = cleanA.split(/\s+/);
  const partsB = cleanB.split(/\s+/);

  const firstNameA = partsA[partsA.length - 1] || '';
  const firstNameB = partsB[partsB.length - 1] || '';

  const cmp = firstNameA.localeCompare(firstNameB, 'vi', { sensitivity: 'base' });
  if (cmp !== 0) return cmp;

  return cleanA.localeCompare(cleanB, 'vi', { sensitivity: 'base' });
};

const getTeacherTitle = (_email: string, role: string, jobTitle?: string) => {
  if (jobTitle) return jobTitle;
  if (role === 'admin') return 'Ban giám hiệu';
  if (role === 'staff') return 'Nhân viên';
  return 'Giáo viên';
};

export function useTeachers() {
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';

  // View mode: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherRow | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // Import Excel state
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedRole, selectedClassId, selectedStatus]);

  // Fetch classes list for filter dropdown
  const { classesList } = useClassesList();

  // Fetch users list (teachers and staff)
  const { data: teachersResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['teachers-list', debouncedSearch, selectedRole, selectedClassId, selectedStatus, page],
    queryFn: async () => {
      const filters: Record<string, string | number | boolean | null> = {};

      filters.work_status = selectedStatus;

      if (selectedClassId !== 'all') {
        const { data: ctData } = await api.getAll<{ teacher_id: string }>(
          'class_teachers',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: selectedClassId } }
        );
        const teacherIds = ctData?.data?.map((ct) => ct.teacher_id) || [];

        if (teacherIds.length > 0) {
          filters.id = `in.(${teacherIds.join(',')})`;
        } else {
          return { data: { data: [], count: 0 }, error: null, count: 0 };
        }
      }

      return api.getAll<TeacherRow>(
        'users',
        { page, pageSize, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        },
        '*, class_teachers(class_id, classes(name))'
      );
    },
  });

  const rawTeachersData: TeacherRow[] = teachersResponse?.data?.data || [];

  const classifyUser = (user: TeacherRow) => {
    const role = user.role || '';
    const title = (
      user.job_title ||
      getTeacherTitle(user.email, user.role, user.job_title) ||
      ''
    )
      .toLowerCase()
      .trim();
    const name = (user.full_name || '').trim();
    const email = (user.email || '').toLowerCase().trim();

    if (email === 'admin@doraemon.edu.vn' || name.toLowerCase().includes('quản trị viên')) {
      return 5;
    }

    const isBGH =
      role === 'admin' ||
      title.includes('hiệu trưởng') ||
      title.includes('hiệu phó') ||
      title.includes('p. hiệu trưởng') ||
      title.includes('p.hiệu trưởng') ||
      title.includes('chủ tịch') ||
      title.includes('ban giám hiệu');

    const isBGHAndOffice =
      isBGH ||
      title.includes('kế toán') ||
      title.includes('y tế') ||
      title.includes('bác sĩ') ||
      title.includes('văn phòng') ||
      title.includes('thủ quỹ') ||
      title.includes('văn thư') ||
      title.includes('tuyển sinh') ||
      (role === 'staff' &&
        !title.includes('bếp') &&
        !title.includes('cấp dưỡng') &&
        !title.includes('nấu ăn') &&
        !title.includes('kỹ thuật') &&
        !title.includes('bảo vệ') &&
        !title.includes('lao công') &&
        !title.includes('vệ sinh'));

    if (isBGHAndOffice) return 1;

    const isTeacher = role === 'teacher' || title.includes('giáo viên');
    if (isTeacher) return 2;

    const isKitchen = title.includes('bếp') || title.includes('cấp dưỡng') || title.includes('nấu ăn');
    if (isKitchen) return 3;

    return 4;
  };

  const compareGroup1 = (a: TeacherRow, b: TeacherRow) => {
    const getSubRank = (user: TeacherRow) => {
      const title = (
        user.job_title ||
        getTeacherTitle(user.email, user.role, user.job_title) ||
        ''
      )
        .toLowerCase()
        .trim();

      const isPrincipal = title.includes('hiệu trưởng') && !title.includes('phó') && !title.startsWith('p.');
      if (isPrincipal) return 1;

      if (
        title.includes('phó hiệu trưởng') ||
        title.includes('p. hiệu trưởng') ||
        title.includes('phó hiệu') ||
        title.includes('p.hiệu')
      ) {
        return 2;
      }

      return 3;
    };

    const subRankA = getSubRank(a);
    const subRankB = getSubRank(b);

    if (subRankA !== subRankB) return subRankA - subRankB;

    if (subRankA === 2) {
      const dateA = a.date_of_birth ? new Date(a.date_of_birth).getTime() : Infinity;
      const dateB = b.date_of_birth ? new Date(b.date_of_birth).getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
    }

    return compareVietnameseNames(a.full_name, b.full_name);
  };

  const filteredTeachersData = [...rawTeachersData].filter((user) => {
    if (selectedRole === 'all') return true;
    const group = classifyUser(user);
    if (selectedRole === 'bgh' && (group === 1 || group === 5)) return true;
    if (selectedRole === 'teacher' && group === 2) return true;
    if (selectedRole === 'kitchen' && group === 3) return true;
    if (selectedRole === 'maintenance' && group === 4) return true;
    return false;
  });

  const teachersData = filteredTeachersData.sort((a, b) => {
    const groupA = classifyUser(a);
    const groupB = classifyUser(b);

    if (groupA !== groupB) return groupA - groupB;

    if (groupA === 1) {
      return compareGroup1(a, b);
    }

    return compareVietnameseNames(a.full_name, b.full_name);
  });

  const totalCount = teachersResponse?.data?.count || filteredTeachersData.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedRole('all');
    setSelectedClassId('all');
    setSelectedStatus('active');
    setPage(1);
  };

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('users', selectedTeacher.id);
      if (res.error) throw new Error(res.error);

      toast.success('Xóa nhân sự thành công!');
      queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xóa nhân sự', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
      setSelectedTeacher(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      const filters: Record<string, string | number | boolean | null> = {};
      filters.work_status = selectedStatus;
      if (selectedRole !== 'all') {
        filters.role = selectedRole;
      }
      if (selectedClassId !== 'all') {
        const { data: ctData } = await api.getAll<{ teacher_id: string }>(
          'class_teachers',
          { page: 1, pageSize: 1000 },
          { filters: { class_id: selectedClassId } }
        );
        const teacherIds = ctData?.data?.map((ct) => ct.teacher_id) || [];

        if (teacherIds.length > 0) {
          filters.id = `in.(${teacherIds.join(',')})`;
        } else {
          toast.error('Không có nhân sự nào để xuất');
          return;
        }
      }

      const res = await api.getAll<TeacherRow>(
        'users',
        { page: 1, pageSize: 1000, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        },
        '*, class_teachers(classes(name))'
      );

      const exportData = (res.data?.data || []).map((row) => {
        const classes =
          row.class_teachers?.map((ct) => ct.classes?.name).filter(Boolean).join(', ') || 'Chưa phân công';
        let roleName = 'Nhân viên';
        if (row.role === 'admin') roleName = 'Ban giám hiệu';
        else if (row.role === 'teacher') roleName = 'Giáo viên';

        return {
          full_name: row.full_name,
          email: row.email,
          phone: row.phone || '',
          role: roleName,
          job_title: row.job_title || '',
          date_of_birth: row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString('vi-VN') : '',
          address: row.address || '',
          status:
            row.work_status === 'active'
              ? 'Đang làm việc'
              : row.work_status === 'maternity_leave'
              ? 'Đang nghỉ thai sản'
              : row.work_status === 'on_leave'
              ? 'Nghỉ phép'
              : 'Đã nghỉ việc',
          classes: classes,
        };
      });

      const columns = [
        { key: 'full_name', label: 'Họ tên' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Số điện thoại' },
        { key: 'role', label: 'Vai trò' },
        { key: 'job_title', label: 'Chức vụ' },
        { key: 'date_of_birth', label: 'Ngày sinh' },
        { key: 'address', label: 'Địa chỉ' },
        { key: 'status', label: 'Trạng thái hoạt động' },
        { key: 'classes', label: 'Lớp phụ trách' },
      ];

      exportToExcel(exportData, columns, 'Danh_Sach_Giao_Vien_Nhan_Vien', 'Cán bộ giáo viên');
      toast.success('Đã xuất Excel danh sách giáo viên!');
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi xuất Excel: ' + (err instanceof Error ? err.message : 'Lỗi hệ thống'));
    }
  };

  const handleImportExcel = async (rows: ExcelTeacherRow[]) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const fullName = row['Họ tên'];
      const email = row['Email'];
      if (!fullName || !email) {
        errorCount++;
        errors.push(`Dòng ${lineNum}: Thiếu Họ tên hoặc Email (bắt buộc).`);
        continue;
      }

      const phone = row['Số điện thoại'] || row['SĐT'];
      const rawRole = row['Vai trò'];
      const jobTitle = row['Chức vụ'] || row['Chức danh'];
      const rawDob = row['Ngày sinh'];
      const address = row['Địa chỉ'];
      const rawStatus = row['Trạng thái hoạt động'] || row['Trạng thái'];

      const dob = rawDob ? parseExcelDate(rawDob) : null;

      let role: 'admin' | 'teacher' | 'staff' = 'teacher';
      if (rawRole) {
        const roleLower = String(rawRole).toLowerCase().trim();
        if (roleLower === 'admin' || roleLower.includes('quản trị') || roleLower.includes('giám hiệu')) {
          role = 'admin';
        } else if (
          roleLower === 'staff' ||
          roleLower.includes('nhân viên') ||
          roleLower.includes('bếp') ||
          roleLower.includes('bảo vệ')
        ) {
          role = 'staff';
        }
      }

      let workStatus: 'active' | 'maternity_leave' | 'inactive' | 'on_leave' = 'active';
      let isActive = true;
      if (rawStatus) {
        const statusLower = String(rawStatus).toLowerCase().trim();
        if (statusLower.includes('thai sản') || statusLower.includes('sinh')) {
          workStatus = 'maternity_leave';
          isActive = true;
        } else if (
          statusLower.includes('nghỉ phép') ||
          statusLower.includes('phép') ||
          statusLower.includes('nghỉ cưới') ||
          statusLower.includes('nghỉ ốm')
        ) {
          workStatus = 'on_leave';
          isActive = true;
        } else if (
          statusLower.includes('nghỉ việc') ||
          statusLower.includes('nghỉ hẳn') ||
          statusLower.includes('đã nghỉ') ||
          statusLower.includes('không hoạt động')
        ) {
          workStatus = 'inactive';
          isActive = false;
        } else if (statusLower.includes('tạm nghỉ') || statusLower.includes('tạm dừng')) {
          workStatus = 'inactive';
          isActive = false;
        } else {
          workStatus = 'active';
          isActive = true;
        }
      }

      try {
        const teacherId = crypto.randomUUID();

        const userPayload = {
          id: teacherId,
          school_id: schoolId,
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role: role,
          phone: phone ? String(phone).trim() : null,
          avatar_url: null,
          job_title: jobTitle ? jobTitle.trim() : role === 'teacher' ? 'Giáo viên' : 'Nhân viên',
          date_of_birth: dob,
          address: address ? address.trim() : null,
          is_active: isActive,
          work_status: workStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const res = await api.create('users', userPayload);
        if (res.error) throw new Error(res.error);

        const rawClass = row['Lớp'] || row['Lớp phụ trách'];
        if (role === 'teacher' && rawClass && classesList.length > 0) {
          const cleanClassName = String(rawClass).toLowerCase().replace(/\s+/g, '');
          const matchedClass = classesList.find(
            (c) => c.name.toLowerCase().replace(/\s+/g, '') === cleanClassName
          );

          if (matchedClass) {
            await api.create('class_teachers', {
              class_id: matchedClass.id,
              teacher_id: teacherId,
              is_homeroom: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }

        successCount++;
      } catch (err) {
        console.error(err);
        errorCount++;
        errors.push(
          `Dòng ${lineNum} (${fullName}): ${err instanceof Error ? err.message : 'Lỗi hệ thống'}`
        );
      }
    }

    queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
    return { successCount, errorCount, errors };
  };

  return {
    viewMode,
    setViewMode,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isDeleting,
    selectedTeacher,
    setSelectedTeacher,
    search,
    setSearch,
    selectedRole,
    setSelectedRole,
    selectedClassId,
    setSelectedClassId,
    selectedStatus,
    setSelectedStatus,
    page,
    setPage,
    isImportOpen,
    setIsImportOpen,
    classesList,
    teachersData,
    totalCount,
    totalPages,
    isLoading,
    isError,
    formatDate,
    handleResetFilters,
    handleDeleteTeacher,
    handleExportExcel,
    handleImportExcel,
    refetch,
  };
}
