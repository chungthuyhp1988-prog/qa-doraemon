import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Heart, 
  Ruler, 
  Scale, 
  Thermometer, 
  Activity, 
  Calendar, 
  Edit2, 
  Trash2,
  Syringe,
  ChevronRight,
  TrendingUp,
  FileText,
  ShieldAlert
} from "lucide-react";
import { cn } from "../lib/utils";
import { api } from "../lib/api";
import { toast } from "../stores/toastStore";
import { ConfirmDialog } from "../components/ui";
import { HealthRecordForm } from "../components/forms/HealthRecordForm";
import { useAppStore } from "../stores/appStore";
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

export function Health() {
  const queryClient = useQueryClient();
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);

  // States
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Modal / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
  if (selectedClassId === "all" && classesList.length > 0) {
    setSelectedClassId(classesList[0].id);
  }

  // 2. Fetch students list based on selected class and search
  const { data: studentsResponse, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['health-students-list', selectedClassId, search],
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

  // 3. Fetch health records of selected student
  const { data: healthResponse, isLoading: isLoadingRecords } = useQuery({
    queryKey: ['health-records', selectedStudentId],
    queryFn: () => {
      if (!selectedStudentId) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>(
        'health_records',
        { page: 1, pageSize: 100, sortBy: 'record_date', sortOrder: 'asc' },
        { filters: { student_id: selectedStudentId } }
      );
    },
    enabled: !!selectedStudentId
  });
  const rawRecords = healthResponse?.data?.data || [];
  
  // Records for chart (ascending date order)
  const chartData = rawRecords.map((r: any) => ({
    date: r.record_date ? new Date(r.record_date).toLocaleDateString('vi-VN', { month: '2-digit', year: '2-digit' }) : '',
    'Chiều cao (cm)': r.height_cm,
    'Cân nặng (kg)': r.weight_kg,
  }));

  // Records for list (descending date order)
  const records = [...rawRecords].sort((a: any, b: any) => 
    new Date(b.record_date).getTime() - new Date(a.record_date).getTime()
  );

  const handleCreateClick = () => {
    setSelectedRecord(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (rec: any) => {
    setSelectedRecord(rec);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (rec: any) => {
    setSelectedRecord(rec);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedRecord) return;
    setIsDeleting(true);
    try {
      const res = await api.remove('health_records', selectedRecord.id);
      if (res.error) throw new Error(res.error);
      
      toast.success('Xóa hồ sơ sức khỏe thành công!');
      queryClient.invalidateQueries({ queryKey: ['health-records', selectedStudentId] });
      setIsDeleteDialogOpen(false);
    } catch (err: any) {
      toast.error('Lỗi khi xóa hồ sơ', err.message || 'Lỗi hệ thống');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get latest record metrics
  const latestRecord = records[0];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Sức Khỏe & Phát Triển</h1>
          <p className="text-sm text-on-surface-variant">
            Theo dõi sự tăng trưởng chiều cao, cân nặng, lịch sử tiêm chủng và ghi chú y tế của trẻ.
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          disabled={!activeStudent}
          className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm Lượt Khám
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Panel: Student Selector list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="grid grid-cols-1 gap-2.5">
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedStudentId(null); // Reset selected student on class change
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
              <Heart className="w-8 h-8 text-on-surface-variant/40 mb-2" />
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

        {/* Right Panel: Selected student growth charts & record details */}
        <div className="lg:col-span-2 space-y-6">
          {activeStudent ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-outline-variant/20 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-on-surface">{activeStudent.full_name}</h2>
                    <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                      Mã HS: <span className="text-on-surface font-semibold">{activeStudent.student_code}</span> | 
                      Giới tính: <span className="text-on-surface font-semibold">{activeStudent.gender === 'male' ? 'Nam' : 'Nữ'}</span> | 
                      Ngày sinh: <span className="text-on-surface font-semibold">{activeStudent.date_of_birth ? new Date(activeStudent.date_of_birth).toLocaleDateString('vi-VN') : '---'}</span>
                    </p>
                  </div>
                  {latestRecord && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold uppercase tracking-wider">
                      <Activity className="w-3.5 h-3.5" />
                      {latestRecord.health_status}
                    </span>
                  )}
                </div>

                {/* Key parameters grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-info-container/40 flex items-center justify-center text-info">
                      <Ruler className="w-5.5 h-5.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-on-surface-variant font-medium">Chiều cao gần nhất</p>
                      <h3 className="text-lg font-bold text-on-surface mt-0.5">
                        {latestRecord?.height_cm ? `${latestRecord.height_cm} cm` : '---'}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Scale className="w-5.5 h-5.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-on-surface-variant font-medium">Cân nặng gần nhất</p>
                      <h3 className="text-lg font-bold text-on-surface mt-0.5">
                        {latestRecord?.weight_kg ? `${latestRecord.weight_kg} kg` : '---'}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-warning-container/30 flex items-center justify-center text-warning">
                      <Thermometer className="w-5.5 h-5.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs text-on-surface-variant font-medium">Thân nhiệt gần nhất</p>
                      <h3 className="text-lg font-bold text-on-surface mt-0.5">
                        {latestRecord?.temperature ? `${latestRecord.temperature} °C` : '---'}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Medical alert or notes from profile */}
                {(activeStudent.allergies || activeStudent.medical_notes) && (
                  <div className="mt-4 p-4 rounded-2xl bg-error-container/10 border border-error-container/20 space-y-2">
                    <h4 className="text-xs font-bold text-error flex items-center gap-1.5 uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      Lưu ý y tế đặc biệt
                    </h4>
                    {activeStudent.allergies && (
                      <p className="text-xs text-on-surface font-medium">
                        <span className="font-semibold text-error">Dị ứng: </span>{activeStudent.allergies}
                      </p>
                    )}
                    {activeStudent.medical_notes && (
                      <p className="text-xs text-on-surface font-medium">
                        <span className="font-semibold text-on-surface-variant">Bệnh lý / Lưu ý: </span>{activeStudent.medical_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Growth Charts */}
              {rawRecords.length > 0 && (
                <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6">
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5 mb-6">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Biểu Đồ Phát Triển Thể Chất
                  </h3>

                  <div className="h-64 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis yAxisId="left" stroke="#3b82f6" fontSize={11} tickLine={false} label={{ value: 'Chiều cao (cm)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#3b82f6', fontSize: 10, fontWeight: 600 } }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} tickLine={false} label={{ value: 'Cân nặng (kg)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#10b981', fontSize: 10, fontWeight: 600 } }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 500 }} />
                        <Line yAxisId="left" type="monotone" dataKey="Chiều cao (cm)" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ r: 4 }} />
                        <Line yAxisId="right" type="monotone" dataKey="Cân nặng (kg)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Records History */}
              <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-on-surface">Lịch sử lượt khám sức khỏe</h3>

                {isLoadingRecords ? (
                  <div className="space-y-2">
                    {[1, 2].map(i => (
                      <div key={i} className="h-16 bg-surface-container-low rounded-2xl animate-pulse" />
                    ))}
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/10">
                    <Heart className="w-8 h-8 text-on-surface-variant/40 mb-2" />
                    <span className="text-sm text-on-surface-variant">Chưa có lượt khám sức khỏe nào được ghi nhận.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {records.map((rec: any) => (
                      <div
                        key={rec.id}
                        className="p-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-on-surface">
                              {new Date(rec.record_date).toLocaleDateString('vi-VN')}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                              rec.health_status === 'Bình thường'
                                ? 'bg-success-container/20 border-success/30 text-success'
                                : 'bg-warning-container/20 border-warning/30 text-warning'
                            )}>
                              {rec.health_status}
                            </span>
                          </div>

                          <p className="text-xs text-on-surface-variant font-medium">
                            Chiều cao: <span className="font-semibold text-on-surface">{rec.height_cm} cm</span> | 
                            Cân nặng: <span className="font-semibold text-on-surface">{rec.weight_kg} kg</span> 
                            {rec.temperature && (
                              <> | Thân nhiệt: <span className="font-semibold text-on-surface">{rec.temperature} °C</span></>
                            )}
                            {rec.blood_type && (
                              <> | Nhóm máu: <span className="font-semibold text-on-surface">{rec.blood_type}</span></>
                            )}
                          </p>

                          {rec.vaccination_info && (
                            <div className="flex items-start gap-1.5 text-xs text-on-surface">
                              <Syringe className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-on-surface-variant">Tiêm chủng: </span>
                                {rec.vaccination_info}
                              </div>
                            </div>
                          )}

                          {rec.notes && (
                            <div className="flex items-start gap-1.5 text-xs text-on-surface">
                              <FileText className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-on-surface-variant">Ghi chú y khoa: </span>
                                {rec.notes}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-start">
                          <button
                            onClick={() => handleEditClick(rec)}
                            className="p-2 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-on-surface transition-all cursor-pointer border border-outline-variant/30"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(rec)}
                            className="p-2 hover:bg-error-container/20 rounded-xl text-on-surface-variant hover:text-error transition-all cursor-pointer border border-outline-variant/30"
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
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-outline-variant/60 rounded-3xl bg-surface-container-low/20">
              <Heart className="w-12 h-12 text-on-surface-variant/40 mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-on-surface mb-1">Chưa chọn học sinh</h3>
              <p className="text-sm text-on-surface-variant">Chọn một học sinh từ danh sách bên trái để theo dõi sức khỏe.</p>
            </div>
          )}
        </div>
      </div>

      {/* Health Form Modal */}
      {isFormOpen && (
        <HealthRecordForm
          open={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          record={selectedRecord}
          studentsList={students}
          preselectedStudentId={selectedStudentId || undefined}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title="Xóa hồ sơ sức khỏe?"
        message="Bạn có chắc chắn muốn xóa lượt khám sức khỏe này? Dữ liệu tăng trưởng sẽ bị ảnh hưởng trên biểu đồ."
        confirmText="Xóa bản ghi"
        cancelText="Hủy"
        variant="danger"
        isConfirming={isDeleting}
      />
    </div>
  );
}
