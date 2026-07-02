import { useState } from "react";
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
import {
  Table,
  type TableColumn,
  ConfirmDialog,
  useSlidePanel,
  ExcelImportModal
} from "../components/ui";
import { TeacherForm } from "../components/forms/TeacherForm";
import { TeacherDetailPanel } from "../components/details/TeacherDetailPanel";
import { useTeachers, type TeacherRow } from "../hooks/useTeachers";

const getTeacherTitle = (_email: string, role: string, jobTitle?: string | null) => {
  if (jobTitle) return jobTitle;
  if (role === 'admin') return 'Ban giám hiệu';
  if (role === 'staff') return 'Nhân viên';
  return 'Giáo viên';
};

const getRoleBadge = (row: TeacherRow) => {
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

const getInitials = (name: string) => {
  if (!name) return "GV";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export function Teachers() {
  const { openPanel } = useSlidePanel();
  const {
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
    refetch
  } = useTeachers();

  const pageSize = 100;

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
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Danh sách cán bộ, giáo viên, nhân viên</h2>
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
            className="bg-primary text-on-primary px-4 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
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
          <option value="all">Tất cả các lớp phụ trách</option>
          {classesList.map((c) => {
            const gradeName = getGradeName(c.grade_level);
            return (
              <option key={c.id} value={c.id}>
                {c.name}{gradeName ? ` (${gradeName})` : ''}
              </option>
            );
          })}
        </select>

        {/* Work Status Filter */}
        <select 
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
        >
          <option value="active">Đang làm việc</option>
          <option value="maternity_leave">Đang nghỉ thai sản</option>
          <option value="on_leave">Nghỉ phép</option>
          <option value="inactive">Đã nghỉ việc</option>
        </select>

        <button 
          onClick={handleResetFilters}
          className="px-4 py-2 text-primary text-[14px] font-bold hover:bg-primary/5 rounded-xl transition-all cursor-pointer ml-auto"
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-24 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[14px] text-on-surface-variant font-medium">Đang tải danh sách nhân sự...</span>
          </div>
        </div>
      ) : isError ? (
        <div className="py-16 text-center text-error border border-dashed border-red-200 rounded-2xl bg-red-50/20">
          <h4 className="font-bold text-lg">Lỗi tải dữ liệu</h4>
          <p className="text-[14px] text-on-surface-variant mt-1">Đã xảy ra lỗi khi truy vấn thông tin nhân sự từ hệ thống.</p>
        </div>
      ) : teachersData.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
          <Users className="w-12 h-12 text-on-surface-variant/40 mx-auto mb-3" />
          <h4 className="font-bold text-lg text-on-surface">Không tìm thấy nhân sự nào</h4>
          <p className="text-[14px] text-on-surface-variant mt-1 max-w-sm mx-auto">Vui lòng điều chỉnh từ khóa tìm kiếm hoặc các tiêu chí bộ lọc.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Layout Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teachersData.map((row) => {
            const classes = row.class_teachers?.map((ct: any) => ct.classes?.name).filter(Boolean).join(', ');
            return (
              <div 
                key={row.id} 
                onClick={() => handleOpenDetail(row.id)}
                className="bg-white rounded-2xl border border-outline-variant/35 p-5 hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-outline-variant/30 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      {row.avatar_url ? (
                        <img src={row.avatar_url} alt={row.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[18px] font-bold text-primary font-playfair">
                          {getInitials(row.full_name)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditTeacher(row)}
                        className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                        title="Sửa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTeacher(row);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-1 text-error hover:bg-error/5 rounded transition-colors"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="font-bold font-playfair text-[16px] text-on-surface leading-snug line-clamp-1">{row.full_name}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {getRoleBadge(row)}
                    </div>
                  </div>

                  {/* Quick info list */}
                  <div className="mt-4 space-y-2 border-t border-outline-variant/10 pt-3 text-[12.5px] text-on-surface-variant">
                    {row.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-semibold select-all">{row.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate select-all" title={row.email}>{row.email}</span>
                    </div>
                    {row.date_of_birth && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{formatDate(row.date_of_birth)}</span>
                      </div>
                    )}
                    {row.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="line-clamp-1" title={row.address}>{row.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/10 flex items-center justify-between text-[12px] text-on-surface-variant/80">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Phụ trách lớp</span>
                  <span className={cn(
                    "font-bold truncate max-w-[150px]",
                    classes ? "text-primary" : "italic text-on-surface-variant/40"
                  )}>
                    {classes || "Chưa phân công"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Layout Mode */
        <div className="bg-white rounded-2xl border border-outline-variant/30 overflow-hidden shadow-xs">
          <Table 
            columns={tableColumns}
            data={teachersData}
            rowKey={(row) => row.id}
            onRowClick={(row) => handleOpenDetail(row.id)}
            selectable={false}
          />
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-outline-variant/20 flex items-center justify-between bg-surface-container-lowest">
              <span className="text-[13px] text-on-surface-variant font-medium">Trang {page} / {totalPages} (Tổng số {totalCount} nhân sự)</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-outline-variant/50 rounded-xl hover:bg-surface-container disabled:opacity-40 transition-all cursor-pointer font-bold flex items-center gap-1 text-[13px] px-3 text-on-surface-variant"
                >
                  <ChevronLeft className="w-4 h-4" /> Trước
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-outline-variant/50 rounded-xl hover:bg-surface-container disabled:opacity-40 transition-all cursor-pointer font-bold flex items-center gap-1 text-[13px] px-3 text-on-surface-variant"
                >
                  Sau <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setSelectedTeacher(null);
        }}
        onConfirm={handleDeleteTeacher}
        title="Xóa nhân viên?"
        message={`Bạn có chắc chắn muốn xóa nhân viên "${selectedTeacher?.full_name}" khỏi hệ thống? Tất cả phân công lớp học của nhân viên này cũng sẽ bị xóa bỏ.`}
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
        title="Nhập danh sách giáo viên, nhân viên từ Excel"
        templateType="teachers"
        onImport={handleImportExcel}
      />
    </div>
  );
}
export default Teachers;
