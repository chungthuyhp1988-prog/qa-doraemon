import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Eye, 
  BadgeIcon as IdCard, 
  MapPin, 
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  User,
  HeartPulse,
  DollarSign,
  Edit2,
  Trash2
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import type { StudentRow } from "../types";
import { StudentForm } from "../components/forms/StudentForm";
import { ConfirmDialog, Pagination } from "../components/ui";
import { toast } from "../stores/toastStore";

export function Students() {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'journal' | 'finance'>('profile');
  
  // Dialog/Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [page, setPage] = useState(1);
  const pageSize = 12;

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
  }, [selectedGrade, selectedClassId, selectedStatus]);

  // 1. Fetch classes list for dropdown filters
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.getAll('classes', { page: 1, pageSize: 100 }, {}, 'id, name, grade_level')
  });
  const classesList = classesResponse?.data?.data || [];

  // Filter classes based on selected grade
  const filteredClassesList = selectedGrade === "all" 
    ? classesList 
    : classesList.filter((c: any) => c.grade_level === selectedGrade);

  // 2. Fetch students list based on search, filters and page
  const { data: studentsResponse, isLoading, isError } = useQuery({
    queryKey: ['students-list', debouncedSearch, selectedGrade, selectedClassId, selectedStatus, page],
    queryFn: async () => {
      const filters: Record<string, any> = {};
      
      // Filter by status if specified
      if (selectedStatus !== "all") {
        filters.status = selectedStatus;
      }
      
      // Filter by specific class if selected
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      } else if (selectedGrade !== "all") {
        // If no specific class is selected, filter by all class IDs belonging to the selected grade level
        const classIdsInGrade = classesList
          .filter((c: any) => c.grade_level === selectedGrade)
          .map((c: any) => c.id);
          
        if (classIdsInGrade.length > 0) {
          // PostgREST "in" filter format
          filters.class_id = `in.(${classIdsInGrade.join(',')})`;
        } else {
          // If no classes match, return empty results
          return { data: { data: [], count: 0 }, error: null, count: 0 };
        }
      }

      return api.getAll(
        'students',
        { page, pageSize, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, classes(name, grade_level), guardians(*)'
      );
    }
  });

  const studentsData = studentsResponse?.data?.data || [];
  const totalCount = studentsResponse?.data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Automatically select the first student in the list if none is selected
  useEffect(() => {
    if (studentsData.length > 0 && !selectedStudentId) {
      setSelectedStudentId(studentsData[0].id);
    }
  }, [studentsData, selectedStudentId]);

  // 3. Fetch details for the selected student
  const selectedStudent = studentsData.find(s => s.id === selectedStudentId);

  // 4. Fetch tuition fees for the selected student's finance tab
  const { data: feesResponse, isLoading: isLoadingFees } = useQuery({
    queryKey: ['tuition_fees', selectedStudentId],
    queryFn: () => api.getAll(
      'tuition_fees', 
      { page: 1, pageSize: 12 }, 
      { filters: { student_id: selectedStudentId } },
      '*, academic_years(name)'
    ),
    enabled: !!selectedStudentId && activeTab === 'finance'
  });
  const feesList = feesResponse?.data?.data || [];

  // Reset filters helper
  const handleResetFilters = () => {
    setSearch("");
    setSelectedGrade("all");
    setSelectedClassId("all");
    setSelectedStatus("active");
    setPage(1);
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

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
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

  // Map status to badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-[12px] bg-green-50 text-green-700 border border-green-200 font-medium tracking-wide">Đang học</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-[12px] bg-amber-50 text-amber-700 border border-amber-200 font-medium tracking-wide">Tạm nghỉ</span>;
      case 'graduated':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-[12px] bg-blue-50 text-blue-700 border border-blue-200 font-medium tracking-wide">Tốt nghiệp</span>;
      case 'transferred':
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-[12px] bg-gray-50 text-gray-600 border border-gray-200 font-medium tracking-wide">Chuyển trường</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-md text-[12px] bg-gray-50 text-gray-600 border border-gray-200 font-medium tracking-wide">{status}</span>;
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudentId) return;
    setIsDeleting(true);
    try {
      const res = await api.softDelete('students', selectedStudentId);
      if (res.error) throw new Error(res.error);
      toast.success('Xóa học sinh thành công!');
      setSelectedStudentId(null);
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xóa học sinh', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[32px] md:text-[40px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Danh sách học sinh</h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">Quản lý và theo dõi thông tin chi tiết của tất cả học sinh tại trường.</p>
        </div>
        <button 
          onClick={() => { setFormMode('create'); setIsFormOpen(true); }}
          className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Thêm học sinh mới
        </button>
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
              placeholder="Nhập tên học sinh hoặc mã số..." 
              className="w-full pl-10 pr-4 py-2.5 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Grade (Khối) Filter */}
        <div className="flex flex-col gap-2 w-44">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Khối</label>
          <select 
            value={selectedGrade}
            onChange={(e) => {
              setSelectedGrade(e.target.value);
              setSelectedClassId("all"); // Reset class filter when grade changes
            }}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">Tất cả các khối</option>
            <option value="nha_tre">Nhà trẻ (24-36th)</option>
            <option value="mam">Khối Mầm (3-4t)</option>
            <option value="choi">Khối Chồi (4-5t)</option>
            <option value="la">Khối Lá (5-6t)</option>
          </select>
        </div>

        {/* Class (Lớp) Filter */}
        <div className="flex flex-col gap-2 w-44">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Lớp</label>
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          >
            <option value="all">Tất cả các lớp</option>
            {filteredClassesList.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} ({getGradeName(c.grade_level)})</option>
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
            <option value="active">Đang học</option>
            <option value="suspended">Tạm nghỉ</option>
            <option value="graduated">Đã tốt nghiệp</option>
            <option value="transferred">Đã chuyển trường</option>
          </select>
        </div>

        <button 
          onClick={handleResetFilters}
          className="px-5 py-2.5 text-primary text-[14px] font-semibold hover:bg-surface-container-low rounded-xl transition-colors cursor-pointer ml-auto"
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* Bento Layout Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Student List & Pagination */}
        <div className="xl:col-span-2 bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col min-h-[500px] h-[750px]">
          
          {/* List Header */}
          <div className="p-6 border-b border-outline-variant/50 flex justify-between items-center z-10 bg-white">
            <h3 className="text-[20px] font-bold italic font-playfair text-on-surface">Danh sách chi tiết</h3>
            <div className="text-[12px] font-bold text-primary bg-primary-container/20 px-3 py-1.5 rounded-xl">
              Tổng số: {totalCount} học sinh
            </div>
          </div>
          
          {/* Main List Area */}
          <div className="overflow-y-auto flex-1 bg-white">
            {isLoading ? (
              // Loading Skeleton
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
              // Error State
              <div className="p-16 text-center text-error space-y-3">
                <AlertTriangle className="w-12 h-12 mx-auto" />
                <h4 className="font-bold text-lg">Đã xảy ra lỗi khi tải dữ liệu</h4>
                <p className="text-sm text-on-surface-variant">Vui lòng kiểm tra lại kết nối Supabase và thử lại.</p>
              </div>
            ) : studentsData.length === 0 ? (
              // Empty State
              <div className="py-24 text-center space-y-4">
                <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
                  <User className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-lg text-on-surface">Không tìm thấy học sinh nào</h4>
                <p className="text-sm text-on-surface-variant max-w-sm mx-auto">Không tìm thấy bản ghi nào trùng khớp với bộ lọc hoặc tìm kiếm hiện tại.</p>
              </div>
            ) : (
              // Table List
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-container-low text-on-surface-variant z-10 border-b border-outline-variant/30">
                  <tr>
                    <th className="px-6 py-3 text-[13px] font-bold uppercase tracking-wider">Học sinh</th>
                    <th className="px-6 py-3 text-[13px] font-bold uppercase tracking-wider">Lớp</th>
                    <th className="px-6 py-3 text-[13px] font-bold uppercase tracking-wider">Phụ huynh chính</th>
                    <th className="px-6 py-3 text-[13px] font-bold uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-3 text-[13px] font-bold uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] divide-y divide-outline-variant/20">
                  {studentsData.map((student: any) => {
                    // Extract primary guardian
                    const primaryGuardian = student.guardians?.find((g: any) => g.is_primary) || student.guardians?.[0];
                    const parentName = primaryGuardian 
                      ? `${primaryGuardian.full_name} (${primaryGuardian.relationship === 'me' ? 'Mẹ' : primaryGuardian.relationship === 'cha' ? 'Bố' : 'PH'})` 
                      : '—';
                    const parentPhone = primaryGuardian ? primaryGuardian.phone : '—';
                    
                    return (
                      <tr 
                        key={student.id}
                        onClick={() => setSelectedStudentId(student.id)}
                        className={cn(
                          "cursor-pointer hover:bg-surface-container-low/30 transition-colors border-l-4",
                          selectedStudentId === student.id 
                            ? "bg-surface-container-low/50 border-l-primary font-medium" 
                            : "border-l-transparent"
                        )}
                      >
                        <td className="px-6 py-3.5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-[14px] font-bold text-primary border border-primary/20 shrink-0">
                            {student.profile_image_url ? (
                              <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full object-cover" />
                            ) : (
                              student.full_name.substring(0, 1)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-on-surface truncate">{student.full_name}</div>
                            <div className="text-[12px] text-on-surface-variant font-medium">{student.student_code}</div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-on-surface-variant font-medium">
                          {student.classes?.name || 'Chưa xếp lớp'}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="text-on-surface font-medium">{parentName}</div>
                          <div className="text-[12px] text-on-surface-variant font-medium flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {parentPhone}
                          </div>
                        </td>
                        <td className="px-6 py-3.5">
                          {getStatusBadge(student.status)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentId(student.id);
                            }}
                            className="text-primary hover:bg-primary-container/30 p-2 rounded-xl transition-colors cursor-pointer"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="px-6 py-2 border-t border-outline-variant/50 bg-white rounded-b-[32px]">
              <Pagination
                currentPage={page}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>

        {/* Right Column: Detail Panel */}
        <div className="xl:col-span-1 bg-surface-container-lowest rounded-[32px] border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col h-[750px] sticky top-[96px]">
          
          {selectedStudent ? (
            <>
              {/* Detail Header */}
              <div className="p-6 pb-6 border-b border-outline-variant/50 bg-[#fffaf4]">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="w-16 h-16 bg-primary/10 rounded-full overflow-hidden border-2 border-primary/40 p-0.5 shadow-sm shrink-0">
                      <div className="w-full h-full rounded-full overflow-hidden bg-primary/20 flex items-center justify-center text-[22px] font-bold text-primary">
                        {selectedStudent.profile_image_url ? (
                          <img src={selectedStudent.profile_image_url} alt={selectedStudent.full_name} className="w-full h-full object-cover" />
                        ) : (
                          selectedStudent.full_name.substring(0, 1)
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 select-none">
                      {getStatusBadge(selectedStudent.status)}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setFormMode('edit');
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 bg-surface-container border border-outline-variant hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface rounded-xl transition-all cursor-pointer"
                          title="Sửa thông tin"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setIsDeleteDialogOpen(true)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl transition-all cursor-pointer"
                          title="Xóa học sinh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[22px] font-bold italic font-playfair text-on-surface leading-tight">
                      {selectedStudent.full_name}
                    </h3>
                    <div className="text-[13px] text-on-surface-variant flex items-center gap-2 mt-1.5 font-semibold">
                      <IdCard className="w-4 h-4 text-primary" /> Mã số: {selectedStudent.student_code}
                    </div>
                    <div className="text-[13px] text-on-surface-variant flex items-center gap-2 mt-1 font-semibold">
                      <MapPin className="w-4 h-4 text-primary" /> Lớp: {selectedStudent.classes?.name || 'Chưa xếp lớp'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex px-4 border-b border-outline-variant/30 bg-surface-container-lowest">
                {[
                  { id: 'profile', label: 'Hồ sơ', icon: User },
                  { id: 'journal', label: 'Y tế', icon: HeartPulse },
                  { id: 'finance', label: 'Tài chính', icon: DollarSign }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-3 text-[14px] font-bold border-b-2 transition-colors cursor-pointer",
                      activeTab === tab.id 
                        ? "border-b-primary text-primary" 
                        : "border-b-transparent text-on-surface-variant hover:bg-surface-container-low"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Scroll Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                
                {/* ── PROFILE TAB ── */}
                {activeTab === 'profile' && (
                  <div className="flex flex-col gap-5 px-1 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-2">Thông tin trẻ</h4>
                      <div className="grid grid-cols-2 gap-4 text-[13.5px]">
                        <div>
                          <div className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-0.5">Ngày sinh</div>
                          <div className="text-on-surface font-semibold">{formatDate(selectedStudent.date_of_birth)}</div>
                        </div>
                        <div>
                          <div className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-0.5">Giới tính</div>
                          <div className="text-on-surface font-semibold">{selectedStudent.gender === 'male' ? 'Nam' : 'Nữ'}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-0.5">Địa chỉ liên hệ</div>
                          <div className="text-on-surface font-semibold leading-relaxed">{selectedStudent.address || 'Hà Tĩnh'}</div>
                        </div>
                        <div>
                          <div className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-0.5">Ngày nhập học</div>
                          <div className="text-on-surface font-semibold">{formatDate(selectedStudent.enrollment_date)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <hr className="border-outline-variant/20" />
                    
                    <div>
                      <h4 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-2.5">Gia đình phụ huynh</h4>
                      <div className="space-y-3.5">
                        {selectedStudent.guardians?.map((guardian: any) => (
                          <div key={guardian.id} className="bg-surface-container-low/40 border border-outline-variant/30 p-3.5 rounded-2xl flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-on-surface text-[14px]">
                                {guardian.full_name}
                              </span>
                              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md uppercase tracking-wider">
                                {guardian.relationship === 'me' ? 'Mẹ' : guardian.relationship === 'cha' ? 'Bố' : guardian.relationship === 'ong' ? 'Ông' : guardian.relationship === 'ba' ? 'Bà' : 'Người giám hộ'}
                              </span>
                            </div>
                            <div className="text-[13px] text-on-surface-variant font-medium flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                              SĐT: {guardian.phone}
                            </div>
                            {guardian.occupation && (
                              <div className="text-[12px] text-on-surface-variant/70 font-medium pl-5">
                                Nghề nghiệp: {guardian.occupation}
                              </div>
                            )}
                          </div>
                        ))}
                        {(!selectedStudent.guardians || selectedStudent.guardians.length === 0) && (
                          <p className="text-xs text-on-surface-variant/70 italic">Chưa cập nhật thông tin phụ huynh.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* ── HEALTH TAB (Y tế) ── */}
                {activeTab === 'journal' && (
                  <div className="flex flex-col gap-5 px-1 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-[13px] font-bold text-red-600 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Lưu ý sức khỏe
                      </h4>
                      <div className="bg-red-50/50 border border-red-200 p-4 rounded-2xl flex flex-col gap-3">
                        <div className="flex justify-between items-center text-[13.5px]">
                          <span className="text-on-surface-variant font-bold">Dị ứng thức ăn:</span>
                          <span className={cn(
                            "font-bold px-2 py-0.5 rounded text-[12px]",
                            selectedStudent.allergies 
                              ? "bg-red-100 text-red-700 border border-red-200" 
                              : "bg-green-100 text-green-700 border border-green-200"
                          )}>
                            {selectedStudent.allergies || 'Không dị ứng'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 text-[13.5px]">
                          <span className="text-on-surface-variant font-bold">Ghi chú y tế của trẻ:</span>
                          <span className="font-semibold text-on-surface mt-0.5 leading-relaxed bg-white border border-outline-variant/30 p-2.5 rounded-xl">
                            {selectedStudent.medical_notes || 'Sức khỏe bình thường, không có bệnh nền.'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <hr className="border-outline-variant/20" />

                    {/* Basic growth specs */}
                    <div>
                      <h4 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-2.5">Số đo chiều cao & cân nặng</h4>
                      <p className="text-xs text-on-surface-variant font-semibold leading-relaxed bg-surface-container-low/40 p-3.5 border border-outline-variant/30 rounded-2xl">
                        Chiều cao, cân nặng định kỳ được cập nhật trong module **Sức Khỏe**. 
                        Nhấn vào nút dưới đây để chuyển hướng xem biểu đồ tăng trưởng của bé.
                      </p>
                      <button className="w-full mt-3 bg-surface-container border border-outline-variant hover:bg-surface-container-high text-on-surface text-[13px] font-semibold py-2.5 rounded-xl transition-all cursor-pointer">
                        Xem chi tiết lịch sử sức khỏe
                      </button>
                    </div>
                  </div>
                )}

                {/* ── FINANCE TAB (Tài chính) ── */}
                {activeTab === 'finance' && (
                  <div className="flex flex-col gap-5 px-1 animate-in fade-in duration-200">
                    <h4 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-2">Học phí & các khoản thu</h4>
                    
                    {isLoadingFees ? (
                      <div className="space-y-3 animate-pulse">
                        <div className="h-10 bg-surface-variant/30 rounded-xl" />
                        <div className="h-10 bg-surface-variant/30 rounded-xl" />
                      </div>
                    ) : feesList.length === 0 ? (
                      <div className="py-8 text-center border border-dashed border-outline-variant/60 rounded-2xl text-on-surface-variant space-y-2">
                        <DollarSign className="w-8 h-8 mx-auto text-on-surface-variant/40" />
                        <p className="text-[13px] font-semibold">Chưa có thông tin học phí</p>
                        <p className="text-[11px] text-on-surface-variant/70 px-4">Bản ghi thu phí cho trẻ sẽ được tạo khi đến kỳ đóng học phí.</p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {feesList.map((fee: any) => {
                          const isPaid = fee.status === 'paid';
                          const isPartial = fee.status === 'partial';
                          const isOverdue = fee.status === 'overdue';
                          
                          return (
                            <div 
                              key={fee.id} 
                              className={cn(
                                "border p-4 rounded-2xl flex flex-col gap-2 transition-all",
                                isPaid ? "bg-green-50/20 border-green-200" : isOverdue ? "bg-red-50/20 border-red-200" : "bg-surface-container-low/40 border-outline-variant/30"
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-[14px] text-on-surface">
                                    Học phí Tháng {fee.month}/{fee.year}
                                  </span>
                                  <div className="text-[11px] text-on-surface-variant/80 font-bold mt-0.5">
                                    Năm học: {fee.academic_years?.name}
                                  </div>
                                </div>
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border",
                                  isPaid ? "bg-green-100 text-green-700 border-green-200" 
                                    : isPartial ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : isOverdue ? "bg-red-100 text-red-700 border-red-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                )}>
                                  {isPaid ? 'Đã đóng' : isPartial ? 'Một phần' : isOverdue ? 'Quá hạn' : 'Chưa đóng'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[12.5px] mt-1 text-on-surface-variant font-medium">
                                <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                                  <span>Học phí cơ bản:</span>
                                  <span className="font-bold text-on-surface">{(fee.base_amount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                                  <span>Tiền ăn:</span>
                                  <span className="font-bold text-on-surface">{(fee.meal_amount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                                  <span>Dịch vụ thêm:</span>
                                  <span className="font-bold text-on-surface">{(fee.extra_amount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="flex justify-between border-b border-outline-variant/10 pb-1">
                                  <span>Miễn giảm:</span>
                                  <span className="font-bold text-on-surface">-{(fee.discount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div className="col-span-2 flex justify-between pt-1 text-[13.5px] font-bold text-on-surface">
                                  <span className="text-primary font-bold">Tổng số tiền:</span>
                                  <span className="text-primary font-bold">{(fee.total_amount || 0).toLocaleString('vi-VN')}đ</span>
                                </div>
                                {fee.paid_amount > 0 && (
                                  <div className="col-span-2 flex justify-between text-[12.5px] font-semibold text-green-700">
                                    <span>Đã đóng:</span>
                                    <span>{fee.paid_amount.toLocaleString('vi-VN')}đ</span>
                                  </div>
                                )}
                              </div>
                              {fee.note && (
                                <p className="text-[11px] text-on-surface-variant/80 italic mt-1 font-medium bg-white/50 p-2 rounded-lg border border-outline-variant/10">
                                  Ghi chú: {fee.note}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="m-auto text-center p-8 space-y-3">
              <User className="w-12 h-12 mx-auto text-on-surface-variant/40" />
              <h4 className="font-bold text-on-surface">Chưa chọn học sinh</h4>
              <p className="text-xs text-on-surface-variant">Chọn một học sinh từ danh sách để xem thông tin chi tiết.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals & Dialogs */}
      {isFormOpen && (
        <StudentForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          student={formMode === 'edit' ? selectedStudent : undefined}
          classesList={classesList}
        />
      )}

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteStudent}
        title="Xóa hồ sơ học sinh"
        message={`Bạn có chắc chắn muốn xóa học sinh ${selectedStudent?.full_name}? Dữ liệu sẽ được đánh dấu ẩn khỏi hệ thống.`}
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
}
