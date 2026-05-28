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
  Trash2
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { Table, type TableColumn, ConfirmDialog } from "../components/ui";
import { TeacherForm } from "../components/forms/TeacherForm";
import { toast } from "../stores/toastStore";

export function Teachers() {
  const queryClient = useQueryClient();
  
  // View mode: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Dialog/Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 100;

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
  const { data: teachersResponse, isLoading, isError } = useQuery({
    queryKey: ['teachers-list', debouncedSearch, selectedRole, selectedClassId, selectedStatus, page],
    queryFn: async () => {
      const filters: Record<string, any> = {};
      
      // Filter by active status
      if (selectedStatus !== "all") {
        filters.is_active = selectedStatus === "active";
      }
      
      // Filter by role
      if (selectedRole !== "all") {
        filters.role = selectedRole;
      }
      
      // Filter by specific class if selected
      if (selectedClassId !== "all") {
        // First find the teacher IDs assigned to this class
        const { data: ctData } = await api.getAll(
          'class_teachers', 
          { page: 1, pageSize: 1000 }, 
          { filters: { class_id: selectedClassId } }
        );
        const teacherIds = ctData?.data?.map((ct: any) => ct.teacher_id) || [];
        
        if (teacherIds.length > 0) {
          filters.id = `in.(${teacherIds.join(',')})`;
        } else {
          // If no teachers are assigned to this class, return empty results immediately
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
  
  // Sắp xếp: Ban giám hiệu (admin) -> Kế toán (staff) -> Giáo viên (teacher, sắp xếp theo lớp rồi đến tên)
  const teachersData = [...rawTeachersData].sort((a: any, b: any) => {
    // 1. Sắp xếp theo vai trò: admin -> staff -> teacher
    const roleOrder: Record<string, number> = { admin: 1, staff: 2, teacher: 3 };
    const roleA = roleOrder[a.role] || 4;
    const roleB = roleOrder[b.role] || 4;
    if (roleA !== roleB) return roleA - roleB;

    // 2. Định hình chức vụ cụ thể trong Ban giám hiệu (Hiệu trưởng -> Hiệu Phó -> BGH khác)
    if (a.role === 'admin' && b.role === 'admin') {
      const emailOrder: Record<string, number> = {
        'nguyenthu20390@gmail.com': 1, // Hiệu trưởng
        'phamthicamhoai09091998@gmail.com': 2, // Hiệu Phó
      };
      const emailA = emailOrder[a.email] || 3;
      const emailB = emailOrder[b.email] || 3;
      if (emailA !== emailB) return emailA - emailB;
    }

    // 3. Đối với giáo viên, sắp xếp theo tên lớp phụ trách (Doraemon 1 -> Doraemon 2 -> Dorami 1...)
    if (a.role === 'teacher' && b.role === 'teacher') {
      const classA = a.class_teachers?.[0]?.classes?.name || 'Z_no_class';
      const classB = b.class_teachers?.[0]?.classes?.name || 'Z_no_class';
      
      const cmp = classA.localeCompare(classB, 'vi', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }

    // 4. Cuối cùng sắp xếp theo họ tên bảng chữ cái Tiếng Việt
    return a.full_name.localeCompare(b.full_name, 'vi');
  });

  const totalCount = teachersResponse?.data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Helper to map role to display text & styles
  const getRoleBadge = (row: any) => {
    const title = row.job_title || getTeacherTitle(row.email, row.role);
    switch (row.role) {
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] bg-red-50 text-red-700 border border-red-200 font-bold tracking-wide">
            {title}
          </span>
        );
      case 'staff':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] bg-purple-50 text-purple-700 border border-purple-200 font-bold tracking-wide">
            {title}
          </span>
        );
      case 'teacher':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] bg-blue-50 text-blue-700 border border-blue-200 font-bold tracking-wide">
            {title}
          </span>
        );
    }
  };

  const getTeacherTitle = (email: string, role: string) => {
    const emailLower = email.toLowerCase().trim();
    if (emailLower === 'nguyenthu20390@gmail.com') return 'Hiệu trưởng';
    if (emailLower === 'phamthicamhoai09091998@gmail.com') return 'Hiệu Phó';
    if (emailLower === 'thuylinh.drm@gmail.com') return 'Kế toán';
    if (role === 'admin') return 'Ban giám hiệu';
    if (role === 'staff') return 'Nhân viên';
    return 'Giáo viên';
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
    setSelectedStatus("all");
    setPage(1);
  };

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    setIsDeleting(true);
    try {
      const res = await api.softDelete('users', selectedTeacher.id);
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

  // Define Table Columns
  const tableColumns: TableColumn<any>[] = [
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
      key: "class",
      header: "Phụ trách",
      render: (row: any) => {
        const classesAssigned = row.class_teachers
          ?.map((ct: any) => ct.classes?.name)
          .filter(Boolean) || [];
        return (
          <span className="font-semibold text-on-surface-variant text-[13px]">
            {classesAssigned.length > 0 
              ? classesAssigned.join(", ") 
              : (row.role === 'admin' ? "Ban giám hiệu" : (row.role === 'staff' ? "Văn phòng" : "Chưa phân lớp"))}
          </span>
        );
      }
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
      key: "email",
      header: "Email",
      render: (row: any) => (
        <span className="text-on-surface-variant text-[13px] font-medium select-all">{row.email}</span>
      )
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
      key: "is_active",
      header: "Trạng thái",
      render: (row: any) => (
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border",
          row.is_active 
            ? "bg-green-50 text-green-700 border-green-200" 
            : "bg-gray-50 text-gray-600 border-gray-200"
        )}>
          {row.is_active ? 'Đang làm' : 'Đã nghỉ'}
        </span>
      )
    },
    {
      key: "actions" as any,
      header: "Hành động",
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedTeacher(row);
              setFormMode('edit');
              setIsFormOpen(true);
            }}
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
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[32px] md:text-[40px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Danh sách Nhân sự</h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">Quản lý đội ngũ giáo viên, ban giám hiệu và nhân viên hành chính.</p>
        </div>
        
        <div className="flex items-center gap-3">
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
            onClick={() => {
              setSelectedTeacher(null);
              setFormMode('create');
              setIsFormOpen(true);
            }}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Thêm nhân sự mới
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface-container-lowest p-5 rounded-[32px] border border-outline-variant/30 shadow-sm flex flex-wrap gap-4 items-end mb-8">
        {/* Search Input */}
        <div className="flex flex-col gap-2 w-full md:w-64">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Tìm kiếm</label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo họ tên, email..." 
              className="w-full pl-10 pr-4 py-2.5 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Role Filter */}
        <div className="flex flex-col gap-2 w-44">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Chức vụ</label>
          <select 
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">Tất cả chức vụ</option>
            <option value="teacher">Giáo viên</option>
            <option value="admin">Ban giám hiệu / Quản trị</option>
            <option value="staff">Nhân viên / Kế toán</option>
          </select>
        </div>

        {/* Class Filter */}
        <div className="flex flex-col gap-2 w-44">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Lớp phụ trách</label>
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">Tất cả lớp</option>
            {classesList.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex flex-col gap-2 w-40">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Trạng thái</label>
          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang làm việc</option>
            <option value="inactive">Đã nghỉ việc / Nghỉ phép</option>
          </select>
        </div>

        <button 
          onClick={handleResetFilters}
          className="px-5 py-2.5 text-primary text-[14px] font-semibold hover:bg-surface-container-low rounded-xl transition-colors cursor-pointer ml-auto"
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
          <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 p-6 shadow-sm">
            <Table columns={tableColumns} data={[]} loading={true} />
          </div>
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
                  <div key={teacher.id} className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 p-6 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between overflow-hidden">
                    {/* Hover actions */}
                    <div className="absolute top-4 right-4 flex gap-1 bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm p-1 rounded-xl border border-outline-variant/30 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10 select-none">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeacher(teacher);
                          setFormMode('edit');
                          setIsFormOpen(true);
                        }}
                        className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTeacher(teacher);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-1.5 text-error hover:bg-error/5 rounded-lg transition-colors cursor-pointer"
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
                        
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border",
                          teacher.is_active 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        )}>
                          {teacher.is_active ? 'Đang làm' : 'Đã nghỉ'}
                        </span>
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
                                <a href={`tel:${teacher.phone}`} className="text-[14px] font-semibold text-primary hover:underline select-all">
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
            <div className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 p-6 shadow-sm overflow-hidden">
              <Table 
                columns={tableColumns} 
                data={teachersData} 
                rowKey={(row) => row.id}
                emptyTitle="Không tìm thấy nhân sự"
                emptyDescription="Không có nhân sự nào khớp với bộ lọc."
              />
            </div>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteTeacher}
        title="Xóa nhân sự"
        message={`Bạn có chắc chắn muốn xóa nhân sự ${selectedTeacher?.full_name || ''}? Hành động này sẽ chuyển trạng thái của nhân viên thành đã nghỉ việc.`}
        confirmText="Xóa nhân sự"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />

      {/* Form Modal for Creating/Editing Teacher */}
      <TeacherForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        teacher={formMode === 'edit' ? selectedTeacher : null}
        classesList={classesList}
      />
    </div>
  );
}
