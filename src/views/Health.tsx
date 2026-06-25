import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Heart, 
  Ruler, 
  Scale, 
  Thermometer, 
  Activity, 
  Syringe,
  Eye,
  ShieldAlert
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useSlidePanel, Table, type TableColumn, ErrorState } from "../components/ui";
import { HealthRecordForm } from "../components/forms/HealthRecordForm";
import { HealthRecordDetailPanel } from "../components/details/HealthRecordDetailPanel";
import { useAppStore } from "../stores/appStore";

export function Health() {
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const { openPanel } = useSlidePanel();

  // Filters state
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [search, setSearch] = useState("");

  // 1. Fetch classes for filtering
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list', selectedAcademicYearId],
    queryFn: () => {
      if (!selectedAcademicYearId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>('classes', { page: 1, pageSize: 100 }, { filters: { academic_year_id: selectedAcademicYearId } });
    },
    enabled: !!selectedAcademicYearId
  });
  const classesList = classesResponse?.data?.data || [];

  // Set default selected class filter
  useEffect(() => {
    if (selectedClassId === "all" && classesList.length > 0) {
      setSelectedClassId(classesList[0].id);
    }
  }, [classesList]);

  // 2. Fetch students list with class details and their latest health record
  const { data: studentsResponse, isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['health-students-list-full', selectedClassId, search],
    queryFn: async () => {
      const filters: Record<string, any> = { status: 'active' };
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      }
      
      // Fetch students first
      const studentRes = await api.getAll<any>(
        'students', 
        { page: 1, pageSize: 200, sortBy: 'full_name', sortOrder: 'asc' },
        { 
          search: search || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        },
        '*, classes(name)'
      );
      
      const studentsData = studentRes.data?.data || [];
      if (studentsData.length === 0) return { data: { data: [], count: 0 }, error: null, count: 0 };

      // Fetch latest health records for each student of this class
      const studentIds = studentsData.map((s: any) => s.id);
      const { data: recordsData } = await api.getAll<any>(
        'health_records',
        { page: 1, pageSize: 1000, sortBy: 'record_date', sortOrder: 'desc' },
        { filters: { student_id: `in.(${studentIds.join(',')})` } }
      );

      const recordsList = recordsData?.data || [];

      // Map latest record to student
      const studentsWithLatestRecord = studentsData.map((student: any) => {
        // Since records are sorted desc by date, the first matching is the latest
        const latest = recordsList.find((r: any) => r.student_id === student.id);
        return {
          ...student,
          latest_health_record: latest || null
        };
      });

      return {
        data: {
          data: studentsWithLatestRecord,
          count: studentsWithLatestRecord.length
        },
        error: null,
        count: studentsWithLatestRecord.length
      };
    }
  });
  const students = studentsResponse?.data?.data || [];

  // SlidePanel handlers
  const handleOpenDetail = (studentId: string) => {
    openPanel({
      title: 'Hồ sơ sức khỏe học sinh',
      icon: <Heart size={14} />,
      width: 800,
      component: (
        <HealthRecordDetailPanel 
          studentId={studentId} 
          studentsList={students}
          onUpdateSuccess={() => refetchStudents()}
        />
      )
    });
  };

  const handleCreateRecord = () => {
    openPanel({
      title: 'Thêm lượt khám sức khỏe',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <HealthRecordForm 
          studentsList={students}
          onSuccess={() => refetchStudents()}
        />
      )
    });
  };

  // Define Table Columns
  const tableColumns: TableColumn<any>[] = [
    {
      key: "student",
      header: "Học sinh",
      render: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 border border-red-100 flex items-center justify-center font-bold text-[11px] shrink-0 font-playfair">
            {row.full_name?.substring(0, 2).toUpperCase() || 'HS'}
          </div>
          <div>
            <p className="font-bold text-[14px] text-on-surface leading-tight font-inter">{row.full_name}</p>
            <p className="text-[11px] font-semibold text-on-surface-variant/70 uppercase tracking-widest mt-0.5 select-all">
              {row.student_code}
            </p>
          </div>
        </div>
      )
    },
    {
      key: "class",
      header: "Lớp",
      render: (row: any) => (
        <span className="font-semibold text-[13px] text-on-surface-variant">
          {row.classes?.name || 'Chưa xếp lớp'}
        </span>
      )
    },
    {
      key: "height",
      header: "Chiều cao gần nhất",
      render: (row: any) => {
        const val = row.latest_health_record?.height_cm;
        return val ? (
          <span className="font-semibold text-[13px] text-on-surface flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5 text-blue-500" /> {val} cm
          </span>
        ) : <span className="text-on-surface-variant/40">—</span>;
      }
    },
    {
      key: "weight",
      header: "Cân nặng gần nhất",
      render: (row: any) => {
        const val = row.latest_health_record?.weight_kg;
        return val ? (
          <span className="font-semibold text-[13px] text-on-surface flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-green-500" /> {val} kg
          </span>
        ) : <span className="text-on-surface-variant/40">—</span>;
      }
    },
    {
      key: "health_status",
      header: "Tình trạng sức khỏe",
      render: (row: any) => {
        const val = row.latest_health_record?.health_status;
        return val ? (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border uppercase tracking-wider",
            val === 'Bình thường' 
              ? "bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded text-[11px] tracking-wide shadow-2xs select-none" 
              : "bg-amber-500 text-white font-extrabold px-2 py-0.5 rounded text-[11px] tracking-wide shadow-2xs select-none"
          )}>
            {val}
          </span>
        ) : <span className="text-on-surface-variant/40">—</span>;
      }
    },
    {
      key: "special_notes",
      header: "Lưu ý y tế",
      render: (row: any) => {
        const hasWarning = row.allergies || row.medical_notes;
        return hasWarning ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-rose-600 text-white font-extrabold tracking-wide shadow-2xs max-w-[150px] truncate select-none" title={row.allergies || row.medical_notes}>
            <ShieldAlert className="w-3.5 h-3.5 text-white shrink-0" />
            {row.allergies || row.medical_notes}
          </span>
        ) : <span className="text-on-surface-variant/30 italic text-xs font-semibold">Bình thường</span>;
      }
    },
    {
      key: "actions" as any,
      header: "Thao tác",
      render: (row: any) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenDetail(row.id)}
            className="text-primary hover:bg-primary-container/30 p-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 text-[13px] font-bold border border-transparent hover:border-primary/20"
          >
            <Eye className="w-4 h-4" /> Xem hồ sơ y tế
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="animate-in fade-in duration-300 max-w-[1400px] mx-auto pb-12 space-y-4">
      {/* Header section */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[20px] md:text-[24px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Sức khỏe & Phát triển</h2>
          <p className="text-[13px] md:text-[14px] text-on-surface-variant mt-1 font-inter">
            Theo dõi chiều cao, cân nặng, lịch sử tiêm chủng và ghi chú y tế của trẻ theo định kỳ.
          </p>
        </div>
        <button
          onClick={handleCreateRecord}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl text-[13px] font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Ghi Nhận Lượt Khám
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-wrap gap-3.5 items-center">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Tìm theo tên học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-outline-variant/50 rounded-xl text-[14px] bg-transparent focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Class Filter */}
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="border border-outline-variant/50 rounded-xl px-3.5 py-2 text-[14px] bg-transparent focus:outline-none focus:border-primary transition-all cursor-pointer font-bold text-on-surface-variant"
        >
          <option value="all">Tất cả lớp</option>
          {classesList.map((c) => (
            <option key={c.id} value={c.id}>
              Lớp {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Table view */}
      {isErrorStudents ? (
        <ErrorState onRetry={refetchStudents} />
      ) : (
      <Table 
        className="rounded-2xl border border-outline-variant/30 shadow-sm bg-surface"
        columns={tableColumns} 
        data={students} 
        rowKey={(row) => row.id}
        onRowClick={(row) => handleOpenDetail(row.id)}
        loading={isLoadingStudents}
        emptyTitle="Không tìm thấy dữ liệu sức khỏe"
        emptyDescription="Không có dữ liệu học sinh nào khớp với bộ lọc lớp học hoặc từ khóa tìm kiếm."
      />
      )}
    </div>
  );
}
