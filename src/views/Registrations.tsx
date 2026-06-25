import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Phone, 
  User, 
  FileSpreadsheet, 
  UserCheck, 
  Calendar,
  X,
  HelpCircle
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { useAuthStore } from "../stores/authStore";
import { 
  Pagination, 
  Table, 
  type TableColumn, 
  Modal, 
  Button, 
  Select,
  ExcelImportModal
} from "../components/ui";
import { exportToExcel, parseExcelDate, parseGender } from "../lib/excelHelper";

export function Registrations() {
  const queryClient = useQueryClient();
  const schoolId = useAuthStore((state) => state.user?.school_id) || '00000000-0000-0000-0000-000000000001';

  // Search & Pagination state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 1. Fetch classes for dropdown selection
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-active-list'],
    queryFn: () => api.getAll('classes', { page: 1, pageSize: 100 }, { filters: { is_active: true } })
  });
  const classesList = (classesResponse?.data?.data as any[]) || [];

  // Convert classes to select options
  const classOptions = classesList.map((c: any) => ({
    value: c.id,
    label: `${c.name} (${c.grade_level === 'nha_tre' ? 'Nhà trẻ' : c.grade_level === 'mam' ? 'Mầm' : c.grade_level === 'choi' ? 'Chồi' : 'Lá'})`
  }));

  // 2. Fetch registrations (students where class_id is null)
  const { data: registrationsResponse, isLoading, isError, refetch } = useQuery({
    queryKey: ['registrations-list', debouncedSearch, page],
    queryFn: () => {
      return api.getAll(
        'students',
        { page, pageSize, sortBy: 'created_at', sortOrder: 'desc' },
        {
          search: debouncedSearch || undefined,
          filters: { class_id: null, status: 'active' }
        },
        '*, guardians(*)'
      );
    }
  });

  const registrationsData = (registrationsResponse?.data?.data as any[]) || [];
  const totalCount = registrationsResponse?.data?.count || 0;

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  };

  // Open assign class modal
  const handleOpenAssign = (student: any) => {
    setSelectedStudent(student);
    setSelectedClassId("");
    setIsAssignOpen(true);
  };

  // Confirm assign class
  const handleAssignSubmit = async () => {
    if (!selectedStudent || !selectedClassId) {
      toast.error("Vui lòng chọn lớp học");
      return;
    }

    try {
      const selectedClass = classesList.find((c: any) => c.id === selectedClassId);
      const res = await api.update('students', selectedStudent.id, {
        class_id: selectedClassId,
        updated_at: new Date().toISOString()
      });

      if (res.error) throw new Error(res.error);

      toast.success(`Đã xếp lớp thành công trẻ ${selectedStudent.full_name} vào lớp ${selectedClass?.name}!`);
      setIsAssignOpen(false);
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['registrations-list'] });
      queryClient.invalidateQueries({ queryKey: ['students-list'] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi xếp lớp: ' + (err.message || 'Lỗi hệ thống'));
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (registrationsData.length === 0) {
      toast.error("Không có học sinh nào để xuất Excel");
      return;
    }

    // Flatten data for export
    const exportData = registrationsData.map((row: any) => {
      const father = row.guardians?.find((g: any) => g.relationship === 'cha');
      const mother = row.guardians?.find((g: any) => g.relationship === 'me');
      const primaryGuardian = row.guardians?.find((g: any) => g.is_primary) || row.guardians?.[0];

      return {
        student_code: row.student_code,
        full_name: row.full_name,
        date_of_birth: formatDate(row.date_of_birth),
        gender: row.gender === 'female' ? 'Nữ' : 'Nam',
        address: row.address || '',
        enrollment_date: formatDate(row.enrollment_date),
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
      { key: 'full_name', label: 'Họ tên học sinh' },
      { key: 'date_of_birth', label: 'Ngày sinh' },
      { key: 'gender', label: 'Giới tính' },
      { key: 'address', label: 'Địa chỉ' },
      { key: 'enrollment_date', label: 'Ngày đăng ký' },
      { key: 'father_name', label: 'Họ tên bố' },
      { key: 'father_phone', label: 'SĐT bố' },
      { key: 'mother_name', label: 'Họ tên mẹ' },
      { key: 'mother_phone', label: 'SĐT mẹ' },
      { key: 'guardian_name', label: 'Phụ huynh chính' },
      { key: 'guardian_phone', label: 'SĐT phụ huynh' },
      { key: 'relationship', label: 'Quan hệ' }
    ];

    exportToExcel(exportData, columns, 'Danh_Sach_Dang_Ky_Tuyen_Sinh', 'Học sinh đăng ký');
    toast.success("Đã xuất Excel danh sách đăng ký tuyển sinh!");
  };

  // Import Excel handler
  const handleImportExcel = async (rows: any[]) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // header is line 1

      const fullName = row['Họ tên'] || row['Họ và tên'] || row['Họ tên học sinh'];
      if (!fullName) {
        errorCount++;
        errors.push(`Dòng ${lineNum}: Thiếu Họ tên học sinh.`);
        continue;
      }

      const rawDob = row['Ngày sinh'];
      const rawGender = row['Giới tính'];
      const rawEnrollDate = row['Ngày nhập học'] || row['Ngày đăng ký'] || new Date().toISOString();
      const address = row['Địa chỉ'];

      const dob = parseExcelDate(rawDob);
      const gender = parseGender(rawGender);
      const enrollDate = parseExcelDate(rawEnrollDate);

      // Phụ huynh thông tin
      const fatherName = row['Họ tên bố'];
      const fatherPhone = row['SĐT bố'] || row['Số điện thoại bố'];
      const motherName = row['Họ tên mẹ'];
      const motherPhone = row['SĐT mẹ'] || row['Số điện thoại mẹ'];

      // Generate temporary code
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const studentCode = row['Mã học sinh'] || `DK${randNum}`;

      try {
        const studentId = crypto.randomUUID();

        // 1. Tạo học sinh mới (chưa xếp lớp: class_id = null)
        const studentPayload = {
          id: studentId,
          school_id: schoolId,
          class_id: null,
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

        // 2. Tạo thông tin phụ huynh
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
            is_primary: guardiansPayload.length === 0, // primary if mother not set
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
    queryClient.invalidateQueries({ queryKey: ['registrations-list'] });
    queryClient.invalidateQueries({ queryKey: ['students-list'] });

    return { successCount, errorCount, errors };
  };

  // Define Table Columns
  const tableColumns: TableColumn<any>[] = [
    {
      key: "full_name",
      header: "Học sinh đăng ký",
      sortable: false,
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center text-[14px] font-bold text-primary border border-primary/20 shrink-0">
            {row.full_name.substring(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-on-surface truncate">{row.full_name}</div>
            <div className="text-[12px] text-on-surface-variant font-medium">{row.student_code}</div>
          </div>
        </div>
      )
    },
    {
      key: "date_of_birth",
      header: "Ngày sinh",
      render: (row: any) => (
        <span className="font-medium text-on-surface">
          {formatDate(row.date_of_birth)}
        </span>
      )
    },
    {
      key: "gender",
      header: "Giới tính",
      render: (row: any) => (
        <span className="font-medium text-on-surface-variant">
          {row.gender === 'female' ? 'Nữ' : 'Nam'}
        </span>
      )
    },
    {
      key: "parent",
      header: "Phụ huynh liên hệ",
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
      key: "enrollment_date",
      header: "Ngày đăng ký",
      render: (row: any) => (
        <div className="text-[13px] font-medium text-on-surface-variant flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          {formatDate(row.enrollment_date)}
        </div>
      )
    },
    {
      key: "actions" as any,
      header: "Thao tác",
      render: (row: any) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenAssign(row);
          }}
          className="inline-flex items-center justify-center gap-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all cursor-pointer"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Xếp lớp
        </button>
      )
    }
  ];

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">
            Đăng ký tuyển sinh
          </h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1">
            Quản lý hồ sơ học sinh mới đăng ký và thực hiện xếp lớp học chính thức.
          </p>
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
            className="bg-primary text-on-primary px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nhập Excel đăng ký
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-surface p-5 rounded-[32px] border border-outline-variant/30 shadow-xs flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên trẻ hoặc mã số tuyển sinh..." 
            className="w-full pl-10 pr-4 py-2.5 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        {search && (
          <button 
            onClick={() => setSearch("")}
            className="px-4 py-2 text-[13px] font-semibold text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            Xóa tìm kiếm
          </button>
        )}
      </div>

      {/* Main Registrations Area */}
      <div className="bg-surface rounded-[32px] border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col min-h-[450px]">
        {/* Table Header */}
        <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-white">
          <h3 className="text-[20px] font-bold italic font-playfair text-on-surface">Hồ sơ chờ xếp lớp</h3>
          <div className="text-[12px] font-extrabold text-primary bg-primary-container/20 px-3 py-1.5 rounded-xl">
            Tổng số: {totalCount} học sinh chờ duyệt
          </div>
        </div>

        {/* Table Content */}
        <div className="bg-white flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 bg-surface-variant/40 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-variant/40 rounded w-1/3" />
                    <div className="h-3 bg-surface-variant/40 rounded w-1/4" />
                  </div>
                  <div className="w-28 h-4 bg-surface-variant/40 rounded" />
                  <div className="w-16 h-8 bg-surface-variant/40 rounded" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-16 text-center text-error space-y-2">
              <h4 className="font-bold text-lg">Đã xảy ra lỗi khi tải dữ liệu</h4>
              <p className="text-sm text-on-surface-variant">Vui lòng kiểm tra lại kết nối Supabase.</p>
            </div>
          ) : registrationsData.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
                <User className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-lg text-on-surface">Không có hồ sơ chờ xếp lớp nào</h4>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                Hiện tại tất cả học sinh đã được phân lớp hoặc chưa có hồ sơ đăng ký mới nào được tạo.
              </p>
            </div>
          ) : (
            <Table
              className="rounded-none border-0 bg-transparent"
              columns={tableColumns}
              data={registrationsData}
              rowKey={(row) => row.id}
            />
          )}
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="px-6 py-4 border-t border-outline-variant/20 bg-white shrink-0">
            <Pagination
              currentPage={page}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* Modal Xếp lớp */}
      <Modal
        open={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title="Xếp lớp học chính thức"
        size="sm"
      >
        <div className="space-y-4 py-2">
          {selectedStudent && (
            <div className="bg-primary-container/10 border border-primary/10 rounded-2xl p-4 space-y-1">
              <div className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant">Học sinh xếp lớp:</div>
              <div className="text-[15px] font-bold text-primary">{selectedStudent.full_name}</div>
              <div className="text-[12px] text-on-surface-variant font-medium">Mã số: {selectedStudent.student_code}</div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-on-surface-variant">Chọn lớp học chính thức:</label>
            {classOptions.length > 0 ? (
              <Select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                options={[{ value: "", label: "-- Chọn lớp học --" }, ...classOptions]}
                className="w-full"
              />
            ) : (
              <div className="text-[13px] text-error font-medium flex items-center gap-1">
                <HelpCircle className="w-4 h-4" /> Không tìm thấy lớp học hoạt động nào. Vui lòng tạo lớp học trước.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
            <Button onClick={() => setIsAssignOpen(false)} variant="outline" size="md">
              Hủy
            </Button>
            <Button 
              onClick={handleAssignSubmit} 
              variant="primary" 
              size="md"
              disabled={!selectedClassId}
            >
              Xác nhận xếp lớp
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Import Excel */}
      <ExcelImportModal
        open={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          refetch();
        }}
        title="Nhập hồ sơ đăng ký tuyển sinh từ Excel"
        templateType="registrations"
        onImport={handleImportExcel}
      />
    </div>
  );
}
