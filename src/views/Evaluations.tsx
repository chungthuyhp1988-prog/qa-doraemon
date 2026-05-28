import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Award, 
  Calendar, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  TrendingUp, 
  FileText,
  Bookmark,
  Users
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog } from "../components/ui";
import { EvaluationForm } from "../components/forms/EvaluationForm";
import { useAppStore } from "../stores/appStore";
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  Legend,
  Tooltip
} from "recharts";

export function Evaluations() {
  const queryClient = useQueryClient();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);

  // States
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  if (selectedClassId === "all" && classesList.length > 0) {
    setSelectedClassId(classesList[0].id);
  }

  // 2. Fetch students list
  const { data: studentsResponse, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['evals-students-list', selectedClassId, search],
    queryFn: () => {
      const filters: Record<string, any> = { status: 'active' };
      if (selectedClassId !== "all") {
        filters.class_id = selectedClassId;
      }
      return api.getAll<any>(
        'students', 
        { page: 1, pageSize: 100, sortBy: 'full_name', sortOrder: 'asc' },
        { 
          search: search || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        }
      );
    }
  });
  const students = studentsResponse?.data?.data || [];

  // Set default selected student
  if (!selectedStudentId && students.length > 0) {
    setSelectedStudentId(students[0].id);
  }

  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0];

  // 3. Fetch evaluations of selected student
  const { data: evaluationsResponse, isLoading: isLoadingEvals } = useQuery({
    queryKey: ['student-evaluations', selectedStudentId],
    queryFn: () => {
      if (!selectedStudentId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>(
        'student_evaluations',
        { page: 1, pageSize: 100, sortBy: 'evaluation_date', sortOrder: 'desc' },
        { filters: { student_id: selectedStudentId } },
        '*, users:evaluator_id(full_name)'
      );
    },
    enabled: !!selectedStudentId
  });
  const evaluations = evaluationsResponse?.data?.data || [];

  const handleCreateClick = () => {
    setSelectedEvaluation(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (evalObj: any) => {
    setSelectedEvaluation(evalObj);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (evalObj: any) => {
    setSelectedEvaluation(evalObj);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedEvaluation) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('student_evaluations', selectedEvaluation.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa phiếu đánh giá thành công!');
      queryClient.invalidateQueries({ queryKey: ['student-evaluations', selectedStudentId] });
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi xóa đánh giá', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  // Prepare Radar Chart Data for the latest evaluation
  const latestEval = evaluations[0];
  const radarData = latestEval 
    ? [
        { subject: 'Thể chất & Vận động', A: latestEval.physical_score || 0, fullMark: 5 },
        { subject: 'Nhận thức & Tư duy', A: latestEval.cognitive_score || 0, fullMark: 5 },
        { subject: 'Ngôn ngữ & Giao tiếp', A: latestEval.language_score || 0, fullMark: 5 },
        { subject: 'Tình cảm xã hội', A: latestEval.social_score || 0, fullMark: 5 },
        { subject: 'Thẩm mỹ & Năng khiếu', A: latestEval.aesthetic_score || 0, fullMark: 5 },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Đánh Giá Phát Triển Trẻ</h1>
          <p className="text-sm text-on-surface-variant">
            Lập phiếu đánh giá định kỳ cho học sinh trên 5 lĩnh vực năng lực cốt lõi theo tiêu chuẩn của Bộ Giáo dục.
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          disabled={!activeStudent}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Tạo Phiếu Đánh Giá
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Panel: Student Selection */}
        <div className="lg:col-span-1 space-y-4">
          <div className="grid grid-cols-1 gap-2.5">
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedStudentId(null);
              }}
              className="w-full bg-surface-container-low text-on-surface py-2.5 px-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm font-semibold cursor-pointer"
            >
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  Lớp {c.name}
                </option>
              ))}
              {classesList.length === 0 && <option value="all">Chưa có lớp học</option>}
            </select>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Tìm tên học sinh..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-container-low hover:bg-surface-container-low/80 focus:bg-white text-on-surface placeholder-on-surface-variant pl-10 pr-4 py-2.5 rounded-xl border border-outline-variant/40 focus:border-primary focus:outline-none transition-all text-sm"
              />
            </div>
          </div>

          {isLoadingStudents ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 rounded-xl bg-surface-container-low animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
              <Award className="w-8 h-8 text-on-surface-variant/40 mb-2" />
              <span className="text-sm text-on-surface-variant">Không tìm thấy học sinh nào</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {students.map((student: any) => {
                const isSelected = selectedStudentId === student.id;
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between hover:shadow-sm select-none",
                      isSelected
                        ? "bg-primary-container/20 border-primary shadow-sm"
                        : "bg-surface border-outline-variant/40 hover:border-outline-variant"
                    )}
                  >
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">{student.full_name}</h4>
                      <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                        Mã HS: {student.student_code}
                      </p>
                    </div>
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-all",
                      isSelected ? "text-primary translate-x-0.5" : "text-on-surface-variant/60"
                    )} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel: Evals details, Radar Chart & list */}
        <div className="lg:col-span-2 space-y-6">
          {activeStudent ? (
            <div className="space-y-6">
              {/* Student Header Summary */}
              <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h2 className="text-xl font-bold text-on-surface">{activeStudent.full_name}</h2>
                  <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                    Mã HS: <span className="text-on-surface font-semibold">{activeStudent.student_code}</span> | 
                    Lớp: <span className="text-on-surface font-semibold">{classesList.find(c => c.id === activeStudent.class_id)?.name || '---'}</span>
                  </p>
                </div>
                {latestEval && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-wider">
                    Kỳ gần nhất: {latestEval.period}
                  </span>
                )}
              </div>

              {/* Radar Chart (Visual Pro Max) */}
              {latestEval ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-surface border border-outline-variant/40 rounded-3xl p-6 items-center">
                  <div className="md:col-span-2 h-64 sm:h-72 w-full flex flex-col items-center justify-center">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant mb-2">
                      Mạng Nhện Năng Lực 5 Chiều
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={9} tickLine={false} />
                        <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} stroke="#cbd5e1" fontSize={8} />
                        <Radar name={activeStudent.full_name} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="md:col-span-3 space-y-3.5 self-start">
                    <h3 className="text-sm font-bold text-on-surface">Điểm chi tiết: Kỳ {latestEval.period}</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Thể chất & Vận động', score: latestEval.physical_score, note: latestEval.physical_note },
                        { label: 'Nhận thức & Tư duy', score: latestEval.cognitive_score, note: latestEval.cognitive_note },
                        { label: 'Ngôn ngữ & Giao tiếp', score: latestEval.language_score, note: latestEval.language_note },
                        { label: 'Tình cảm xã hội', score: latestEval.social_score, note: latestEval.social_note },
                        { label: 'Thẩm mỹ & Năng khiếu', score: latestEval.aesthetic_score, note: latestEval.aesthetic_note },
                      ].map((item, idx) => (
                        <div key={idx} className="p-3 rounded-2xl bg-surface-container-low/30 border border-outline-variant/20 flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs font-bold text-on-surface">
                            <span>{item.label}</span>
                            <span className="text-primary">{item.score || 0} / 5</span>
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-on-surface-variant font-medium italic mt-0.5">
                              "{item.note}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-surface border border-outline-variant/40 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                  <TrendingUp className="w-12 h-12 text-on-surface-variant/35 mb-3" />
                  <h3 className="text-sm font-bold text-on-surface mb-1">Chưa có biểu đồ năng lực</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm">Tạo phiếu đánh giá đầu tiên để có thể quan sát biểu đồ mạng nhện năng lực phát triển của con.</p>
                </div>
              )}

              {/* Evaluations History List */}
              <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-on-surface">Lịch sử phiếu đánh giá định kỳ</h3>

                {isLoadingEvals ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-16 bg-surface-container-low rounded-2xl" />
                    <div className="h-16 bg-surface-container-low rounded-2xl" />
                  </div>
                ) : evaluations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
                    <Award className="w-8 h-8 text-on-surface-variant/40 mb-2" />
                    <span className="text-sm text-on-surface-variant">Học sinh chưa có phiếu đánh giá nào.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evaluations.map((evalObj: any) => (
                      <div
                        key={evalObj.id}
                        className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-on-surface">
                              Kỳ: {evalObj.period}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              ({new Date(evalObj.evaluation_date).toLocaleDateString('vi-VN')})
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 print:hidden">
                            <button
                              onClick={() => handleEditClick(evalObj)}
                              className="p-1.5 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer border border-outline-variant/20"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(evalObj)}
                              className="p-1.5 hover:bg-error-container/20 rounded-lg text-on-surface-variant hover:text-error transition-all cursor-pointer border border-outline-variant/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 bg-surface-container-low/20 rounded-xl space-y-1">
                          <h4 className="text-xs font-bold text-on-surface flex items-center gap-1">
                            <Bookmark className="w-3.5 h-3.5 text-primary" />
                            Nhận xét tổng quan của GV:
                          </h4>
                          <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
                            {evalObj.overall_comment}
                          </p>
                          {evalObj.recommendation && (
                            <p className="text-[11px] text-on-surface-variant/80 italic mt-1">
                              <span className="font-semibold">Định hướng giáo dục: </span>
                              {evalObj.recommendation}
                            </p>
                          )}
                        </div>

                        <div className="text-[10px] text-on-surface-variant/70 border-t border-outline-variant/10 pt-2 flex justify-between items-center">
                          <span>Giáo viên đánh giá: <span className="font-semibold text-on-surface">{evalObj.users?.full_name || 'Hệ thống'}</span></span>
                          <span>Được ghi lúc: {new Date(evalObj.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/20">
              <Award className="w-12 h-12 text-on-surface-variant/40 mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-on-surface mb-1">Chưa chọn học sinh</h3>
              <p className="text-sm text-on-surface-variant">Chọn một học sinh từ danh sách bên trái để xem phiếu đánh giá năng lực.</p>
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Form Modal */}
      {isFormOpen && (
        <EvaluationForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          evaluation={selectedEvaluation}
          studentsList={students}
          preselectedStudentId={selectedStudentId || undefined}
        />
      )}

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Xóa phiếu đánh giá?"
        message="Bạn có chắc chắn muốn xóa phiếu đánh giá này? Kết quả trên mạng nhện năng lực định kỳ sẽ thay đổi."
        confirmText="Xóa phiếu"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
}
