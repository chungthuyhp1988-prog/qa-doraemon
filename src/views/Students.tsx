import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, 
  Eye, 
  Search,
  Phone,
  User
} from "lucide-react";
import { api } from "../lib/api";
import { StudentForm } from "../components/forms/StudentForm";
import { StudentDetailPanel } from "../components/details/StudentDetailPanel";
import { Pagination, useSlidePanel } from "../components/ui";
import { cn } from "../lib/utils";

export function Students() {
  const { openPanel } = useSlidePanel();
  
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
  const { data: studentsResponse, isLoading, isError, refetch } = useQuery({
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
          filters.class_id = `in.(${classIdsInGrade.join(',')})`;
        } else {
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

  // Map status to badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] bg-green-50 text-green-700 border border-green-200 font-semibold tracking-wide">Đang học</span>;
      case 'suspended':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] bg-amber-50 text-amber-700 border border-amber-200 font-semibold tracking-wide">Tạm nghỉ</span>;
      case 'graduated':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold tracking-wide">Tốt nghiệp</span>;
      case 'transferred':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] bg-gray-50 text-gray-600 border border-gray-200 font-semibold tracking-wide">Chuyển trường</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] bg-gray-50 text-gray-600 border border-gray-200 font-semibold tracking-wide">{status}</span>;
    }
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

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[32px] md:text-[40px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Danh sách học sinh</h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">Quản lý và theo dõi thông tin chi tiết của tất cả học sinh tại trường mầm non.</p>
        </div>
        <button 
          onClick={handleCreateStudent}
          className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow-md cursor-pointer duration-200"
        >
          <Plus className="w-5 h-5" />
          Thêm học sinh mới
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-surface p-5 rounded-[32px] border border-outline-variant/30 shadow-xs flex flex-wrap gap-4 items-end">
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

        {/* Grade Filter */}
        <div className="flex flex-col gap-2 w-44">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Khối</label>
          <select 
            value={selectedGrade}
            onChange={(e) => {
              setSelectedGrade(e.target.value);
              setSelectedClassId("all");
            }}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            <option value="all">Tất cả các khối</option>
            <option value="nha_tre">Nhà trẻ (24-36th)</option>
            <option value="mam">Khối Mầm (3-4t)</option>
            <option value="choi">Khối Chồi (4-5t)</option>
            <option value="la">Khối Lá (5-6t)</option>
          </select>
        </div>

        {/* Class Filter */}
        <div className="flex flex-col gap-2 w-44">
          <label className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">Lớp</label>
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
            className="border border-outline-variant/50 rounded-xl px-4 py-2.5 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer"
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
          className="px-5 py-2.5 text-primary text-[14px] font-bold hover:bg-primary/5 rounded-xl transition-all cursor-pointer ml-auto"
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* Main Student List — Full Width Layout */}
      <div className="bg-surface rounded-[32px] border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col min-h-[500px]">
        {/* List Header */}
        <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-white">
          <h3 className="text-[20px] font-bold italic font-playfair text-on-surface">Danh sách chi tiết</h3>
          <div className="text-[12px] font-extrabold text-primary bg-primary-container/20 px-3 py-1.5 rounded-xl">
            Tổng số: {totalCount} học sinh
          </div>
        </div>
        
        {/* Main Table Area */}
        <div className="overflow-x-auto bg-white flex-1">
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
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30">
                <tr>
                  <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider">Học sinh</th>
                  <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider">Lớp</th>
                  <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider">Phụ huynh chính</th>
                  <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="text-[14.5px] divide-y divide-outline-variant/15">
                {studentsData.map((student: any) => {
                  const primaryGuardian = student.guardians?.find((g: any) => g.is_primary) || student.guardians?.[0];
                  const parentName = primaryGuardian 
                    ? `${primaryGuardian.full_name} (${primaryGuardian.relationship === 'me' ? 'Mẹ' : primaryGuardian.relationship === 'cha' ? 'Bố' : 'PH'})` 
                    : '—';
                  const parentPhone = primaryGuardian ? primaryGuardian.phone : '—';
                  
                  return (
                    <tr 
                      key={student.id}
                      onClick={() => handleOpenDetail(student.id)}
                      className="cursor-pointer hover:bg-surface-container-low/20 transition-colors"
                    >
                      <td className="px-6 py-3 flex items-center gap-3">
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
                      <td className="px-6 py-3 text-on-surface font-semibold">
                        {student.classes?.name || <span className="text-on-surface-variant font-medium italic">Chưa xếp lớp</span>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-on-surface font-semibold">{parentName}</div>
                        <div className="text-[12px] text-on-surface-variant font-medium flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-primary" /> {parentPhone}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {getStatusBadge(student.status)}
                      </td>
                      <td className="px-6 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleOpenDetail(student.id)}
                          className="text-primary hover:bg-primary-container/30 p-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-[13px] font-bold border border-transparent hover:border-primary/20"
                        >
                          <Eye className="w-4 h-4" /> Xem hồ sơ
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
          <div className="px-6 py-4 border-t border-outline-variant/20 bg-white">
            <Pagination
              currentPage={page}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
