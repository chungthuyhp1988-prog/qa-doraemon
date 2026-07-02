import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { exportToExcel, parseExcelDate, parseGender } from '../lib/excelHelper';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { toast } from '../stores/toastStore';
import { useClassesList } from './useClassesList';
import type { StudentRow, ClassRow, GuardianRow, GuardianInsert } from '../types';

export interface StudentWithRelations extends StudentRow {
  classes: Pick<ClassRow, 'name' | 'grade_level'> | null;
  guardians: GuardianRow[] | null;
}

export interface ExcelStudentRow {
  [header: string]: string | number | undefined;
}

const getVietnameseSortKeys = (fullName: string) => {
  let cleanName = (fullName || '').trim();
  cleanName = cleanName.replace(/\s*[\(\[].*?[\)\]]\s*$/g, '').trim();

  if (!cleanName) return { firstName: '', middleAndLastName: '' };

  const parts = cleanName.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], middleAndLastName: '' };
  }
  const firstName = parts[parts.length - 1];
  const middleAndLastName = parts.slice(0, parts.length - 1).join(' ');

  return { firstName, middleAndLastName };
};

export function useStudents() {
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedBirthYear, setSelectedBirthYear] = useState<string>('all');
  const [pageSize, setPageSize] = useState(25);

  // Selection state for Bulk Actions
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Import modal state
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Reset class filter and selection when academic year changes
  useEffect(() => {
    setSelectedClassId('all');
    setSelectedKeys(new Set());
  }, [selectedAcademicYearId]);

  // Reset selection and priority filter when tab or class changes
  useEffect(() => {
    setSelectedKeys(new Set());
    setSelectedPriority('all');
    setSelectedBirthYear('all');
  }, [selectedStatus, selectedClassId]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset pagination and scroll position on search or filter changes
  useEffect(() => {
    setPageSize(25);
    const el = document.querySelector('.max-h-\\[80vh\\]');
    if (el) {
      el.scrollTop = 0;
    }
  }, [debouncedSearch, selectedClassId, selectedStatus]);

  // Fetch classes list for dropdown filters
  const { classesList } = useClassesList();

  // Fetch counts for all student statuses (for tab labels)
  const { data: tabCounts } = useQuery({
    queryKey: ['students-list-counts', selectedAcademicYearId],
    queryFn: async () => {
      const { count: active } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: registered } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'registered');

      const { data: waitingStudents } = await supabase
        .from('students')
        .select('date_of_birth, target_school_year')
        .eq('status', 'waiting');

      let waitingCount = 0;
      let futureCount = 0;

      if (waitingStudents) {
        waitingStudents.forEach((student: any) => {
          if (!student.date_of_birth) {
            waitingCount++;
            return;
          }
          const birthYear = new Date(student.date_of_birth).getFullYear();
          const isFutureYear = birthYear === 2025 || student.target_school_year === '2027-2028';
          if (isFutureYear) {
            futureCount++;
          } else {
            waitingCount++;
          }
        });
      }

      return {
        active: active ?? 0,
        registered: registered ?? 0,
        waiting: waitingCount,
        future: futureCount,
      };
    },
    enabled: !!selectedAcademicYearId,
  });

  const counts = tabCounts ?? { active: 0, registered: 0, waiting: 0, future: 0 };

  // Fetch students list based on search, filters and page size
  const { data: studentsResponse, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['students-list', selectedAcademicYearId, debouncedSearch, selectedClassId, selectedStatus, pageSize],
    queryFn: async () => {
      const filters: Record<string, string> = {};

      if (selectedStatus === 'waiting' || selectedStatus === 'future') {
        filters.status = 'waiting';
      } else {
        filters.status = selectedStatus;
      }

      if (selectedClassId !== 'all' && (selectedStatus === 'active' || selectedStatus === 'registered')) {
        filters.class_id = selectedClassId;
      }

      const apiPageSize = 1000;
      const isWaitingOrFuture = selectedStatus === 'waiting' || selectedStatus === 'future';

      return api.getAll<StudentWithRelations>(
        'students',
        {
          page: 1,
          pageSize: apiPageSize,
          sortBy: isWaitingOrFuture ? 'registration_date' : 'full_name',
          sortOrder: 'asc',
        },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        },
        '*, classes(name, grade_level), guardians(*)'
      );
    },
    placeholderData: keepPreviousData,
  });

  const handleRefreshData = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['students-list-counts'] });
  };

  const rawStudentsData: StudentWithRelations[] = studentsResponse?.data?.data ?? [];

  // Extract unique birth years from raw student data
  const availableBirthYears = useMemo(() => {
    const yearsSet = new Set<number>();
    rawStudentsData.forEach((student) => {
      if (student.date_of_birth) {
        try {
          const year = new Date(student.date_of_birth).getFullYear();
          if (year >= 2018 && year <= 2027) {
            yearsSet.add(year);
          }
        } catch (e) {
          // ignore
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [rawStudentsData]);

  // Client-side filtering
  const filteredStudents = rawStudentsData.filter((student) => {
    if (selectedStatus === 'waiting') {
      if (!student.date_of_birth) return true;
      const birthYear = new Date(student.date_of_birth).getFullYear();
      if (birthYear !== 2023 && birthYear !== 2024) return false;
    }
    if (selectedStatus === 'future') {
      if (!student.date_of_birth) return false;
      const birthYear = new Date(student.date_of_birth).getFullYear();
      const isFutureYear = birthYear === 2025 || student.target_school_year === '2027-2028';
      if (!isFutureYear) return false;
    }

    if (selectedPriority !== 'all') {
      const priorityVal = student.priority_status || '';
      if (selectedPriority === 'none') {
        if (priorityVal !== '') return false;
      } else {
        if (priorityVal !== selectedPriority) return false;
      }
    }

    if (selectedBirthYear !== 'all') {
      if (!student.date_of_birth) return false;
      try {
        const birthYear = new Date(student.date_of_birth).getFullYear();
        if (birthYear !== parseInt(selectedBirthYear)) return false;
      } catch {
        return false;
      }
    }

    return true;
  });

  // Client-side sorting
  const studentsData = [...filteredStudents].sort((a, b) => {
    const isWaitingOrFuture = selectedStatus === 'waiting' || selectedStatus === 'future';

    if (isWaitingOrFuture) {
      const dateA = a.registration_date ? new Date(a.registration_date).getTime() : Infinity;
      const dateB = b.registration_date ? new Date(b.registration_date).getTime() : Infinity;
      if (dateA !== dateB) {
        return dateA - dateB;
      }
    }

    const nameA = getVietnameseSortKeys(a.full_name || '');
    const nameB = getVietnameseSortKeys(b.full_name || '');

    const compareFirstName = nameA.firstName.localeCompare(nameB.firstName, 'vi', {
      sensitivity: 'base',
      numeric: true,
    });

    if (compareFirstName !== 0) {
      return compareFirstName;
    }

    return nameA.middleAndLastName.localeCompare(nameB.middleAndLastName, 'vi', {
      sensitivity: 'base',
      numeric: true,
    });
  });

  const totalCount =
    selectedStatus === 'waiting' || selectedStatus === 'future'
      ? studentsData.length
      : (studentsResponse?.data?.count || 0);

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedKeys.size === 0) return;

    let statusLabel = '';
    let statusValue = newStatus;
    let targetSchoolYearValue: string | null = null;

    switch (newStatus) {
      case 'active':
        statusLabel = 'Đang học';
        break;
      case 'registered':
        statusLabel = 'Đã ghi danh';
        break;
      case 'waiting':
        statusLabel = 'Danh sách chờ';
        targetSchoolYearValue = '2026-2027';
        break;
      case 'future':
        statusLabel = 'Đăng ký năm tới';
        statusValue = 'waiting';
        targetSchoolYearValue = '2027-2028';
        break;
      case 'graduated':
        statusLabel = 'Đã tốt nghiệp';
        break;
      case 'transferred':
        statusLabel = 'Đã chuyển trường';
        break;
      default:
        statusLabel = newStatus;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái của ${selectedKeys.size} học sinh sang "${statusLabel}"?`)) {
      return;
    }

    setIsBulkUpdating(true);
    try {
      const ids = Array.from(selectedKeys);
      const updatePayload = {
        status: statusValue,
        target_school_year: targetSchoolYearValue,
      };

      const { error } = await supabase
        .from('students')
        .update(updatePayload as never)
        .in('id', ids);

      if (error) throw error;

      toast.success(`Đã chuyển trạng thái thành công cho ${ids.length} học sinh sang "${statusLabel}"!`);
      setSelectedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['students-list-counts'] });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
      toast.error('Có lỗi xảy ra: ' + message);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkClassAssign = async (classId: string, className: string) => {
    if (selectedKeys.size === 0) return;

    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xếp ${selectedKeys.size} học sinh đã chọn vào lớp "${className}"?\nHành động này cũng sẽ tự động chuyển trạng thái học sinh sang "Đang học".`
      )
    ) {
      return;
    }

    setIsBulkUpdating(true);
    try {
      const ids = Array.from(selectedKeys);
      const { error } = await supabase
        .from('students')
        .update({
          class_id: classId,
          status: 'active',
          target_school_year: null,
        } as never)
        .in('id', ids);

      if (error) throw error;

      toast.success(`Đã xếp lớp thành công cho ${ids.length} học sinh vào lớp "${className}"!`);
      setSelectedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['students-list-counts'] });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
      toast.error('Có lỗi xảy ra khi xếp lớp: ' + message);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const isFetchingMore = isFetching && studentsData.length < totalCount && pageSize > 25;
  const isRefetchingNewFilter = isFetching && !isFetchingMore;

  const handleResetFilters = () => {
    setSearch('');
    setSelectedClassId('all');
    setSelectedStatus('active');
    setSelectedPriority('all');
    setSelectedBirthYear('all');
    setPageSize(25);
  };

  const handleExportExcel = async () => {
    try {
      const filters: Record<string, string> = {};
      if (selectedStatus === 'waiting' || selectedStatus === 'future') {
        filters.status = 'waiting';
      } else {
        filters.status = selectedStatus;
      }
      if (selectedClassId !== 'all' && (selectedStatus === 'active' || selectedStatus === 'registered')) {
        filters.class_id = selectedClassId;
      }

      const res = await api.getAll<StudentWithRelations>(
        'students',
        { page: 1, pageSize: 10000, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        },
        '*, classes(name), guardians(*)'
      );

      const rawData: StudentWithRelations[] = res.data?.data ?? [];
      const filteredData = rawData.filter((student) => {
        if (selectedStatus === 'waiting') {
          if (!student.date_of_birth) return true;
          const birthYear = new Date(student.date_of_birth).getFullYear();
          return birthYear === 2023 || birthYear === 2024;
        }
        if (selectedStatus === 'future') {
          if (!student.date_of_birth) return false;
          const birthYear = new Date(student.date_of_birth).getFullYear();
          return birthYear === 2025 || student.target_school_year === '2027-2028';
        }
        return true;
      });

      const exportData = filteredData.map((row) => {
        const father = row.guardians?.find((g) => g.relationship === 'cha');
        const mother = row.guardians?.find((g) => g.relationship === 'me');
        const primaryGuardian = row.guardians?.find((g) => g.is_primary) || row.guardians?.[0];

        let statusText = 'Đang học';
        if (row.status === 'registered') statusText = 'Đã ghi danh, chưa nhập học';
        else if (row.status === 'waiting') {
          const birthYear = row.date_of_birth ? new Date(row.date_of_birth).getFullYear() : 0;
          statusText =
            birthYear === 2025 || row.target_school_year === '2027-2028'
              ? 'Đăng ký năm học tiếp theo'
              : 'Danh sách chờ năm học hiện tại';
        } else if (row.status === 'suspended') statusText = 'Tạm nghỉ';
        else if (row.status === 'graduated') statusText = 'Đã tốt nghiệp';
        else if (row.status === 'transferred') statusText = 'Đã chuyển trường';

        return {
          student_code: row.student_code,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString('vi-VN') : '',
          gender: row.gender === 'female' ? 'Nữ' : 'Nam',
          address: row.address || '',
          enrollment_date: row.enrollment_date ? new Date(row.enrollment_date).toLocaleDateString('vi-VN') : '',
          class_name: row.classes?.name || 'Chưa xếp lớp',
          status: statusText,
          priority_status: row.priority_status || '',
          registration_date: row.registration_date ? new Date(row.registration_date).toLocaleDateString('vi-VN') : '',
          target_school_year: row.target_school_year || '',
          father_name: father?.full_name || '',
          father_phone: father?.phone || '',
          mother_name: mother?.full_name || '',
          mother_phone: mother?.phone || '',
          guardian_name: primaryGuardian?.full_name || '',
          guardian_phone: primaryGuardian?.phone || '',
          guardian_citizen_id: primaryGuardian?.citizen_id || '',
          relationship: primaryGuardian
            ? primaryGuardian.relationship === 'me'
              ? 'Mẹ'
              : primaryGuardian.relationship === 'cha'
              ? 'Bố'
              : 'Khác'
            : '',
        };
      });

      const columns = [
        { key: 'student_code', label: 'Mã học sinh' },
        { key: 'full_name', label: 'Họ tên' },
        { key: 'date_of_birth', label: 'Ngày sinh' },
        { key: 'gender', label: 'Giới tính' },
        { key: 'address', label: 'Địa chỉ' },
        { key: 'enrollment_date', label: 'Ngày nhập học' },
        { key: 'class_name', label: 'Lớp' },
        { key: 'status', label: 'Trạng thái học sinh' },
        { key: 'priority_status', label: 'Đối tượng ưu tiên' },
        { key: 'registration_date', label: 'Ngày đăng ký chờ' },
        { key: 'target_school_year', label: 'Năm học đăng ký' },
        { key: 'father_name', label: 'Họ tên bố' },
        { key: 'father_phone', label: 'SĐT bố' },
        { key: 'mother_name', label: 'Họ tên mẹ' },
        { key: 'mother_phone', label: 'SĐT mẹ' },
        { key: 'guardian_name', label: 'Phụ huynh chính' },
        { key: 'guardian_phone', label: 'SĐT phụ huynh' },
        { key: 'guardian_citizen_id', label: 'CCCD phụ huynh' },
        { key: 'relationship', label: 'Quan hệ' },
      ];

      exportToExcel(exportData, columns, 'Danh_Sach_Hoc_Sinh', 'Học sinh');
      toast.success('Đã xuất Excel danh sách học sinh!');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
      toast.error('Có lỗi xảy ra khi xuất Excel: ' + message);
    }
  };

  const handleImportExcel = async (rows: ExcelStudentRow[]) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2;

      const fullName = row['Họ tên'] || row['Họ và tên'];
      if (!fullName) {
        errorCount++;
        errors.push(`Dòng ${lineNum}: Thiếu Họ tên học sinh.`);
        continue;
      }

      const rawDob = row['Ngày sinh'];
      const rawGender = row['Giới tính'];
      const rawEnrollDate = row['Ngày nhập học'] || new Date().toISOString();
      const address = row['Địa chỉ'];
      const className = row['Lớp'];

      const rawStatus = row['Trạng thái'] || row['Trạng thái học sinh'];
      const priorityStatus = row['Đối tượng ưu tiên'] || row['Ưu tiên'];
      const rawRegDate = row['Ngày đăng ký chờ'] || row['Ngày đăng ký'];
      const targetSchoolYear = row['Năm học đăng ký'] || row['Năm học'];

      const dob = parseExcelDate(rawDob);
      const gender = parseGender(rawGender);
      const enrollDate = parseExcelDate(rawEnrollDate);
      const regDate = rawRegDate ? parseExcelDate(rawRegDate) : null;

      let classId = null;
      if (className) {
        const foundClass = classesList.find(
          (c) => c.name.toLowerCase().trim() === String(className).toLowerCase().trim()
        );
        if (foundClass) {
          classId = foundClass.id;
        }
      }

      const fatherName = row['Họ tên bố'];
      const fatherPhone = row['SĐT bố'] || row['Số điện thoại bố'];
      const fatherCitizenId = row['CCCD bố'] || row['Số CCCD bố'];

      const motherName = row['Họ tên mẹ'];
      const motherPhone = row['SĐT mẹ'] || row['Số điện thoại mẹ'];
      const motherCitizenId = row['CCCD mẹ'] || row['Số CCCD mẹ'];

      const parentCitizenId = row['CCCD phụ huynh'] || row['CCCD bố/mẹ'];

      const randNum = Math.floor(1000 + Math.random() * 9000);
      const studentCode = row['Mã học sinh'] || `HS${randNum}`;

      let status: 'active' | 'registered' | 'waiting' | 'suspended' | 'graduated' | 'transferred' = 'active';
      if (rawStatus) {
        const s = String(rawStatus).toLowerCase().trim();
        if (s.includes('đang học') || s === 'active') status = 'active';
        else if (s.includes('ghi danh') || s.includes('chưa nhập học') || s === 'registered') status = 'registered';
        else if (s.includes('chờ') || s === 'waiting') status = 'waiting';
        else if (s.includes('tốt nghiệp') || s === 'graduated') status = 'graduated';
        else if (s.includes('chuyển trường') || s === 'transferred') status = 'transferred';
      }

      try {
        const studentId = crypto.randomUUID();

        const studentPayload = {
          id: studentId,
          school_id: schoolId,
          class_id: classId,
          student_code: String(studentCode),
          full_name: String(fullName).trim(),
          date_of_birth: dob,
          gender: gender,
          address: address ? String(address).trim() : null,
          enrollment_date: enrollDate,
          status: status,
          priority_status: priorityStatus ? String(priorityStatus).trim() : null,
          registration_date: regDate,
          target_school_year: targetSchoolYear ? String(targetSchoolYear).trim() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const studentRes = await api.create('students', studentPayload);
        if (studentRes.error) throw new Error(studentRes.error);

        const guardiansPayload: GuardianInsert[] = [];

        if (motherName && motherPhone) {
          guardiansPayload.push({
            id: crypto.randomUUID(),
            student_id: studentId,
            full_name: String(motherName).trim(),
            relationship: 'me',
            phone: String(motherPhone).trim(),
            is_primary: true,
            citizen_id: motherCitizenId
              ? String(motherCitizenId).trim()
              : parentCitizenId
              ? String(parentCitizenId).trim()
              : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (fatherName && fatherPhone) {
          guardiansPayload.push({
            id: crypto.randomUUID(),
            student_id: studentId,
            full_name: String(fatherName).trim(),
            relationship: 'cha',
            phone: String(fatherPhone).trim(),
            is_primary: guardiansPayload.length === 0,
            citizen_id: fatherCitizenId
              ? String(fatherCitizenId).trim()
              : guardiansPayload.length === 0 && parentCitizenId
              ? String(parentCitizenId).trim()
              : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        if (guardiansPayload.length > 0) {
          const guardianRes = await api.createMany('guardians', guardiansPayload as any[]);
          if (guardianRes.error) {
            console.error('Lỗi khi thêm phụ huynh:', guardianRes.error);
          }
        }

        successCount++;
      } catch (err: unknown) {
        console.error(err);
        errorCount++;
        const message = err instanceof Error ? err.message : 'Lỗi hệ thống';
        errors.push(`Dòng ${lineNum} (${fullName}): ${message}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['students-list'] });
    queryClient.invalidateQueries({ queryKey: ['students-list-counts'] });
    queryClient.invalidateQueries({ queryKey: ['classes-list'] });

    return { successCount, errorCount, errors };
  };

  const handleScrollToBottom = () => {
    if (!isFetching && studentsData.length < totalCount) {
      setPageSize((prev) => prev + 25);
    }
  };

  return {
    search,
    setSearch,
    selectedClassId,
    setSelectedClassId,
    selectedStatus,
    setSelectedStatus,
    selectedPriority,
    setSelectedPriority,
    selectedBirthYear,
    setSelectedBirthYear,
    pageSize,
    setPageSize,
    selectedKeys,
    setSelectedKeys,
    isBulkUpdating,
    isImportOpen,
    setIsImportOpen,
    studentsData,
    counts,
    availableBirthYears,
    classesList,
    totalCount,
    isLoading,
    isError,
    isFetching,
    isFetchingMore,
    isRefetchingNewFilter,
    handleRefreshData,
    handleBulkStatusUpdate,
    handleBulkClassAssign,
    handleResetFilters,
    handleExportExcel,
    handleImportExcel,
    handleScrollToBottom,
  };
}
