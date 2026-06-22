import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Award, 
  Plus, 
  Edit2, 
  Trash2, 
  Bookmark, 
  User,
  Star
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { EvaluationForm } from '../forms/EvaluationForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';
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

interface EvaluationDetailPanelProps {
  studentId: string;
  studentsList: any[];
  onUpdateSuccess?: () => void;
}

export const EvaluationDetailPanel: React.FC<EvaluationDetailPanelProps> = ({
  studentId,
  studentsList,
  onUpdateSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();

  const [selectedEvaluation, setSelectedEvaluation] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch student info
  const { data: studentResponse } = useQuery({
    queryKey: ['student-eval-profile', studentId],
    queryFn: () => api.getById('students', studentId)
  });
  const student = studentResponse?.data;

  // 2. Fetch student evaluations
  const { data: evaluationsResponse, isLoading: isLoadingEvals } = useQuery({
    queryKey: ['student-evaluations', studentId],
    queryFn: () => {
      if (!studentId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>(
        'student_evaluations',
        { page: 1, pageSize: 100, sortBy: 'evaluation_date', sortOrder: 'desc' },
        { filters: { student_id: studentId } },
        '*, users:evaluator_id(full_name)'
      );
    },
    enabled: !!studentId
  });
  const evaluations = evaluationsResponse?.data?.data || [];

  const handleCreateEval = () => {
    openPanel({
      title: 'Tạo phiếu đánh giá mới',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <EvaluationForm 
          studentsList={studentsList}
          preselectedStudentId={studentId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['student-evaluations', studentId] });
            if (onUpdateSuccess) onUpdateSuccess();
          }}
        />
      )
    });
  };

  const handleEditEval = (evalObj: any) => {
    openPanel({
      title: 'Chỉnh sửa phiếu đánh giá',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <EvaluationForm 
          evaluation={evalObj}
          studentsList={studentsList}
          preselectedStudentId={studentId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['student-evaluations', studentId] });
            if (onUpdateSuccess) onUpdateSuccess();
          }}
        />
      )
    });
  };

  const handleDeleteEval = async () => {
    if (!selectedEvaluation) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('student_evaluations', selectedEvaluation.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa phiếu đánh giá thành công!');
      queryClient.invalidateQueries({ queryKey: ['student-evaluations', studentId] });
      setIsDeleteDialogOpen(false);
      if (onUpdateSuccess) onUpdateSuccess();
    } catch (err: any) {
      toast.error('Lỗi khi xóa đánh giá', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
      setSelectedEvaluation(null);
    }
  };

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

  if (!student) {
    return (
      <div className="p-8 text-center text-on-surface-variant italic">
        Không tìm thấy học sinh.
      </div>
    );
  }

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
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      
      {/* HEADER */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl border border-primary/20 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
              Đánh giá định kỳ em {student.full_name}
            </h2>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Mã HS: {student.student_code} • Lớp: {student.classes?.name || '—'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreateEval}
          className="bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Tạo phiếu đánh giá
        </Button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Radar Chart (Visual Pro Max) */}
        {latestEval ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 bg-white border border-outline-variant/40 rounded-3xl p-5 items-center shadow-2xs">
            <div className="md:col-span-2 h-60 w-full flex flex-col items-center justify-center">
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-2">
                Mạng nhện năng lực 5 chiều
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={8} tickLine={false} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} stroke="#cbd5e1" fontSize={8} />
                  <Radar name={student.full_name} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="md:col-span-3 space-y-3.5 self-start text-xs">
              <h3 className="text-sm font-bold text-on-surface">Điểm chi tiết: Kỳ {latestEval.period}</h3>
              <div className="space-y-2">
                {[
                  { label: 'Thể chất & Vận động', score: latestEval.physical_score, note: latestEval.physical_note },
                  { label: 'Nhận thức & Tư duy', score: latestEval.cognitive_score, note: latestEval.cognitive_note },
                  { label: 'Ngôn ngữ & Giao tiếp', score: latestEval.language_score, note: latestEval.language_note },
                  { label: 'Tình cảm xã hội', score: latestEval.social_score, note: latestEval.social_note },
                  { label: 'Thẩm mỹ & Năng khiếu', score: latestEval.aesthetic_score, note: latestEval.aesthetic_note },
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-outline-variant/10 flex flex-col gap-1 shadow-2xs">
                    <div className="flex justify-between items-center text-xs font-bold text-on-surface">
                      <span>{item.label}</span>
                      <span className="text-primary flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                        {item.score || 0} / 5
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-[10px] text-on-surface-variant font-medium italic mt-0.5">
                        "{item.note}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-outline-variant/40 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xs">
            <Award className="w-12 h-12 text-on-surface-variant/35 mb-3" />
            <h3 className="text-sm font-bold text-on-surface mb-1">Chưa có biểu đồ năng lực</h3>
            <p className="text-xs text-on-surface-variant max-w-sm">Tạo phiếu đánh giá đầu tiên để có thể quan sát biểu đồ mạng nhện năng lực phát triển của con.</p>
          </div>
        )}

        {/* Lịch sử phiếu đánh giá */}
        <div className="bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs space-y-4">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider">Lịch sử phiếu đánh giá định kỳ</h3>

          {isLoadingEvals ? (
            <div className="space-y-2 py-4 animate-pulse">
              <div className="h-16 bg-surface-container rounded-xl" />
              <div className="h-16 bg-surface-container rounded-xl" />
            </div>
          ) : evaluations.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-outline-variant rounded-xl text-on-surface-variant">
              <Award className="w-8 h-8 mx-auto text-on-surface-variant/40 mb-2" />
              <span className="text-xs font-bold">Chưa có phiếu đánh giá nào</span>
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {evaluations.map((evalObj: any) => (
                <div
                  key={evalObj.id}
                  className="p-4 rounded-xl border border-outline-variant/20 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-bold text-on-surface">
                        Kỳ: {evalObj.period}
                      </span>
                      <span className="text-on-surface-variant">
                        ({formatDate(evalObj.evaluation_date)})
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 select-none">
                      <button
                        onClick={() => handleEditEval(evalObj)}
                        className="p-1.5 hover:bg-white rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer border border-outline-variant/20"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedEvaluation(evalObj);
                          setIsDeleteDialogOpen(true);
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600 transition-all cursor-pointer border border-red-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-outline-variant/20 rounded-xl space-y-1.5 text-xs">
                    <h4 className="font-bold text-on-surface flex items-center gap-1">
                      <Bookmark className="w-3.5 h-3.5 text-primary" />
                      Nhận xét tổng quan của GV:
                    </h4>
                    <p className="text-on-surface-variant leading-relaxed font-semibold">
                      {evalObj.overall_comment}
                    </p>
                    {evalObj.recommendation && (
                      <p className="text-[11px] text-on-surface-variant/80 italic mt-1 font-semibold border-t border-dashed border-outline-variant/20 pt-1.5">
                        <span className="font-bold text-primary">Định hướng giáo dục: </span>
                        {evalObj.recommendation}
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] text-on-surface-variant/70 pt-1 flex justify-between items-center font-medium">
                    <span>Giáo viên đánh giá: <span className="font-bold text-on-surface">{evalObj.users?.full_name || 'Hệ thống'}</span></span>
                    <span>Được ghi lúc: {new Date(evalObj.created_at).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteEval}
        title="Xóa phiếu đánh giá?"
        message="Bạn có chắc chắn muốn xóa phiếu đánh giá này? Kết quả trên mạng nhện năng lực định kỳ sẽ thay đổi."
        confirmText="Xóa phiếu"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
