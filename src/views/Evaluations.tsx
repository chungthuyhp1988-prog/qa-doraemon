import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Award, 
  Calendar, 
  Eye
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { useSlidePanel, Table, type TableColumn, ErrorState } from "../components/ui";
import { EvaluationForm } from "../components/forms/EvaluationForm";
import { EvaluationDetailPanel } from "../components/details/EvaluationDetailPanel";
import { useAppStore } from "../stores/appStore";

export function Evaluations() {
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const { openPanel } = useSlidePanel();

  // Filters state
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [search, setSearch] = useState("");

  // 1. Fetch classes for filtering
  const { data: classesResponse } = useQuery({
    queryKey: ['classes-list-evals', selectedAcademicYearId],
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

  // 2. Fetch students list with class details and their latest evaluation
  const { data: studentsResponse, isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudents } = useQuery({
    queryKey: ['evals-students-list-full', selectedClassId, search],
    queryFn: async () => {
      const filters: Record<string, any> = { status: 'active' };
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      }
      
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

      // Fetch latest evaluation for each student
      const studentIds = studentsData.map((s: any) => s.id);
      const { data: evalsData } = await api.getAll<any>(
        'student_evaluations',
        { page: 1, pageSize: 1000, sortBy: 'evaluation_date', sortOrder: 'desc' },
        { filters: { student_id: `in.(${studentIds.join(',')})` } }
      );

      const evalsList = evalsData?.data || [];

      // Map latest evaluation to student
      const studentsWithLatestEval = studentsData.map((student: any) => {
        const latest = evalsList.find((e: any) => e.student_id === student.id);
        return {
          ...student,
          latest_evaluation: latest || null
        };
      });

      return {
        data: {
          data: studentsWithLatestEval,
          count: studentsWithLatestEval.length
        },
        error: null,
        count: studentsWithLatestEval.length
      };
    }
  });
  const students = studentsResponse?.data?.data || [];

  // SlidePanel handlers
  const handleOpenDetail = (studentId: string) => {
    openPanel({
      title: 'Đánh giá phát triển học sinh',
      icon: <Award size={14} />,
      width: 800,
      component: (
        <EvaluationDetailPanel 
          studentId={studentId} 
          studentsList={students}
          onUpdateSuccess={() => refetchStudents()}
        />
      )
    });
  };

  const handleCreateEvaluation = () => {
    openPanel({
      title: 'Tạo phiếu đánh giá mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <EvaluationForm 
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
          <div className="w-8 h-8 rounded-full bg-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-[11px] shrink-0 font-playfair">
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
      key: "period",
      header: "Kỳ đánh giá gần nhất",
      render: (row: any) => {
        const val = row.latest_evaluation?.period;
        const date = row.latest_evaluation?.evaluation_date;
        return val ? (
          <span className="font-semibold text-[13px] text-on-surface flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" /> {val} ({new Date(date).toLocaleDateString('vi-VN')})
          </span>
        ) : <span className="text-on-surface-variant/40 italic">Chưa đánh giá</span>;
      }
    },
    {
      key: "score_average",
      header: "Điểm TB 5 mặt",
      render: (row: any) => {
        const evalObj = row.latest_evaluation;
        if (!evalObj) return <span className="text-on-surface-variant/40">—</span>;
        
        const sum = Number(evalObj.physical_score || 0) + 
                    Number(evalObj.cognitive_score || 0) + 
                    Number(evalObj.language_score || 0) + 
                    Number(evalObj.social_score || 0) + 
                    Number(evalObj.aesthetic_score || 0);
        const avg = (sum / 5).toFixed(1);

        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] bg-primary/10 border border-primary/20 text-primary font-bold">
            {avg} / 5
          </span>
        );
      }
    },
    {
      key: "overall_comment",
      header: "Nhận xét chung",
      render: (row: any) => {
        const val = row.latest_evaluation?.overall_comment;
        return val ? (
          <span className="text-xs text-on-surface-variant line-clamp-1 max-w-[250px] font-semibold" title={val}>
            "{val}"
          </span>
        ) : <span className="text-on-surface-variant/30">—</span>;
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
            <Eye className="w-4 h-4" /> Đánh giá chi tiết
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
          <h2 className="text-[24px] md:text-[30px] font-bold italic font-playfair text-on-surface leading-tight tracking-[-0.02em]">Đánh giá Phát triển Trẻ</h2>
          <p className="text-[14px] md:text-[16px] text-on-surface-variant mt-1 font-inter">
            Lập phiếu đánh giá định kỳ cho học sinh trên 5 lĩnh vực năng lực cốt lõi theo tiêu chuẩn của Bộ Giáo dục.
          </p>
        </div>
        <button
          onClick={handleCreateEvaluation}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-5 py-2.5 rounded-xl text-[14px] font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tạo Phiếu Đánh Giá
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
          {classesList.map((c: any) => (
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
        className="rounded-2xl border border-outline-variant/30 shadow-sm bg-white"
        columns={tableColumns} 
        data={students} 
        rowKey={(row) => row.id}
        onRowClick={(row) => handleOpenDetail(row.id)}
        loading={isLoadingStudents}
        emptyTitle="Không tìm thấy dữ liệu đánh giá"
        emptyDescription="Không có dữ liệu học sinh nào khớp với bộ lọc lớp học hoặc từ khóa tìm kiếm."
      />
      )}
    </div>
  );
}
