import { useState, useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { 
  Plus, 
  Eye, 
  Search,
  Phone,
  User,
  FileSpreadsheet
} from "lucide-react";
import { api } from "../lib/api";
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
import { toast } from "../stores/toastStore";

export function Students() {
  const { openPanel } = useSlidePanel();
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';
  
  // Search & Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [pageSize, setPageSize] = useState(25);

  // Import modal state
  const [isImportOpen, setIsImportOpen] = useState(false);

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
    const el = document.querySelector('.max-h-\\[850px\\]');
    if (el) {
      el.scrollTop = 0;
    }
  }, [debouncedSearch, selectedGrade, selectedClassId, selectedStatus]);

  // 1. Fetch classes list for dropdown filters
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list'],
    queryFn: () => api.getAll('classes', { page: 1, pageSize: 100 }, {}, 'id, name, grade_level')
  });
  const classesList = (classesResponse?.data?.data as any[]) || [];

  // Filter classes based on selected grade
  const filteredClassesList = selectedGrade === "all" 
    ? classesList 
    : classesList.filter((c: any) => c.grade_level === selectedGrade);

  // 2. Fetch students list based on search, filters and page size
  const { data: studentsResponse, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['students-list', debouncedSearch, selectedGrade, selectedClassId, selectedStatus, pageSize],
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
        { page: 1, pageSize, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, classes(name, grade_level), guardians(*)'
      );
    },
    placeholderData: keepPreviousData
  });

  const studentsData = studentsResponse?.data?.data || [];
  const totalCount = studentsResponse?.data?.count || 0;

  const isFetchingMore = isFetching && studentsData.length < totalCount && pageSize > 25;
  const isRefetchingNewFilter = isFetching && !isFetchingMore;

  // Reset filters helper
  const handleResetFilters = () => {
    setSearch("");
    setSelectedGrade("all");
    setSelectedClassId("all");
    setSelectedStatus("active");
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
      const filters: Record<string, any> = {};
      if (selectedStatus !== "all") {
        filters.status = selectedStatus;
      }
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      } else if (selectedGrade !== "all") {
        const classIdsInGrade = classesList
          .filter((c: any) => c.grade_level === selectedGrade)
          .map((c: any) => c.id);
          
        if (classIdsInGrade.length > 0) {
          filters.class_id = `in.(${classIdsInGrade.join(',')})`;
        } else {
          toast.error("Không có dữ liệu học sinh để xuất");
          return;
        }
      }

      const res = await api.getAll(
        'students',
        { page: 1, pageSize: 10000, sortBy: 'full_name', sortOrder: 'asc' },
        {
          search: debouncedSearch || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, classes(name), guardians(*)'
      );

      const exportData = (res.data?.data || []).map((row: any) => {
        const father = row.guardians?.find((g: any) => g.relationship === 'cha');
        const mother = row.guardians?.find((g: any) => g.relationship === 'me');
        const primaryGuardian = row.guardians?.find((g: any) => g.is_primary) || row.guardians?.[0];

        return {
          student_code: row.student_code,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString('vi-VN') : '',
          gender: row.gender === 'female' ? 'Nữ' : 'Nam',
          address: row.address || '',
          enrollment_date: row.enrollment_date ? new Date(row.enrollment_date).toLocaleDateString('vi-VN') : '',
          class_name: row.classes?.name || 'Chưa xếp lớp',
          father_name: father?.full_name || '',
          father_phone: father?.phone || '',
          mother_name: mother?.full_name || '',
          mother_phone: mother?.phone || '',
          guardian_name: primaryGuardian?.full_name || '',
          guardian_phone: primaryGuardian?.phone || '',
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
        { key: 'father_name', label: 'Họ tên bố' },
        { key: 'father_phone', label: 'SĐT bố' },
        { key: 'mother_name', label: 'Họ tên mẹ' },
        { key: 'mother_phone', label: 'SĐT mẹ' },
        { key: 'guardian_name', label: 'Phụ huynh chính' },
        { key: 'guardian_phone', label: 'SĐT phụ huynh' },
        { key: 'relationship', label: 'Quan hệ' }
      ];

      exportToExcel(exportData, columns, 'Danh_Sach_Hoc_Sinh', 'Học sinh');
      toast.success("Đã xuất Excel danh sách học sinh!");
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

      const dob = parseExcelDate(rawDob);
      const gender = parseGender(rawGender);
      const enrollDate = parseExcelDate(rawEnrollDate);

      // Tìm kiếm lớp tương ứng
      let classId = null;
      if (className) {
        const foundClass = classesList.find((c: any) => c.name.toLowerCase().trim() === className.toLowerCase().trim());
        if (foundClass) {
          classId = foundClass.id;
        }
      }

      // Phụ huynh
      const fatherName = row['Họ tên bố'];
      const fatherPhone = row['SĐT bố'] || row['Số điện thoại bố'];
      const motherName = row['Họ tên mẹ'];
      const motherPhone = row['SĐT mẹ'] || row['Số điện thoại mẹ'];

      const randNum = Math.floor(1000 + Math.random() * 9000);
      const studentCode = row['Mã học sinh'] || `HS${randNum}`;

      try {
        const studentId = crypto.randomUUID();

        // 1. Tạo học sinh
        const studentPayload = {
          id: studentId,
          school_id: schoolId,
          class_id: classId,
          student_code: studentCode,
          full_name: fullName.trim(),
          date_of_birth: dob,
          gender: gender,
          address: address ? address.trim() : null,
          enrollment_date: enrollDate,
          status: 'active' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const studentRes = await api.create('students', studentPayload);
        if (studentRes.error) throw new Error(studentRes.error);

        // 2. Tạo phụ huynh
        const guardiansPayload: any[] = [];
        
        if (motherName && motherPhone) {
          guardiansPayload.push({
            id: crypto.randomUUID(),
            student_id: studentId,
            full_name: motherName.trim(),
            relationship: 'me',
            phone: String(motherPhone).trim(),
            is_primary: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        if (fatherName && fatherPhone) {
          guardiansPayload.push({
            id: crypto.randomUUID(),
            student_id: studentId,
            full_name: fatherName.trim(),
            relationship: 'cha',
            phone: String(fatherPhone).trim(),
            is_primary: guardiansPayload.length === 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        if (guardiansPayload.length > 0) {
          const guardianRes = await api.createMany('guardians', guardiansPayload);
          if (guardianRes.error) {
            console.error("Lỗi khi thêm phụ huynh:", guardianRes.error);
          }
        }

        successCount++;
      } catch (err: any) {
        console.error(err);
        errorCount++;
        errors.push(`Dòng ${lineNum} (${fullName}): ${err.message || 'Lỗi hệ thống'}`);
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

  // Define Table Columns
  const tableColumns: TableColumn<any>[] = [
    {
      key: "stt",
      header: "STT",
      width: "60px",
      align: "center",
      render: (_row: any, index: number) => (
        <span className="text-on-surface-variant font-semibold text-[13px]">
          {index + 1}
        </span>
      )
    },
    {
      key: "full_name",
      header: "Học sinh",
      sortable: true,
      render: (row: any) => (
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
            <div className="text-[12px] text-on-surface-variant font-medium">{row.student_code}</div>
          </div>
        </div>
      )
    },
    {
      key: "classes",
      header: "Lớp",
      render: (row: any) => (
        <span className={row.classes?.name ? "font-semibold text-on-surface" : "text-on-surface-variant font-medium italic"}>
          {row.classes?.name || "Chưa xếp lớp"}
        </span>
      )
    },
    {
      key: "parent",
      header: "Phụ huynh chính",
      render: (row: any) => {
        const primaryGuardian = row.guardians?.find((g: any) => g.is_primary) || row.guardians?.[0];
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
      key: "status",
      header: "Trạng thái",
      render: (row: any) => getStatusBadge(row.status)
    }
  ];

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
            <h2 className="text-[24px] md:text-[30px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Danh sách học sinh</h2>
            <span className="text-[12px] font-extrabold text-primary bg-primary-container/20 px-3 py-1 rounded-xl">
              Tổng số: {totalCount} học sinh
            </span>
          </div>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">Quản lý và theo dõi thông tin chi tiết của tất cả học sinh tại trường mầm non.</p>
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
          <button 
            onClick={handleCreateStudent}
            className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[14px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow-md cursor-pointer duration-200"
          >
            <Plus className="w-5 h-5" />
            Thêm học sinh mới
          </button>
        </div>
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

        {/* Grade Filter */}
        <select 
          value={selectedGrade}
          onChange={(e) => {
            setSelectedGrade(e.target.value);
            setSelectedClassId("all");
          }}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
        >
          <option value="all">Tất cả khối</option>
          <option value="nha_tre">Nhà trẻ (24-36th)</option>
          <option value="mam">Khối Mầm (3-4t)</option>
          <option value="choi">Khối Chồi (4-5t)</option>
          <option value="la">Khối Lá (5-6t)</option>
        </select>

        {/* Class Filter */}
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

        {/* Status Filter */}
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang học</option>
          <option value="suspended">Tạm nghỉ</option>
          <option value="graduated">Đã tốt nghiệp</option>
          <option value="transferred">Đã chuyển trường</option>
        </select>

        <button 
          onClick={handleResetFilters}
          className="px-4 py-2 text-primary text-[14px] font-bold hover:bg-primary/5 rounded-xl transition-all cursor-pointer ml-auto"
        >
          Xóa bộ lọc
        </button>
      </div>

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
