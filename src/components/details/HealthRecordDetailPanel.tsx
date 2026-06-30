import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Calendar, 
  Ruler, 
  Scale, 
  Thermometer, 
  Activity, 
  Plus, 
  Edit2, 
  Trash2, 
  ShieldAlert,
  Syringe,
  FileText,
  TrendingUp,
  Heart
} from 'lucide-react';
import { api } from '../../lib/api';
import { useSlidePanel } from '../../context/SlidePanelContext';
import { HealthRecordForm } from '../forms/HealthRecordForm';
import { Button, ConfirmDialog } from '../ui';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/utils';
import type { StudentRow, HealthRecordRow } from '../../types/database';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";

interface HealthRecordDetailPanelProps {
  studentId: string;
  studentsList: { id: string; full_name: string; student_code?: string }[];
  onUpdateSuccess?: () => void;
}

export const HealthRecordDetailPanel: React.FC<HealthRecordDetailPanelProps> = ({
  studentId,
  studentsList,
  onUpdateSuccess,
}) => {
  const queryClient = useQueryClient();
  const { openPanel, closePanel } = useSlidePanel();

  const [selectedRecord, setSelectedRecord] = useState<HealthRecordRow | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch Student details (specifically for allergies and medical notes)
  const { data: studentResponse } = useQuery({
    queryKey: ['student-health-info', studentId],
    queryFn: () => api.getById('students', studentId)
  });
  const student = studentResponse?.data as StudentRow | undefined;

  // 2. Fetch health records of selected student
  const { data: healthResponse, isLoading: isLoadingRecords } = useQuery({
    queryKey: ['health-records', studentId],
    queryFn: () => {
      if (!studentId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<HealthRecordRow>(
        'health_records',
        { page: 1, pageSize: 100, sortBy: 'record_date', sortOrder: 'asc' },
        { filters: { student_id: studentId } }
      );
    },
    enabled: !!studentId
  });
  const rawRecords = healthResponse?.data?.data || [];
  
  // Chart records
  const chartData = rawRecords.map((r: HealthRecordRow) => ({
    date: r.record_date ? new Date(r.record_date).toLocaleDateString('vi-VN', { month: '2-digit', year: '2-digit' }) : '',
    'Chiều cao (cm)': r.height_cm,
    'Cân nặng (kg)': r.weight_kg,
  }));

  // List records (descending date order)
  const records = [...rawRecords].sort((a: HealthRecordRow, b: HealthRecordRow) =>
    new Date(b.record_date).getTime() - new Date(a.record_date).getTime()
  );

  const latestRecord = records[0];

  const handleCreateRecord = () => {
    openPanel({
      title: 'Thêm lượt khám y tế',
      icon: <Plus size={14} />,
      width: 768,
      component: (
        <HealthRecordForm 
          studentsList={studentsList}
          preselectedStudentId={studentId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['health-records', studentId] });
            if (onUpdateSuccess) onUpdateSuccess();
          }}
        />
      )
    });
  };

  const handleEditRecord = (rec: HealthRecordRow) => {
    openPanel({
      title: 'Chỉnh sửa lượt khám y tế',
      icon: <Edit2 size={14} />,
      width: 768,
      component: (
        <HealthRecordForm 
          record={rec}
          studentsList={studentsList}
          preselectedStudentId={studentId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['health-records', studentId] });
            if (onUpdateSuccess) onUpdateSuccess();
          }}
        />
      )
    });
  };

  const handleDeleteRecord = async () => {
    if (!selectedRecord) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('health_records', selectedRecord.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa lượt khám y tế thành công!');
      queryClient.invalidateQueries({ queryKey: ['health-records', studentId] });
      setIsDeleteDialogOpen(false);
      if (onUpdateSuccess) onUpdateSuccess();
    } catch (err: any) {
      toast.error('Lỗi khi xóa hồ sơ', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
      setSelectedRecord(null);
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

  return (
    <div className="flex flex-col h-full bg-surface-container-low select-none">
      {/* Header */}
      <div className="px-6 py-5 bg-white border-b border-outline-variant/30 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl border border-red-100 flex items-center justify-center shrink-0">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-on-surface leading-tight font-playfair italic">
              Sức khỏe của em {student.full_name}
            </h2>
            <p className="text-[12px] text-on-surface-variant font-medium mt-1">
              Mã HS: {student.student_code} • Giới tính: {student.gender === 'male' ? 'Nam' : 'Nữ'}
            </p>
          </div>
        </div>
        <Button
          onClick={handleCreateRecord}
          leftIcon={<Plus className="w-4 h-4" />}
          className="bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0"
        >
          Thêm lượt khám
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Latest Parameters Grid */}
        <div className="grid grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-outline-variant/40 shadow-2xs">
          <div className="p-3 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 dark:border-blue-500/30 flex items-center gap-3">
            <Ruler className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Chiều cao</p>
              <h3 className="text-base font-black text-on-surface dark:text-white mt-0.5">
                {latestRecord?.height_cm ? `${latestRecord.height_cm} cm` : '—'}
              </h3>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center gap-3">
            <Scale className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">Cân nặng</p>
              <h3 className="text-base font-black text-on-surface dark:text-white mt-0.5">
                {latestRecord?.weight_kg ? `${latestRecord.weight_kg} kg` : '—'}
              </h3>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/30 flex items-center gap-3">
            <Thermometer className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-widest">Nhiệt độ</p>
              <h3 className="text-base font-black text-on-surface dark:text-white mt-0.5">
                {latestRecord?.temperature ? `${latestRecord.temperature} °C` : '—'}
              </h3>
            </div>
          </div>
        </div>

        {/* Medical Warnings */}
        {(student.allergies || student.medical_notes) && (
          <div className="p-4 bg-red-50/40 border border-red-100 rounded-2xl space-y-2">
            <h4 className="text-xs font-extrabold text-red-600 flex items-center gap-1.5 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              Lưu ý y tế đặc biệt từ hồ sơ
            </h4>
            {student.allergies && (
              <p className="text-xs text-on-surface font-semibold">
                <span className="font-bold text-red-700">Dị ứng: </span>{student.allergies}
              </p>
            )}
            {student.medical_notes && (
              <p className="text-xs text-on-surface font-semibold">
                <span className="font-bold text-on-surface-variant">Bệnh nền / Lưu ý: </span>{student.medical_notes}
              </p>
            )}
          </div>
        )}

        {/* Growth Chart */}
        {rawRecords.length > 0 ? (
          <div className="bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-2xs space-y-4">
            <h3 className="text-xs font-extrabold text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-primary" />
              Biểu đồ phát triển thể chất
            </h3>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#3b82f6" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                  <Line yAxisId="left" type="monotone" dataKey="Chiều cao (cm)" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 5 }} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="Cân nặng (kg)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {/* Lịch sử khám sức khỏe */}
        <div className="bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-2xs space-y-4">
          <h3 className="text-xs font-extrabold text-primary uppercase tracking-wider">Lịch sử lượt khám sức khỏe</h3>
          
          {isLoadingRecords ? (
            <div className="space-y-2 py-4 animate-pulse">
              <div className="h-14 bg-surface-container rounded-xl" />
              <div className="h-14 bg-surface-container rounded-xl" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-outline-variant rounded-xl text-on-surface-variant">
              <Heart className="w-8 h-8 mx-auto text-on-surface-variant/40 mb-2" />
              <span className="text-xs font-bold">Chưa có lượt khám nào</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {records.map((rec: any) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-xl border border-outline-variant/20 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span className="font-bold text-on-surface">
                        {formatDate(rec.record_date)}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                        rec.health_status === 'Bình thường'
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                      )}>
                        {rec.health_status}
                      </span>
                    </div>

                    <p className="text-on-surface-variant font-medium">
                      Chiều cao: <span className="font-bold text-on-surface">{rec.height_cm} cm</span> | 
                      Cân nặng: <span className="font-bold text-on-surface">{rec.weight_kg} kg</span> 
                      {rec.temperature && (
                        <> | Thân nhiệt: <span className="font-bold text-on-surface">{rec.temperature} °C</span></>
                      )}
                      {rec.blood_type && (
                        <> | Nhóm máu: <span className="font-bold text-on-surface">{rec.blood_type}</span></>
                      )}
                    </p>

                    {rec.vaccination_info && (
                      <div className="flex items-start gap-1.5 text-on-surface">
                        <Syringe className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-on-surface-variant">Tiêm chủng: </span>
                          {rec.vaccination_info}
                        </div>
                      </div>
                    )}

                    {rec.notes && (
                      <div className="flex items-start gap-1.5 text-on-surface">
                        <FileText className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-on-surface-variant">Ghi chú y tế: </span>
                          {rec.notes}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-start select-none">
                    <button
                      onClick={() => handleEditRecord(rec)}
                      className="p-1.5 hover:bg-white rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer border border-outline-variant/30 bg-white/50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRecord(rec);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600 transition-all cursor-pointer border border-red-100 bg-white/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteRecord}
        title="Xóa lượt khám y tế?"
        message="Bạn có chắc chắn muốn xóa lượt khám sức khỏe này? Dữ liệu tăng trưởng sẽ bị ảnh hưởng trên biểu đồ phát triển thể chất của trẻ."
        confirmText="Xóa bản ghi"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
};
