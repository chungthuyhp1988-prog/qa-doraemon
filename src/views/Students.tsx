import { useState, useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Phone,
  User,
  FileSpreadsheet,
  GraduationCap
} from "lucide-react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { StudentForm } from "../components/forms/StudentForm";
import { StudentDetailPanel } from "../components/details/StudentDetailPanel";
import {
  useSlidePanel,
  Table,
  type TableColumn,
  ExcelImportModal
} from "../components/ui";
import { cn } from "../lib/utils";
import { exportToExcel, parseExcelDate, parseGender } from "../lib/excelHelper";
import { useAuthStore } from "../stores/authStore";
import { useAppStore } from "../stores/appStore";
import { toast } from "../stores/toastStore";
import type { StudentRow, StudentStatus, GuardianRow, GuardianInsert, ClassRow, GradeLevel } from "../types";

// ── Local composite types for joined queries ──────────────────────────

/** Student row with joined class and guardians from the select query */
interface StudentWithRelations extends StudentRow {
  classes: Pick<ClassRow, 'name' | 'grade_level'> | null;
  guardians: GuardianRow[] | null;
}

/** Minimal class info returned by the classes-list query */
type ClassListItem = Pick<ClassRow, 'id' | 'name' | 'grade_level'>;

/** Shape of a parsed Excel import row (keys are Vietnamese column headers) */
interface ExcelStudentRow {
  [header: string]: string | number | undefined;
}

/** Helper to split full name into first name and middle/last name for Vietnamese sorting */
const getVietnameseSortKeys = (fullName: string) => {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', middleAndLastName: '' };
  
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], middleAndLastName: '' };
  }
  const firstName = parts[parts.length - 1]; // Tên chính
  const middleAndLastName = parts.slice(0, parts.length - 1).join(' '); // Họ và đệm
  
  return { firstName, middleAndLastName };
};

export function Students() {
  const { openPanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [pageSize, setPageSize] = useState(25);
  
  // Selection state for Bulk Actions
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Import modal state
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Reset class filter and selection when academic year changes
  useEffect(() => {
    setSelectedClassId("all");
    setSelectedKeys(new Set());
  }, [selectedAcademicYearId]);

  // Reset selection and priority filter when tab or class changes
  useEffect(() => {
    setSelectedKeys(new Set());
    setSelectedPriority("all");
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

  // 1. Fetch classes list for dropdown filters
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list', selectedAcademicYearId],
    queryFn: () => {
      const filters: Record<string, string> = {};
      if (selectedAcademicYearId) {
        filters.academic_year_id = selectedAcademicYearId;
      }
      return api.getAll<ClassListItem>('classes', { page: 1, pageSize: 100 }, { filters }, 'id, name, grade_level');
    },
    enabled: !!selectedAcademicYearId
  });
  const classesList: ClassListItem[] = classesResponse?.data?.data ?? [];

  // List of all classes (grade filter removed)
  const filteredClassesList = classesList;

  // 2. Fetch students list based on search, filters and page size
  const { data: studentsResponse, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['students-list', selectedAcademicYearId, debouncedSearch, selectedClassId, selectedStatus, pageSize],
    queryFn: async () => {
      const filters: Record<string, string> = {};

      // Filter by status based on active tab
      if (selectedStatus === 'waiting' || selectedStatus === 'future') {
        filters.status = 'waiting';
      } else {
        filters.status = selectedStatus;
      }

      // Filter by specific class if selected (only applicable for active and registered tabs)
      if (selectedClassId !== "all" && (selectedStatus === 'active' || selectedStatus === 'registered')) {
        filters.class_id = selectedClassId;
      }

      let apiPageSize = pageSize;
      if (selectedStatus === 'waiting' || selectedStatus === 'future') {
        apiPageSize = 1000;
      }

      const isWaitingOrFuture = selectedStatus === 'waiting' || selectedStatus === 'future';

      return api.getAll<StudentWithRelations>(
        'students',
        {
          page: 1,
          pageSize: apiPageSize,
          sortBy: isWaitingOrFuture ? 'registration_date' : 'full_name',
          sortOrder: 'asc'
        },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, classes(name, grade_level), guardians(*)'
      );
    },
    placeholderData: keepPreviousData
  });

  const rawStudentsData: StudentWithRelations[] = studentsResponse?.data?.data ?? [];

  // Client-side filtering for waiting and future lists based on birth year
  // Client-side filtering for waiting and future lists based on birth year and priority status
  const filteredStudents = rawStudentsData.filter((student) => {
    // 1. Filter by status / birth year based on tab
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

    // 2. Filter by priority status
    if (selectedPriority !== "all") {
      const priorityVal = student.priority_status || "";
      if (selectedPriority === "none") {
        if (priorityVal !== "") return false;
      } else {
        if (priorityVal !== selectedPriority) return false;
      }
    }

    return true;
  });

  // Client-side sorting based on active tab
  const studentsData = [...filteredStudents].sort((a, b) => {
    const isWaitingOrFuture = selectedStatus === 'waiting' || selectedStatus === 'future';
    
    if (isWaitingOrFuture) {
      // Sort by registration_date asc (nulls at the end)
      const dateA = a.registration_date ? new Date(a.registration_date).getTime() : Infinity;
      const dateB = b.registration_date ? new Date(b.registration_date).getTime() : Infinity;
      if (dateA !== dateB) {
        return dateA - dateB;
      }
    }
    
    // Sort by Vietnamese first name first (alphabe), then by middle and last name
    const nameA = getVietnameseSortKeys(a.full_name || '');
    const nameB = getVietnameseSortKeys(b.full_name || '');
    
    const compareFirstName = nameA.firstName.localeCompare(nameB.firstName, 'vi', {
      sensitivity: 'base',
      numeric: true
    });
    
    if (compareFirstName !== 0) {
      return compareFirstName;
    }
    
    return nameA.middleAndLastName.localeCompare(nameB.middleAndLastName, 'vi', {
      sensitivity: 'base',
      numeric: true
    });
  });

  const totalCount = selectedStatus === 'waiting' || selectedStatus === 'future' 
    ? studentsData.length 
    : (studentsResponse?.data?.count || 0);

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedKeys.size === 0) return;
    
    let statusLabel = "";
    let statusValue = newStatus;
    let targetSchoolYearValue: string | null = null;

    switch(newStatus) {
      case 'active': statusLabel = "Đang học"; break;
      case 'registered': statusLabel = "Đã ghi danh"; break;
      case 'waiting': 
        statusLabel = "Danh sách chờ"; 
        targetSchoolYearValue = "2026-2027";
        break;
      case 'future': 
        statusLabel = "Đăng ký năm tới"; 
        statusValue = "waiting";
        targetSchoolYearValue = "2027-2028";
        break;
      case 'graduated': statusLabel = "Đã tốt nghiệp"; break;
      case 'transferred': statusLabel = "Đã chuyển trường"; break;
      default: statusLabel = newStatus;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái của ${selectedKeys.size} học sinh sang "${statusLabel}"?`)) {
      return;
    }

    setIsBulkUpdating(true);
    try {
      const ids = Array.from(selectedKeys);
      const updatePayload: { status: string; target_school_year: string | null } = {
        status: statusValue,
        target_school_year: targetSchoolYearValue
      };

      const { error } = await supabase
        .from('students')
        .update(updatePayload as never)
        .in('id', ids);

      if (error) throw error;

      toast.success(`Đã chuyển trạng thái thành công cho ${ids.length} học sinh sang "${statusLabel}"!`);
      setSelectedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Lỗi hệ thống";
      toast.error("Có lỗi xảy ra: " + message);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkClassAssign = async (classId: string, className: string) => {
    if (selectedKeys.size === 0) return;

    if (!window.confirm(`Bạn có chắc chắn muốn xếp ${selectedKeys.size} học sinh đã chọn vào lớp "${className}"?\nHành động này cũng sẽ tự động chuyển trạng thái học sinh sang "Đang học".`)) {
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
          target_school_year: null
        } as never)
        .in('id', ids);

      if (error) throw error;

      toast.success(`Đã xếp lớp thành công cho ${ids.length} học sinh vào lớp "${className}"!`);
      setSelectedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Lỗi hệ thống";
      toast.error("Có lỗi xảy ra khi xếp lớp: " + message);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const isFetchingMore = isFetching && studentsData.length < totalCount && pageSize > 25;
  const isRefetchingNewFilter = isFetching && !isFetchingMore;

  // Reset filters helper
  const handleResetFilters = () => {
    setSearch("");
    setSelectedClassId("all");
    setSelectedStatus("active");
    setSelectedPriority("all");
    setPageSize(25);
  };

  // Helper to map grade level code to display text
  const getGradeName = (level: string) => {
    switch (level) {
      case 'nha_tre': return 'Nhà trẻ';
      case 'mam': return 'Mầm';
      case 'choi': return 'Chồi';
      case 'la': return 'Lá';
      default: return level;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Đang học</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500 text-white font-extrabold tracking-wide shadow-2xs select-none">Tạm nghỉ</span>;
      case 'graduated':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-sky-600 text-white font-extrabold tracking-wide shadow-2xs select-none">Tốt nghiệp</span>;
      case 'transferred':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-slate-500 text-white font-extrabold tracking-wide shadow-2xs select-none">Chuyển trường</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-slate-500 text-white font-extrabold tracking-wide shadow-2xs select-none">{status}</span>;
    }
  };

  const handleExportExcel = async () => {
    try {
      const filters: Record<string, string> = {};
      if (selectedStatus === 'waiting' || selectedStatus === 'future') {
        filters.status = 'waiting';
      } else {
        filters.status = selectedStatus;
      }
      if (selectedClassId !== "all" && (selectedStatus === 'active' || selectedStatus === 'registered')) {
        filters.class_id = selectedClassId;
      }

      const res = await api.getAll<StudentWithRelations>(
        'students',
        { page: 1, pageSize: 10000, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
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
          statusText = (birthYear === 2025 || row.target_school_year === '2027-2028') ? 'Đăng ký năm học tiếp theo' : 'Danh sách chờ năm học hiện tại';
        }
        else if (row.status === 'suspended') statusText = 'Tạm nghỉ';
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
          relationship: primaryGuardian ? (primaryGuardian.relationship === 'me' ? 'Mẹ' : primaryGuardian.relationship === 'cha' ? 'Bố' : 'Khác') : ''
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
        { key: 'relationship', label: 'Quan hệ' }
      ];

      exportToExcel(exportData, columns, 'Danh_Sach_Hoc_Sinh', 'Học sinh');
      toast.success("Đã xuất Excel danh sách học sinh!");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Lỗi hệ thống";
      toast.error("Có lỗi xảy ra khi xuất Excel: " + message);
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

      // Tìm kiếm lớp tương ứng
      let classId = null;
      if (className) {
        const foundClass = classesList.find((c) => c.name.toLowerCase().trim() === String(className).toLowerCase().trim());
        if (foundClass) {
          classId = foundClass.id;
        }
      }

      // Phụ huynh
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

        // 1. Tạo học sinh
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
          updated_at: new Date().toISOString()
        };

        const studentRes = await api.create('students', studentPayload);
        if (studentRes.error) throw new Error(studentRes.error);

        // 2. Tạo phụ huynh
        const guardiansPayload: GuardianInsert[] = [];
        
        if (motherName && motherPhone) {
          guardiansPayload.push({
            id: crypto.randomUUID(),
            student_id: studentId,
            full_name: String(motherName).trim(),
            relationship: 'me',
            phone: String(motherPhone).trim(),
            is_primary: true,
            citizen_id: motherCitizenId ? String(motherCitizenId).trim() : (parentCitizenId ? String(parentCitizenId).trim() : null),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
            citizen_id: fatherCitizenId ? String(fatherCitizenId).trim() : (guardiansPayload.length === 0 && parentCitizenId ? String(parentCitizenId).trim() : null),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        if (guardiansPayload.length > 0) {
          const guardianRes = await api.createMany('guardians', guardiansPayload as any[]);
          if (guardianRes.error) {
            console.error("Lỗi khi thêm phụ huynh:", guardianRes.error);
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

    // Refresh query
    queryClient.invalidateQueries({ queryKey: ['students-list'] });
    queryClient.invalidateQueries({ queryKey: ['classes-list'] });

    return { successCount, errorCount, errors };
  };

  const handleOpenDetail = (studentId: string) => {
    openPanel({
      title: 'Hồ sơ chi tiết học sinh',
      icon: <User size={14} />,
      width: 768,
      component: (
        <StudentDetailPanel 
          studentId={studentId} 
          classesList={classesList}
          onDeleteSuccess={() => refetch()}
        />
      )
    });
  };

  const handleCreateStudent = () => {
    openPanel({
      title: 'Thêm học sinh mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <StudentForm 
          classesList={classesList}
          onSuccess={() => refetch()}
        />
      )
    });
  };

  // Define Dynamic Table Columns based on active tab
  const getTableColumns = (): TableColumn<StudentWithRelations>[] => {
    const columns: TableColumn<StudentWithRelations>[] = [
      {
        key: "stt",
        header: "STT",
        width: "60px",
        align: "center",
        render: (_row: StudentWithRelations, index: number) => (
          <span className="text-on-surface-variant font-semibold text-[13px]">
            {index + 1}
          </span>
        )
      },
      {
        key: "full_name",
        header: "Học sinh",
        sortable: true,
        render: (row: StudentWithRelations) => (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-[14px] font-bold text-primary border border-primary/20 shrink-0">
              {row.profile_image_url ? (
                <img src={row.profile_image_url} alt={row.full_name} className="w-full h-full object-cover" />
              ) : (
                row.full_name.substring(0, 1)
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-on-surface truncate">{row.full_name}</div>
              <div className="text-[12px] text-on-surface-variant font-medium flex items-center gap-2">
                <span>{row.student_code}</span>
                <span>•</span>
                <span>{row.gender === 'female' ? 'Nữ' : 'Nam'}</span>
              </div>
            </div>
          </div>
        )
      }
    ];

    if (selectedStatus === 'active' || selectedStatus === 'registered') {
      columns.push(
        {
          key: "classes",
          header: "Lớp",
          sortable: true,
          render: (row: StudentWithRelations) => (
            <span className={row.classes?.name ? "font-semibold text-on-surface" : "text-on-surface-variant font-medium italic"}>
              {row.classes?.name || "Chưa xếp lớp"}
            </span>
          )
        },
        {
          key: "parent",
          header: "Phụ huynh chính",
          render: (row: StudentWithRelations) => {
            const primaryGuardian = row.guardians?.find((g) => g.is_primary) || row.guardians?.[0];
            const parentName = primaryGuardian
              ? `${primaryGuardian.full_name} (${primaryGuardian.relationship === 'me' ? 'Mẹ' : primaryGuardian.relationship === 'cha' ? 'Bố' : 'PH'})`
              : '—';
            const parentPhone = primaryGuardian ? primaryGuardian.phone : '—';
            return (
              <div>
                <div className="text-on-surface font-semibold">{parentName}</div>
                <div className="text-[12px] text-on-surface-variant font-medium flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-primary" /> {parentPhone}
                </div>
              </div>
            );
          }
        },
        {
          key: "address",
          header: "Địa chỉ",
          render: (row: StudentWithRelations) => (
            <span className="text-on-surface-variant font-medium text-[13px] line-clamp-1 max-w-[220px]" title={row.address || undefined}>
              {row.address || "—"}
            </span>
          )
        }
      );
    } else if (selectedStatus === 'waiting' || selectedStatus === 'future') {
      columns.push(
        {
          key: "date_of_birth",
          header: "Ngày sinh",
          render: (row: StudentWithRelations) => (
            <span className="text-on-surface font-semibold text-[13px]">
              {row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString('vi-VN') : '—'}
            </span>
          )
        },
        {
          key: "parent_name" as keyof StudentWithRelations,
          header: "Bố / Mẹ",
          render: (row: StudentWithRelations) => {
            const primaryGuardian = row.guardians?.find((g) => g.is_primary) || row.guardians?.[0];
            const name = primaryGuardian ? primaryGuardian.full_name : '—';
            const relation = primaryGuardian
              ? (primaryGuardian.relationship === 'me' ? 'Mẹ' : primaryGuardian.relationship === 'cha' ? 'Bố' : 'Người giám hộ')
              : '—';
            return (
              <div>
                <span className="font-semibold text-on-surface">{name}</span>
                <span className="text-[11px] bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded ml-2 font-medium">{relation}</span>
              </div>
            );
          }
        },
        {
          key: "parent_citizen_id" as keyof StudentWithRelations,
          header: "CCCD Bố/Mẹ",
          render: (row: StudentWithRelations) => {
            const primaryGuardian = row.guardians?.find((g) => g.is_primary) || row.guardians?.[0];
            return (
              <span className="text-on-surface-variant font-medium text-[13px] font-mono">
                {primaryGuardian?.citizen_id || '—'}
              </span>
            );
          }
        },
        {
          key: "parent_phone" as keyof StudentWithRelations,
          header: "SĐT (Zalo)",
          render: (row: StudentWithRelations) => {
            const primaryGuardian = row.guardians?.find((g) => g.is_primary) || row.guardians?.[0];
            return primaryGuardian?.phone ? (
              <a href={`tel:${primaryGuardian.phone}`} className="text-primary hover:underline font-semibold text-[13px] flex items-center gap-1">
                <Phone className="w-3 h-3 text-primary" /> {primaryGuardian.phone}
              </a>
            ) : <span className="text-on-surface-variant/40">—</span>;
          }
        },
        {
          key: "registration_date" as keyof StudentWithRelations,
          header: "Ngày đăng ký",
          render: (row: StudentWithRelations) => (
            <span className="text-on-surface-variant font-medium text-[13px]">
              {row.registration_date ? new Date(row.registration_date).toLocaleDateString('vi-VN') : '—'}
            </span>
          )
        },
        {
          key: "priority_status" as keyof StudentWithRelations,
          header: "Đối tượng ưu tiên",
          render: (row: StudentWithRelations) => {
            const getPriorityLabel = (val: string) => {
              if (!val) return 'Không';
              switch (val) {
                case 'Con GVNV': return 'Ưu tiên 1 (Con GVNV)';
                case 'Anh chị đang học ở trường': return 'Ưu tiên 2 (Anh chị đang học ở trường)';
                case 'HĐQT': return 'Ưu tiên 3 (HĐQT)';
                case 'Phụ huynh cũ': return 'Ưu tiên 4 (Phụ huynh cũ)';
                default: return val;
              }
            };
            return (
              <span className="text-on-surface-variant font-medium text-[13px] line-clamp-1 max-w-[180px]" title={getPriorityLabel(row.priority_status)}>
                {getPriorityLabel(row.priority_status)}
              </span>
            );
          }
        }
      );
    } else {
      // Graduated or Transferred
      columns.push(
        {
          key: "classes",
          header: "Lớp cuối",
          render: (row: any) => (
            <span className="text-on-surface-variant font-medium text-[13px]">
              {row.classes?.name || "—"}
            </span>
          )
        },
        {
          key: "date_of_birth",
          header: "Ngày sinh",
          render: (row: any) => (
            <span className="text-on-surface-variant font-medium text-[13px]">
              {row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString('vi-VN') : '—'}
            </span>
          )
        },
        {
          key: "updated_at",
          header: "Ngày cập nhật",
          render: (row: any) => (
            <span className="text-on-surface-variant font-medium text-[13px]">
              {row.updated_at ? new Date(row.updated_at).toLocaleDateString('vi-VN') : '—'}
            </span>
          )
        },
        {
          key: "address",
          header: "Địa chỉ",
          render: (row: any) => (
            <span className="text-on-surface-variant font-medium text-[13px] line-clamp-1 max-w-[220px]" title={row.address}>
              {row.address || "—"}
            </span>
          )
        }
      );
    }

    return columns;
  };

  const tableColumns = getTableColumns();

  const handleScrollToBottom = () => {
    if (!isFetching && studentsData.length < totalCount) {
      setPageSize(prev => prev + 25);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Danh sách học sinh</h2>
            <span className="text-[12px] font-extrabold text-primary bg-primary-container/20 px-3 py-1 rounded-xl">
              Tổng số: {totalCount} học sinh
            </span>
          </div>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">Quản lý và theo dõi thông tin chi tiết của tất cả học sinh tại trường mầm non.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={handleExportExcel}
            className="border border-outline-variant hover:bg-surface-container-high px-3.5 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-all cursor-pointer text-on-surface-variant whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Xuất Excel
          </button>
          <button 
            onClick={() => setIsImportOpen(true)}
            className="border border-outline-variant hover:bg-surface-container-high px-3.5 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 transition-all cursor-pointer text-on-surface-variant whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-primary" />
            Nhập Excel
          </button>
          <button 
            onClick={handleCreateStudent}
            className="bg-primary text-on-primary px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow-md cursor-pointer duration-200 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Thêm học sinh mới
          </button>
        </div>
      </div>

      {/* Navigation Tabs for Categories */}
      <div className="flex border-b border-outline-variant/30 overflow-x-auto gap-1 scrollbar-none mb-2 bg-surface-container-lowest p-1 rounded-xl">
        {[
          { value: 'active', label: 'Đang học' },
          { value: 'registered', label: 'Đã ghi danh' },
          { value: 'waiting', label: 'Danh sách chờ' },
          { value: 'graduated', label: 'Đã tốt nghiệp' },
          { value: 'transferred', label: 'Đã chuyển trường' },
          { value: 'future', label: 'Đăng ký năm tới' }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => {
              setSelectedStatus(tab.value);
              setSelectedClassId("all"); // Reset class filter when switching tabs
            }}
            className={cn(
              "px-4 py-2 font-bold text-[13px] rounded-lg transition-all whitespace-nowrap cursor-pointer",
              selectedStatus === tab.value
                ? "bg-primary text-on-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-wrap gap-3.5 items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên học sinh, mã số..." 
            className="w-full pl-10 pr-4 py-2 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Class Filter - Only visible for Active and Registered tabs */}
        {(selectedStatus === 'active' || selectedStatus === 'registered') && (
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
          >
            <option value="all">Tất cả các lớp</option>
            {filteredClassesList.map((c: any) => {
              const gradeName = getGradeName(c.grade_level);
              return (
                <option key={c.id} value={c.id}>
                  {c.name}{gradeName ? ` (${gradeName})` : ''}
                </option>
              );
            })}
          </select>
        )}

        {/* Priority Filter - Only visible for Waiting, Future and Registered tabs */}
        {(selectedStatus === 'waiting' || selectedStatus === 'future' || selectedStatus === 'registered') && (
          <select 
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
          >
            <option value="all">Tất cả đối tượng ưu tiên</option>
            <option value="Con GVNV">Ưu tiên 1 (Con GVNV)</option>
            <option value="Anh chị đang học ở trường">Ưu tiên 2 (Anh chị đang học ở trường)</option>
            <option value="HĐQT">Ưu tiên 3 (HĐQT)</option>
            <option value="Phụ huynh cũ">Ưu tiên 4 (Phụ huynh cũ)</option>
            <option value="none">Không ưu tiên</option>
          </select>
        )}

        <button 
          onClick={handleResetFilters}
          className="px-4 py-2 text-primary text-[14px] font-bold hover:bg-primary/5 rounded-xl transition-all cursor-pointer ml-auto"
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedKeys.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-2xl flex flex-wrap items-center gap-3 animate-in slide-in-from-top-2 duration-200 shadow-2xs">
          <span className="text-[13.5px] font-extrabold text-primary flex items-center gap-1.5">
            <User className="w-4 h-4 text-primary" />
            Đã chọn <span className="underline decoration-2">{selectedKeys.size}</span> học sinh
          </span>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-[13px] font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer bg-surface-container-high px-2.5 py-1 rounded-lg"
          >
            Hủy chọn
          </button>
          
          <div className="h-4 w-px bg-outline-variant/60 mx-1 hidden sm:block" />

          {(selectedStatus === 'waiting' || selectedStatus === 'future') && (
            <>
              <span className="text-[13px] font-extrabold text-on-surface-variant flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-primary" />
                Xếp nhanh vào lớp:
              </span>
              <select
                value=""
                disabled={isBulkUpdating}
                onChange={(e) => {
                  const classId = e.target.value;
                  const className = e.target.options[e.target.selectedIndex].text;
                  if (classId) handleBulkClassAssign(classId, className);
                }}
                className="px-2.5 py-1.5 rounded-xl text-[12.5px] font-bold border cursor-pointer bg-white text-on-surface border-outline-variant/60 hover:bg-surface-container outline-none transition-all shadow-3xs"
              >
                <option value="">-- Chọn lớp học --</option>
                {filteredClassesList.map((c) => {
                  const gradeLabel = c.grade_level === 'nha_tre' ? 'Nhà trẻ' : c.grade_level === 'mam' ? 'Mầm' : c.grade_level === 'choi' ? 'Chồi' : c.grade_level === 'la' ? 'Lá' : '';
                  return (
                    <option key={c.id} value={c.id}>
                      {gradeLabel ? `${c.name} (${gradeLabel})` : c.name}
                    </option>
                  );
                })}
              </select>
              <div className="h-4 w-px bg-outline-variant/60 mx-1 hidden sm:block" />
            </>
          )}
          
          <span className="text-[13px] font-extrabold text-on-surface-variant font-medium">Chuyển trạng thái:</span>
          
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'active', label: 'Đang học', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
              { value: 'registered', label: 'Đã ghi danh', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
              { value: 'waiting', label: 'Danh sách chờ', color: 'bg-amber-500 hover:bg-amber-600 text-white' },
              { value: 'future', label: 'Đăng ký năm tới', color: 'bg-pink-600 hover:bg-pink-700 text-white' },
              { value: 'graduated', label: 'Đã tốt nghiệp', color: 'bg-sky-600 hover:bg-sky-700 text-white' },
              { value: 'transferred', label: 'Đã chuyển trường', color: 'bg-slate-500 hover:bg-slate-600 text-white' }
            ]
              .filter(item => {
                return item.value !== selectedStatus;
              })
              .map(item => (
                <button
                  key={item.value}
                  disabled={isBulkUpdating}
                  onClick={() => handleBulkStatusUpdate(item.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[12px] font-extrabold transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50",
                    item.color
                  )}
                >
                  {item.label}
                </button>
              ))
            }
          </div>
        </div>
      )}

      {/* Main Student List — Full Width Layout */}
      <div className="bg-surface rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col min-h-[400px]">
        {/* Main Table Area */}
        <div className="bg-white flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-12 h-12 bg-surface-variant/40 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-variant/40 rounded w-1/4" />
                    <div className="h-3 bg-surface-variant/40 rounded w-1/6" />
                  </div>
                  <div className="w-24 h-4 bg-surface-variant/40 rounded" />
                  <div className="w-28 h-4 bg-surface-variant/40 rounded" />
                  <div className="w-16 h-8 bg-surface-variant/40 rounded" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-16 text-center text-error space-y-3">
              <h4 className="font-bold text-lg">Đã xảy ra lỗi khi tải dữ liệu</h4>
              <p className="text-sm text-on-surface-variant">Vui lòng kiểm tra lại kết nối Supabase và thử lại.</p>
            </div>
          ) : studentsData.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
                <User className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg text-on-surface">Không tìm thấy học sinh nào</h4>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto">Không tìm thấy bản ghi nào trùng khớp với bộ lọc hoặc tìm kiếm hiện tại.</p>
            </div>
          ) : (
            <Table
              className={cn(
                "rounded-none border-0 bg-transparent transition-opacity duration-200",
                isRefetchingNewFilter && "opacity-60 pointer-events-none"
              )}
              columns={tableColumns}
              data={studentsData}
              rowKey={(row) => row.id}
              selectable={true}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              onRowClick={(row) => handleOpenDetail(row.id)}
              onScrollToBottom={handleScrollToBottom}
              loadingMore={isFetchingMore}
            />
          )}
        </div>
      </div>

      {/* Modal Import Excel */}
      <ExcelImportModal
        open={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          refetch();
        }}
        title="Nhập danh sách học sinh từ Excel"
        templateType="students"
        onImport={handleImportExcel}
      />
    </div>
  );
}
