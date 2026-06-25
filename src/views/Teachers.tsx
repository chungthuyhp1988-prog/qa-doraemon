import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Users,
  LayoutGrid,
  List,
  Edit2,
  Trash2,
  Eye,
  User,
  FileSpreadsheet
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { 
  Table, 
  type TableColumn, 
  ConfirmDialog, 
  useSlidePanel,
  ExcelImportModal 
} from "../components/ui";
import { TeacherForm } from "../components/forms/TeacherForm";
import { TeacherDetailPanel } from "../components/details/TeacherDetailPanel";
import { toast } from "../stores/toastStore";
import { exportToExcel, parseExcelDate } from "../lib/excelHelper";
import { useAuthStore } from "../stores/authStore";

// Helper function to compare Vietnamese names alphabetically by first name
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

export function Teachers() {
  const queryClient = useQueryClient();
  const { openPanel } = useSlidePanel();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  
  // View mode: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Delete state for quick delete from list
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // Import Excel state
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedRole, selectedClassId, selectedStatus]);

  // 1. Fetch classes list for the class filter dropdown
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.getAll('classes', { page: 1, pageSize: 100 }, {}, 'id, name')
  });
  const classesList = classesResponse?.data?.data || [];

  // 2. Fetch users list (teachers and staff) based on search and filters
  const { data: teachersResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['teachers-list', debouncedSearch, selectedRole, selectedClassId, selectedStatus, page],
    queryFn: async () => {
      const filters: Record<string, any> = {};
      
      // Filter by work status
      filters.work_status = selectedStatus;
      
      // Filter by specific class if selected
      if (selectedClassId !== "all") {
        const { data: ctData } = await api.getAll(
          'class_teachers', 
          { page: 1, pageSize: 1000 }, 
          { filters: { class_id: selectedClassId } }
        );
        const teacherIds = ctData?.data?.map((ct: any) => ct.teacher_id) || [];
        
        if (teacherIds.length > 0) {
          filters.id = `in.(${teacherIds.join(',')})`;
        } else {
          return { data: { data: [], count: 0 }, error: null, count: 0 };
        }
      }

      // Query the users table with their class assignments
      return api.getAll(
        'users',
        { page, pageSize, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, class_teachers(class_id, classes(name))'
      );
    }
  });

  const rawTeachersData = teachersResponse?.data?.data || [];


  const classifyUser = (user: any) => {
    const role = user.role || '';
    const title = (user.job_title || getTeacherTitle(user.email, user.role, user.job_title) || '').toLowerCase().trim();
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
        !title.includes('bếp') && !title.includes('cấp dưỡng') && !title.includes('nấu ăn') && 
        !title.includes('kỹ thuật') && !title.includes('bảo vệ') && !title.includes('lao công') && !title.includes('vệ sinh')
      );

    if (isBGHAndOffice) return 1;

    const isTeacher = role === 'teacher' || title.includes('giáo viên');
    if (isTeacher) return 2;

    const isKitchen = title.includes('bếp') || title.includes('cấp dưỡng') || title.includes('nấu ăn');
    if (isKitchen) return 3;

    return 4;
  };

  const compareGroup1 = (a: any, b: any) => {
    const getSubRank = (user: any) => {
      const title = (user.job_title || getTeacherTitle(user.email, user.role, user.job_title) || '').toLowerCase().trim();
      const name = (user.full_name || '').trim();

      const isPrincipal = title.includes('hiệu trưởng') && !title.includes('phó') && !title.startsWith('p.');
      if (isPrincipal) return 1;
      
      if (title.includes('phó hiệu trưởng') || title.includes('p. hiệu trưởng') || title.includes('phó hiệu') || title.includes('p.hiệu')) {
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

  // Client-side category filtering
  const filteredTeachersData = [...rawTeachersData].filter((user: any) => {
    if (selectedRole === 'all') return true;
    const group = classifyUser(user);
    if (selectedRole === 'bgh' && (group === 1 || group === 5)) return true;
    if (selectedRole === 'teacher' && group === 2) return true;
    if (selectedRole === 'kitchen' && group === 3) return true;
    if (selectedRole === 'maintenance' && group === 4) return true;
    return false;
  });

  // Sort: Group 1 -> Group 2 -> Group 3 -> Group 4 -> Group 5
  const teachersData = filteredTeachersData.sort((a: any, b: any) => {
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

  // Helper to map role to display text & styles
  const getRoleBadge = (row: any) => {
    const title = row.job_title || getTeacherTitle(row.email, row.role, row.job_title);
    switch (row.role) {
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-rose-600 text-white font-extrabold tracking-wide shadow-2xs select-none">
            {title}
          </span>
        );
      case 'staff':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-purple-600 text-white font-extrabold tracking-wide shadow-2xs select-none">
            {title}
          </span>
        );
      case 'teacher':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] bg-sky-600 text-white font-extrabold tracking-wide shadow-2xs select-none">
            {title}
          </span>
        );
    }
  };

  // Get initials for profile placeholder
  const getInitials = (name: string) => {
    if (!name) return "GV";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedRole("all");
    setSelectedClassId("all");
    setSelectedStatus("active");
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
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa nhân sự', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
      setSelectedTeacher(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      const filters: Record<string, any> = {};
      filters.work_status = selectedStatus;
      if (selectedRole !== "all") {
        filters.role = selectedRole;
      }
      if (selectedClassId !== "all") {
        const { data: ctData } = await api.getAll(
          'class_teachers', 
          { page: 1, pageSize: 1000 }, 
          { filters: { class_id: selectedClassId } }
        );
        const teacherIds = ctData?.data?.map((ct: any) => ct.teacher_id) || [];
        
        if (teacherIds.length > 0) {
          filters.id = `in.(${teacherIds.join(',')})`;
        } else {
          toast.error("Không có nhân sự nào để xuất");
          return;
        }
      }

      const res = await api.getAll(
        'users',
        { page: 1, pageSize: 1000, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, class_teachers(classes(name))'
      );

      const exportData = (res.data?.data || []).map((row: any) => {
        const classes = row.class_teachers?.map((ct: any) => ct.classes?.name).filter(Boolean).join(', ') || 'Chưa phân công';
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
          status: row.work_status === 'active' ? 'Đang làm việc' 
            : row.work_status === 'maternity_leave' ? 'Đang nghỉ thai sản'
            : row.work_status === 'on_leave' ? 'Nghỉ phép'
            : 'Đã nghỉ việc',
          classes: classes
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
        { key: 'classes', label: 'Lớp phụ trách' }
      ];

      exportToExcel(exportData, columns, 'Danh_Sach_Giao_Vien_Nhan_Vien', 'Cán bộ giáo viên');
      toast.success("Đã xuất Excel danh sách giáo viên!");
    } catch (err: any) {
      console.error(err);
      toast.error("Có lỗi xảy ra khi xuất Excel: " + err.message);
    }
  };

  const handleImportExcel = async (rows: any[]) => {
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
      
      // Map vai trò
      let role: 'admin' | 'teacher' | 'staff' = 'teacher';
      if (rawRole) {
        const roleLower = String(rawRole).toLowerCase().trim();
        if (roleLower === 'admin' || roleLower.includes('quản trị') || roleLower.includes('giám hiệu')) {
          role = 'admin';
        } else if (roleLower === 'staff' || roleLower.includes('nhân viên') || roleLower.includes('bếp') || roleLower.includes('bảo vệ')) {
          role = 'staff';
        }
      }

      // Map trạng thái công tác
      let workStatus: 'active' | 'maternity_leave' | 'inactive' | 'on_leave' = 'active';
      let isActive = true;
      if (rawStatus) {
        const statusLower = String(rawStatus).toLowerCase().trim();
        if (statusLower.includes('thai sản') || statusLower.includes('sinh')) {
          workStatus = 'maternity_leave';
          isActive = true;
        } else if (statusLower.includes('nghỉ phép') || statusLower.includes('phép') || statusLower.includes('nghỉ cưới') || statusLower.includes('nghỉ ốm')) {
          workStatus = 'on_leave';
          isActive = true;
        } else if (statusLower.includes('nghỉ việc') || statusLower.includes('nghỉ hẳn') || statusLower.includes('đã nghỉ') || statusLower.includes('không hoạt động')) {
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
          job_title: jobTitle ? jobTitle.trim() : (role === 'teacher' ? 'Giáo viên' : 'Nhân viên'),
          date_of_birth: dob,
          address: address ? address.trim() : null,
          is_active: isActive,
          work_status: workStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const res = await api.create('users', userPayload);
        if (res.error) throw new Error(res.error);

        successCount++;
      } catch (err: any) {
        console.error(err);
        errorCount++;
        errors.push(`Dòng ${lineNum} (${fullName}): ${err.message || 'Lỗi hệ thống'}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['teachers-list'] });
    return { successCount, errorCount, errors };
  };

  // SlidePanel handlers
  const handleOpenDetail = (teacherId: string) => {
    openPanel({
      title: 'Thông tin chi tiết nhân sự',
      icon: <User size={14} />,
      width: 768,
      component: (
        <TeacherDetailPanel 
          teacherId={teacherId} 
          classesList={classesList}
          onDeleteSuccess={() => refetch()}
        />
      )
    });
  };

  const handleCreateTeacher = () => {
    openPanel({
      title: 'Thêm nhân sự mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <TeacherForm 
          classesList={classesList}
          onSuccess={() => refetch()}
        />
      )
    });
  };

  const handleEditTeacher = (teacher: any) => {
    openPanel({
      title: 'Chỉnh sửa nhân sự',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <TeacherForm 
          teacher={teacher}
          classesList={classesList}
          onSuccess={() => refetch()}
        />
      )
    });
  };

  // Define Table Columns
  const tableColumns: TableColumn<any>[] = [
    {
      key: "stt",
      header: "STT",
      width: "60px",
      align: "center",
      render: (_row: any, index: number) => (
        <span className="text-on-surface-variant font-semibold text-[13px]">
          {((page - 1) * pageSize) + index + 1}
        </span>
      )
    },
    {
      key: "full_name",
      header: "Họ và tên",
      sortable: true,
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {row.avatar_url ? (
              <img src={row.avatar_url} alt={row.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px] font-bold text-primary font-playfair">
                {getInitials(row.full_name)}
              </span>
            )}
          </div>
          <span className="font-bold text-on-surface text-[14px]">{row.full_name}</span>
        </div>
      )
    },
    {
      key: "role",
      header: "Chức vụ",
      render: (row: any) => getRoleBadge(row)
    },
    {
      key: "phone",
      header: "Số điện thoại",
      render: (row: any) => row.phone ? (
        <a href={`tel:${row.phone}`} className="text-primary hover:underline font-semibold text-[13px] select-all">
          {row.phone}
        </a>
      ) : <span className="text-on-surface-variant/40">—</span>
    },
    {
      key: "date_of_birth",
      header: "Ngày sinh",
      render: (row: any) => (
        <span className="text-on-surface-variant text-[13px]">
          {formatDate(row.date_of_birth) || <span className="text-on-surface-variant/40">—</span>}
        </span>
      )
    },
    {
      key: "address",
      header: "Địa chỉ",
      render: (row: any) => (
        <span className="text-on-surface-variant text-[13px] line-clamp-1 max-w-[200px]" title={row.address}>
          {row.address || <span className="text-on-surface-variant/40">—</span>}
        </span>
      )
    },
    {
      key: "actions" as any,
      header: "Hành động",
      render: (row: any) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenDetail(row.id)}
            className="p-1.5 text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEditTeacher(row)}
            className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
            title="Sửa thông tin"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedTeacher(row);
              setIsDeleteDialogOpen(true);
            }}
            className="p-1.5 text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer"
            title="Xóa nhân sự"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12 pt-6">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[24px] md:text-[30px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">DANH SÁCH CÁN BỘ, GIÁO VIÊN, NHÂN VIÊN</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportExcel}
            className="border border-outline-variant hover:bg-surface-container-high px-4 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 transition-all cursor-pointer text-on-surface-variant"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Xuất Excel
          </button>
          <button 
            onClick={() => setIsImportOpen(true)}
            className="border border-outline-variant hover:bg-surface-container-high px-4 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 transition-all cursor-pointer text-on-surface-variant"
          >
            <Plus className="w-4 h-4 text-primary" />
            Nhập Excel
          </button>

          {/* View Mode Switcher Toggle */}
          <div className="bg-surface-container rounded-xl p-1 flex items-center border border-outline-variant/30">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                viewMode === 'grid' 
                  ? "bg-white text-primary shadow-sm" 
                  : "text-on-surface-variant hover:text-on-surface"
              )}
              title="Xem dạng lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                viewMode === 'table' 
                  ? "bg-white text-primary shadow-sm" 
                  : "text-on-surface-variant hover:text-on-surface"
              )}
              title="Xem dạng bảng"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={handleCreateTeacher}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Thêm nhân sự mới
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-wrap gap-3.5 items-center mb-5">
        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo họ tên, email..." 
            className="w-full pl-10 pr-4 py-2 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Role Filter */}
        <select 
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
        >
          <option value="all">Tất cả chức vụ</option>
          <option value="bgh">Ban Giám hiệu và văn phòng</option>
          <option value="teacher">Giáo viên</option>
          <option value="kitchen">Tổ bếp</option>
          <option value="maintenance">Kỹ thuật, bảo vệ, lao công</option>
        </select>

        {/* Class Filter */}
        <select 
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
        >
          <option value="all">Tất cả lớp</option>
          {classesList.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
        >
          <option value="active">Đang làm việc</option>
          <option value="maternity_leave">Đang nghỉ thai sản</option>
          <option value="inactive">Đã nghỉ việc</option>
          <option value="on_leave">Nghỉ phép</option>
        </select>

        <button 
          onClick={handleResetFilters}
          className="px-4 py-2 text-primary text-[14px] font-semibold hover:bg-surface-container-low rounded-xl transition-colors cursor-pointer ml-auto"
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        // Loading Skeleton
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 p-6 shadow-sm animate-pulse flex flex-col items-center">
                <div className="w-20 h-20 bg-surface-variant/40 rounded-full mb-4" />
                <div className="h-5 bg-surface-variant/40 rounded w-2/3 mb-2" />
                <div className="h-4 bg-surface-variant/40 rounded w-1/2 mb-4" />
                <div className="h-6 bg-surface-variant/40 rounded-full w-24 mb-6" />
                <div className="w-full h-16 bg-surface-variant/20 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          <Table 
            className="rounded-[32px] border border-outline-variant/30 shadow-sm bg-surface-container-lowest" 
            columns={tableColumns} 
            data={[]} 
            loading={true} 
          />
        )
      ) : isError ? (
        // Error State
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-12 text-center max-w-md mx-auto shadow-sm">
          <h4 className="text-[20px] font-bold text-error mb-2">Không thể tải dữ liệu</h4>
          <p className="text-on-surface-variant text-[14px] mb-6">Đã xảy ra lỗi khi tải danh sách nhân sự từ hệ thống.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-[14px] font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      ) : teachersData.length === 0 ? (
        // Empty State
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[32px] p-16 text-center max-w-lg mx-auto shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h4 className="text-[22px] font-bold font-playfair text-on-surface mb-2">Không tìm thấy kết quả</h4>
          <p className="text-on-surface-variant text-[14px] mb-6 max-w-xs">Không có nhân sự nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.</p>
          <button 
            onClick={handleResetFilters}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl text-[14px] font-semibold hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        // Data Views
        <>
          {viewMode === 'grid' ? (
            // Card Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {teachersData.map((teacher: any) => {
                const classesAssigned = teacher.class_teachers
                  ?.map((ct: any) => ct.classes?.name)
                  .filter(Boolean) || [];

                const classDisplay = classesAssigned.length > 0 
                  ? classesAssigned.join(", ") 
                  : (teacher.role === 'admin' ? "Ban giám hiệu" : (teacher.role === 'staff' ? "Văn phòng" : "Chưa phân lớp"));

                return (
                  <div 
                    key={teacher.id} 
                    onClick={() => handleOpenDetail(teacher.id)}
                    className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 p-6 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between overflow-hidden cursor-pointer"
                  >
                    {/* Hover actions */}
                    <div className="absolute top-4 right-4 flex gap-1.5 bg-white border border-outline-variant/60 shadow-md p-1 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 select-none" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDetail(teacher.id)}
                        className="p-1.5 text-on-surface-variant hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEditTeacher(teacher)}
                        className="p-1.5 text-on-surface-variant hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTeacher(teacher);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-1.5 text-on-surface-variant hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa nhân sự"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col items-center text-center h-full">
                      {/* Avatar / Monogram */}
                      <div className="w-20 h-20 bg-primary/5 rounded-full overflow-hidden border-2 border-primary/20 p-1 shadow-sm mb-4 flex items-center justify-center shrink-0">
                        {teacher.avatar_url ? (
                          <div className="w-full h-full rounded-full overflow-hidden">
                            <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[22px] font-playfair">
                            {getInitials(teacher.full_name)}
                          </div>
                        )}
                      </div>
                      
                      {/* Basic Info */}
                      <div className="mb-4">
                        <h3 className="text-[18px] font-bold italic font-playfair text-on-surface leading-tight line-clamp-1">{teacher.full_name}</h3>
                        <p className="text-[12px] text-on-surface-variant font-medium mt-1 select-all">{teacher.email}</p>
                      </div>

                      {/* Role & Status Badges */}
                      <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                        {getRoleBadge(teacher)}
                        
                        {(() => {
                          let badgeClass = "bg-gray-50 text-gray-600 border-gray-200";
                          let text = "Đã nghỉ việc";
                          switch (teacher.work_status) {
                            case 'active':
                              badgeClass = "bg-green-50 text-green-700 border-green-200";
                              text = "Đang làm việc";
                              break;
                            case 'maternity_leave':
                              badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                              text = "Nghỉ thai sản";
                              break;
                            case 'on_leave':
                              badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                              text = "Nghỉ phép";
                              break;
                            case 'inactive':
                            default:
                              badgeClass = "bg-red-50 text-red-700 border-red-200";
                              text = "Đã nghỉ việc";
                              break;
                          }
                          return (
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border",
                              badgeClass
                            )}>
                              {text}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Meta Information Details */}
                      {(teacher.date_of_birth || teacher.address) && (
                        <div className="w-full text-left space-y-2 mb-4 px-1 text-[13px] text-on-surface-variant border-t border-outline-variant/20 pt-3">
                          {teacher.date_of_birth && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-primary/70 shrink-0" />
                              <span>Sinh ngày: <strong>{formatDate(teacher.date_of_birth)}</strong></span>
                            </div>
                          )}
                          {teacher.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-primary/70 shrink-0" />
                              <span className="line-clamp-1" title={teacher.address}>Địa chỉ: {teacher.address}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Responsibility & Class */}
                      <div className="w-full bg-surface-container-low rounded-2xl p-4 text-left border border-outline-variant/30 mt-auto">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-on-primary-container" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Phụ trách</span>
                            <span className="text-[14px] font-semibold text-on-surface line-clamp-1">{classDisplay}</span>
                          </div>
                        </div>
                        
                        {teacher.phone && (
                          <>
                            <div className="h-px w-full bg-outline-variant/30 my-3"></div>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                                <Phone className="w-4 h-4 text-on-primary-container" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Số điện thoại</span>
                                <a href={`tel:${teacher.phone}`} className="text-[14px] font-semibold text-primary hover:underline select-all" onClick={(e) => e.stopPropagation()}>
                                  {teacher.phone}
                                </a>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Table View
            <Table 
              className="rounded-[32px] border border-outline-variant/30 shadow-sm bg-surface-container-lowest"
              columns={tableColumns} 
              data={teachersData} 
              rowKey={(row) => row.id}
              onRowClick={(row) => handleOpenDetail(row.id)}
              emptyTitle="Không tìm thấy nhân sự"
              emptyDescription="Không có nhân sự nào khớp với bộ lọc."
            />
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-10 bg-surface-container-lowest px-6 py-4 rounded-[24px] border border-outline-variant/30 shadow-sm">
              <span className="text-[14px] text-on-surface-variant">
                Hiển thị bản ghi từ <strong>{((page - 1) * pageSize) + 1}</strong> đến <strong>{Math.min(page * pageSize, totalCount)}</strong> trong tổng số <strong>{totalCount}</strong> nhân sự
              </span>
              <div className="flex items-center gap-2">
                <button
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-outline-variant/50 rounded-xl hover:bg-surface-container-low disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog (for quick delete from list) */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteTeacher}
        title="Xóa nhân sự"
        message={`Bạn có chắc chắn muốn xóa hoàn toàn nhân sự ${selectedTeacher?.full_name || ''}? Hành động này không thể hoàn tác và sẽ xóa tất cả dữ liệu liên quan.`}
        confirmText="Xóa nhân sự"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />

      {/* Modal Import Excel */}
      <ExcelImportModal
        open={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          refetch();
        }}
        title="Nhập danh sách giáo viên từ Excel"
        templateType="teachers"
        onImport={handleImportExcel}
      />
    </div>
  );
}
