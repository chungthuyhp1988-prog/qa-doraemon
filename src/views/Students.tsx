import { useState } from "react";
import {
  Plus,
  Search,
  Phone,
  User,
  FileSpreadsheet,
  GraduationCap
} from "lucide-react";
import { StudentForm } from "../components/forms/StudentForm";
import { StudentDetailPanel } from "../components/details/StudentDetailPanel";
import {
  useSlidePanel,
  Table,
  type TableColumn,
  ExcelImportModal
} from "../components/ui";
import { cn } from "../lib/utils";
import { useStudents, type StudentWithRelations } from "../hooks/useStudents";

const getVietnameseSortKeys = (fullName: string) => {
  let cleanName = (fullName || '').trim();
  cleanName = cleanName.replace(/\s*[\(\[].*?[\)\]]\s*$/g, '').trim();

  if (!cleanName) return { firstName: '' };
  const parts = cleanName.split(/\s+/);
  return { firstName: parts[parts.length - 1] };
};

export function Students() {
  const { openPanel } = useSlidePanel();
  const {
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
    isRefetchingNewFilter,
    isFetchingMore,
    handleRefreshData,
    handleBulkStatusUpdate,
    handleBulkClassAssign,
    handleResetFilters,
    handleExportExcel,
    handleImportExcel,
    handleScrollToBottom
  } = useStudents();

  const handleOpenDetail = (studentId: string) => {
    openPanel({
      title: 'Hồ sơ chi tiết học sinh',
      icon: <User size={14} />,
      width: 768,
      component: (
        <StudentDetailPanel 
          studentId={studentId} 
          classesList={classesList}
          onDeleteSuccess={handleRefreshData}
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
          onSuccess={handleRefreshData}
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
                getVietnameseSortKeys(row.full_name).firstName.substring(0, 1).toUpperCase() || 'H'
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
          sortable: true,
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
          { value: 'active', label: `Đang học (${counts.active})` },
          { value: 'registered', label: `Đã ghi danh (${counts.registered})` },
          { value: 'waiting', label: `Danh sách chờ (${counts.waiting})` },
          { value: 'future', label: `Đăng ký năm tới (${counts.future})` }
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
            {classesList.map((c: any) => {
              const gradeName = getGradeName(c.grade_level);
              return (
                <option key={c.id} value={c.id}>
                  {c.name}{gradeName ? ` (${gradeName})` : ''}
                </option>
              );
            })}
          </select>
        )}

        {/* Birth Year / Age Filter */}
        {availableBirthYears.length > 0 && (
          <select 
            value={selectedBirthYear}
            onChange={(e) => setSelectedBirthYear(e.target.value)}
            className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors cursor-pointer font-semibold text-on-surface-variant"
          >
            <option value="all">Tất cả độ tuổi</option>
            {availableBirthYears.map((year) => {
              const age = new Date().getFullYear() - year;
              return (
                <option key={year} value={year}>
                  {year} ({age} tuổi)
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
            <option value="all">Tất cả các đối tượng</option>
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
                {classesList.map((c) => {
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
          
          <span className="text-[13px] font-extrabold text-on-surface-variant font-medium font-inter">Chuyển trạng thái:</span>
          
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
          handleRefreshData();
        }}
        title="Nhập danh sách học sinh từ Excel"
        templateType="students"
        onImport={handleImportExcel}
      />
    </div>
  );
}
export default Students;
