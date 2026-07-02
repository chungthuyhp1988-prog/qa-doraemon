import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Table as TableIcon, MessageSquare, Edit2, Users } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../../lib/api';
import { Button, Modal, DatePicker, EmptyState } from '../../ui';
import { toast } from '../../../stores/toastStore';
import { cn } from '../../../lib/utils';
import type { StudentRow, AttendanceRow } from '../../../types';

interface ClassRollCallTabProps {
  classId: string;
  students: StudentRow[];
  currentUserId: string | null;
  getInitials: (name: string) => string;
}

export const ClassRollCallTab: React.FC<ClassRollCallTabProps> = ({
  classId,
  students,
  currentUserId,
  getInitials,
}) => {
  const queryClient = useQueryClient();

  // Roll call states
  const [rollCallDate, setRollCallDate] = useState<Date>(new Date());
  const [rollCallViewMode, setRollCallViewMode] = useState<'grid' | 'table'>('grid');
  const [isRollCallNoteModalOpen, setIsRollCallNoteModalOpen] = useState(false);
  const [selectedStudentForRollCallNote, setSelectedStudentForRollCallNote] = useState<StudentRow | null>(null);
  const [rollCallTempNote, setRollCallTempNote] = useState('');

  const formattedRollCallDate = format(rollCallDate, 'yyyy-MM-dd');

  // Fetch roll call records
  const { data: rollCallAttendanceResponse, isLoading: isLoadingRollCallAttendance } = useQuery({
    queryKey: ['attendance-records', classId, formattedRollCallDate],
    queryFn: () =>
      api.getAll(
        'attendance',
        { page: 1, pageSize: 200 },
        { filters: { class_id: classId, date: formattedRollCallDate } }
      ),
    enabled: !!classId && !!formattedRollCallDate,
  });
  const rollCallRecords = (rollCallAttendanceResponse?.data?.data || []) as AttendanceRow[];

  // Build roll call records map
  const rollCallMap = new Map<string, AttendanceRow>();
  rollCallRecords.forEach((record) => {
    rollCallMap.set(record.student_id, record);
  });

  // Roll Call mutations
  const saveRollCallMutation = useMutation({
    mutationFn: async ({
      studentId,
      status,
      note,
      checkInTime,
      recordId,
    }: {
      studentId: string;
      status: 'present' | 'absent' | 'late' | 'sick' | 'excused';
      note?: string | null;
      checkInTime?: string | null;
      recordId?: string | null;
    }) => {
      const payload = {
        student_id: studentId,
        class_id: classId,
        date: formattedRollCallDate,
        status,
        check_in_time:
          checkInTime !== undefined
            ? checkInTime
            : status === 'present' || status === 'late'
            ? '08:00:00'
            : null,
        note: note !== undefined ? note : null,
        recorded_by: currentUserId,
        updated_at: new Date().toISOString(),
      };

      if (recordId) {
        return api.update('attendance', recordId, payload);
      } else {
        return api.create('attendance', payload);
      }
    },
    onSuccess: (res) => {
      if (res.error) {
        toast.error('Lỗi khi lưu điểm danh', res.error);
      } else {
        queryClient.invalidateQueries({
          queryKey: ['attendance-records', classId, formattedRollCallDate],
        });
        queryClient.invalidateQueries({ queryKey: ['class-attendance-stats', classId] });
      }
    },
    onError: (error) => {
      toast.error('Lỗi khi lưu điểm danh', error instanceof Error ? error.message : 'Lỗi hệ thống');
    },
  });

  const bulkRollCallMutation = useMutation({
    mutationFn: async (status: 'present' | 'absent') => {
      const promises = students.map((student) => {
        const existingRecord = rollCallMap.get(student.id);
        const payload = {
          student_id: student.id,
          class_id: classId,
          date: formattedRollCallDate,
          status,
          check_in_time: status === 'present' ? '08:00:00' : null,
          recorded_by: currentUserId,
          updated_at: new Date().toISOString(),
        };

        if (existingRecord) {
          return api.update('attendance', existingRecord.id, payload);
        } else {
          return api.create('attendance', payload);
        }
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Điểm danh hàng loạt thành công!');
      queryClient.invalidateQueries({
        queryKey: ['attendance-records', classId, formattedRollCallDate],
      });
      queryClient.invalidateQueries({ queryKey: ['class-attendance-stats', classId] });
    },
    onError: (error) => {
      toast.error(
        'Lỗi khi điểm danh hàng loạt',
        error instanceof Error ? error.message : 'Lỗi hệ thống'
      );
    },
  });

  const handleRollCallStatusChange = (
    studentId: string,
    status: 'present' | 'absent' | 'late' | 'sick' | 'excused'
  ) => {
    const existingRecord = rollCallMap.get(studentId);
    saveRollCallMutation.mutate({
      studentId,
      status,
      note: existingRecord?.note || null,
      checkInTime: existingRecord?.check_in_time || null,
      recordId: existingRecord?.id,
    });
  };

  const handleSaveRollCallNote = () => {
    if (!selectedStudentForRollCallNote) return;
    const existingRecord = rollCallMap.get(selectedStudentForRollCallNote.id);
    const status = existingRecord?.status || 'present';

    saveRollCallMutation.mutate(
      {
        studentId: selectedStudentForRollCallNote.id,
        status,
        note: rollCallTempNote,
        checkInTime: existingRecord?.check_in_time || null,
        recordId: existingRecord?.id,
      },
      {
        onSuccess: () => {
          setIsRollCallNoteModalOpen(false);
          setSelectedStudentForRollCallNote(null);
          setRollCallTempNote('');
          toast.success('Đã lưu ghi chú!');
        },
      }
    );
  };

  // Daily stats calculations
  const totalRollCallStudents = students.length;
  let rcPresentCount = 0;
  let rcAbsentCount = 0;
  let rcLateCount = 0;
  let rcSickCount = 0;
  let rcExcusedCount = 0;

  students.forEach((s) => {
    const rec = rollCallMap.get(s.id);
    if (rec) {
      if (rec.status === 'present') rcPresentCount++;
      else if (rec.status === 'absent') rcAbsentCount++;
      else if (rec.status === 'late') rcLateCount++;
      else if (rec.status === 'sick') rcSickCount++;
      else if (rec.status === 'excused') rcExcusedCount++;
    }
  });

  const rcUnmarkedCount =
    totalRollCallStudents - (rcPresentCount + rcAbsentCount + rcLateCount + rcSickCount + rcExcusedCount);

  return (
    <div className="space-y-6 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/30 p-4 rounded-2xl border border-outline-variant/20">
        <div className="w-full sm:w-56 shrink-0">
          <DatePicker
            label="Chọn ngày điểm danh"
            value={rollCallDate}
            onChange={(date) => date && setRollCallDate(date)}
            maxDate={format(new Date(), 'yyyy-MM-dd')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ml-auto select-none">
          <Button
            type="button"
            variant="outline"
            onClick={() => bulkRollCallMutation.mutate('present')}
            disabled={students.length === 0 || bulkRollCallMutation.isPending}
            className="flex-1 sm:flex-none rounded-xl text-green-700 border-green-200 hover:bg-green-50/50 cursor-pointer font-semibold py-1.5 px-3 text-xs"
          >
            Có mặt tất cả
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => bulkRollCallMutation.mutate('absent')}
            disabled={students.length === 0 || bulkRollCallMutation.isPending}
            className="flex-1 sm:flex-none rounded-xl text-rose-700 border-rose-200 hover:bg-rose-50/50 cursor-pointer font-semibold py-1.5 px-3 text-xs"
          >
            Vắng tất cả
          </Button>

          {/* View mode toggle */}
          <div className="flex items-center bg-surface-container border border-outline-variant/60 rounded-xl p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setRollCallViewMode('grid')}
              className={cn(
                'p-1.5 rounded-lg transition-all cursor-pointer',
                rollCallViewMode === 'grid'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
              title="Xem dạng lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setRollCallViewMode('table')}
              className={cn(
                'p-1.5 rounded-lg transition-all cursor-pointer',
                rollCallViewMode === 'table'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
              title="Xem dạng bảng"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Daily statistics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 select-none">
        <div className="bg-surface-container-low/50 rounded-xl border border-outline-variant/20 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Tổng sĩ số
          </span>
          <span className="block text-xl font-bold font-playfair text-on-surface mt-1">
            {totalRollCallStudents}
          </span>
        </div>
        <div className="bg-green-50/30 rounded-xl border border-green-100 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Có mặt</span>
          <span className="block text-xl font-bold font-playfair text-green-700 mt-1">
            {rcPresentCount}
          </span>
        </div>
        <div className="bg-rose-50/30 rounded-xl border border-rose-100 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Vắng</span>
          <span className="block text-xl font-bold font-playfair text-rose-700 mt-1">
            {rcAbsentCount}
          </span>
        </div>
        <div className="bg-amber-50/30 rounded-xl border border-amber-100 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 font-semibold">
            Đi trễ
          </span>
          <span className="block text-xl font-bold font-playfair text-amber-700 mt-1">
            {rcLateCount}
          </span>
        </div>
        <div className="bg-purple-50/30 rounded-xl border border-purple-100 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 font-semibold">
            Phép/Bệnh
          </span>
          <span className="block text-xl font-bold font-playfair text-purple-700 mt-1">
            {rcExcusedCount + rcSickCount}
          </span>
        </div>
        <div className="bg-slate-50/50 rounded-xl border border-slate-200/40 p-3 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chưa báo</span>
          <span className="block text-xl font-bold font-playfair text-slate-600 mt-1">
            {rcUnmarkedCount}
          </span>
        </div>
      </div>

      {/* Students roll call listing */}
      {isLoadingRollCallAttendance ? (
        <div className="space-y-3 py-6 animate-pulse">
          <div className="h-12 bg-surface-container rounded-xl" />
          <div className="h-12 bg-surface-container rounded-xl" />
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          title="Không có học sinh"
          description="Lớp học này hiện tại chưa có học sinh hoạt động nào hoặc chưa được phân lớp."
          icon={<Users className="w-12 h-12" />}
        />
      ) : rollCallViewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {students.map((student) => {
            const attendanceRecord = rollCallMap.get(student.id);
            const status = attendanceRecord?.status;
            const note = attendanceRecord?.note;

            return (
              <div
                key={student.id}
                className={cn(
                  'bg-surface rounded-2xl border p-4 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between relative group',
                  status === 'present' && 'border-green-200/50 bg-green-50/5',
                  status === 'absent' && 'border-rose-200/50 bg-rose-50/5',
                  status === 'late' && 'border-amber-200/50 bg-amber-50/5',
                  (status === 'sick' || status === 'excused') && 'border-purple-200/50 bg-purple-50/5',
                  !status && 'border-outline-variant/20'
                )}
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/40 shrink-0 bg-primary/5 flex items-center justify-center">
                      {student.profile_image_url ? (
                        <img
                          src={student.profile_image_url}
                          alt={student.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-primary font-playfair">
                          {getInitials(student.full_name)}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-[14.5px] font-bold font-playfair text-on-surface line-clamp-1 leading-tight"
                        title={student.full_name}
                      >
                        {student.full_name}
                      </h4>
                      <p className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                        {student.student_code}
                      </p>
                    </div>

                    {status && (
                      <span
                        className={cn(
                          'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                          status === 'present' && 'bg-green-50 text-green-700 border-green-200',
                          status === 'absent' && 'bg-rose-50 text-rose-700 border-rose-200',
                          status === 'late' && 'bg-amber-50 text-amber-700 border-amber-200',
                          (status === 'sick' || status === 'excused') &&
                            'bg-purple-50 text-purple-700 border-purple-200'
                        )}
                      >
                        {status === 'present'
                          ? 'Có mặt'
                          : status === 'absent'
                          ? 'Vắng'
                          : status === 'late'
                          ? 'Trễ'
                          : status === 'sick'
                          ? 'Bệnh'
                          : 'Phép'}
                      </span>
                    )}
                  </div>

                  {note && (
                    <div className="mt-2.5 bg-surface-container-low/40 border border-outline-variant/20 rounded-xl p-2 flex gap-1.5 items-start text-xs text-on-surface-variant">
                      <MessageSquare className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span className="line-clamp-2 select-text">{note}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-outline-variant/10 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => handleRollCallStatusChange(student.id, 'present')}
                      className={cn(
                        'flex-1 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                        status === 'present'
                          ? 'bg-green-600 border-green-600 text-white shadow-xs'
                          : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                      )}
                    >
                      Có mặt
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRollCallStatusChange(student.id, 'absent')}
                      className={cn(
                        'flex-1 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer',
                        status === 'absent'
                          ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                          : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                      )}
                    >
                      Vắng
                    </button>

                    <select
                      value={status && ['late', 'sick', 'excused'].includes(status) ? status : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleRollCallStatusChange(student.id, e.target.value as any);
                        }
                      }}
                      className={cn(
                        'px-1.5 py-1 rounded-lg text-xs font-bold border focus:outline-none cursor-pointer bg-white text-on-surface-variant border-outline-variant/30 hover:bg-surface-container',
                        status &&
                          ['late', 'sick', 'excused'].includes(status) &&
                          'bg-purple-600 border-purple-600 text-white hover:bg-purple-600'
                      )}
                    >
                      <option value="" disabled className="text-on-surface-variant bg-white font-medium">
                        Khác
                      </option>
                      <option value="late" className="text-on-surface bg-white font-semibold">
                        Đi trễ
                      </option>
                      <option value="excused" className="text-on-surface bg-white font-semibold">
                        Có phép
                      </option>
                      <option value="sick" className="text-on-surface bg-white font-semibold">
                        Nghỉ bệnh
                      </option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentForRollCallNote(student);
                      setRollCallTempNote(note || '');
                      setIsRollCallNoteModalOpen(true);
                    }}
                    className="p-1.5 border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                    title="Thêm ghi chú"
                  >
                    <Edit2 className="w-3 h-3 text-on-surface-variant" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30 select-none">
                  <th className="px-3 py-3 text-center w-12 font-bold">STT</th>
                  <th className="px-3 py-3 min-w-[150px] font-bold">Học sinh</th>
                  <th className="px-3 py-3 min-w-[280px] font-bold">Điểm danh</th>
                  <th className="px-3 py-3 min-w-[140px] font-bold">Ghi chú</th>
                  <th className="px-3 py-3 text-right w-16 font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {students.map((student, index) => {
                  const attendanceRecord = rollCallMap.get(student.id);
                  const status = attendanceRecord?.status;
                  const note = attendanceRecord?.note;

                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        'transition-colors hover:bg-surface-container-low/20',
                        status === 'present' && 'bg-green-50/2',
                        status === 'absent' && 'bg-rose-50/2',
                        status === 'late' && 'bg-amber-50/2',
                        (status === 'sick' || status === 'excused') && 'bg-purple-50/2'
                      )}
                    >
                      <td className="px-3 py-3 text-center font-semibold text-on-surface-variant/75">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/40 shrink-0 bg-primary/5 flex items-center justify-center">
                            {student.profile_image_url ? (
                              <img
                                src={student.profile_image_url}
                                alt={student.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-primary font-playfair">
                                {getInitials(student.full_name)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4
                              className="text-xs font-bold font-playfair text-on-surface truncate leading-tight"
                              title={student.full_name}
                            >
                              {student.full_name}
                            </h4>
                            <p className="text-[9px] font-semibold text-on-surface-variant/60 uppercase tracking-widest mt-0.5">
                              {student.student_code}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'present')}
                            className={cn(
                              'px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none',
                              status === 'present'
                                ? 'bg-green-600 border-green-600 text-white shadow-xs'
                                : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                            )}
                          >
                            Có mặt
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'absent')}
                            className={cn(
                              'px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none',
                              status === 'absent'
                                ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                                : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                            )}
                          >
                            Vắng
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'late')}
                            className={cn(
                              'px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none',
                              status === 'late'
                                ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                                : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                            )}
                          >
                            Đi trễ
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'excused')}
                            className={cn(
                              'px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none',
                              status === 'excused'
                                ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                                : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                            )}
                          >
                            Có phép
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRollCallStatusChange(student.id, 'sick')}
                            className={cn(
                              'px-2 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none',
                              status === 'sick'
                                ? 'bg-violet-600 border-violet-600 text-white shadow-xs'
                                : 'bg-white border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
                            )}
                          >
                            Bệnh
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {note ? (
                          <div
                            className="flex items-start gap-1 text-[11px] text-on-surface-variant max-w-[200px]"
                            title={note}
                          >
                            <MessageSquare className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                            <span className="line-clamp-1 select-text">{note}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant/40 italic select-none">
                            Chưa có ghi chú
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentForRollCallNote(student);
                            setRollCallTempNote(note || '');
                            setIsRollCallNoteModalOpen(true);
                          }}
                          className="p-1 border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors cursor-pointer inline-flex"
                          title="Thêm ghi chú"
                        >
                          <Edit2 className="w-3 h-3 text-on-surface-variant" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roll Call Note Modal */}
      {isRollCallNoteModalOpen && selectedStudentForRollCallNote && (
        <Modal
          open={isRollCallNoteModalOpen}
          onClose={() => {
            setIsRollCallNoteModalOpen(false);
            setSelectedStudentForRollCallNote(null);
          }}
          title="Thêm ghi chú điểm danh"
          size="sm"
        >
          <div className="space-y-4 select-none">
            <div className="flex items-center gap-3 bg-surface-container-low p-3 rounded-2xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold font-playfair text-primary">
                {getInitials(selectedStudentForRollCallNote.full_name)}
              </div>
              <div>
                <span className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                  Học sinh
                </span>
                <h4 className="text-sm font-bold text-on-surface font-inter mt-0.5">
                  {selectedStudentForRollCallNote.full_name}
                </h4>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-on-surface tracking-[0.01em]">
                Nội dung ghi chú
              </label>
              <textarea
                value={rollCallTempNote}
                onChange={(e) => setRollCallTempNote(e.target.value)}
                placeholder="Nhập ghi chú ví dụ: nghỉ ốm sốt nhẹ, phụ huynh đón sớm..."
                className="w-full rounded-xl border border-outline-variant hover:border-outline bg-surface-container-lowest font-inter text-sm p-3 text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRollCallNoteModalOpen(false);
                  setSelectedStudentForRollCallNote(null);
                }}
                className="rounded-xl cursor-pointer"
              >
                Hủy
              </Button>
              <Button type="button" onClick={handleSaveRollCallNote} className="rounded-xl cursor-pointer">
                Lưu ghi chú
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
