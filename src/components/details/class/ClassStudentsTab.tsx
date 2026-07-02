import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Users } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Modal, Select } from '../../ui';
import { toast } from '../../../stores/toastStore';
import { cn } from '../../../lib/utils';
import type { StudentRow } from '../../../types';

interface ClassStudentsTabProps {
  classId: string;
  className: string;
  students: StudentRow[];
  isLoadingStudents: boolean;
  classesList: { id: string; name: string; grade_level: string }[];
  selectedStudentIds: Set<string>;
  setSelectedStudentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  refetchStudents: () => void;
  getGradeLabel: (grade: string) => string;
}

export const ClassStudentsTab: React.FC<ClassStudentsTabProps> = ({
  classId,
  className,
  students,
  isLoadingStudents,
  classesList,
  selectedStudentIds,
  setSelectedStudentIds,
  refetchStudents,
  getGradeLabel,
}) => {
  const queryClient = useQueryClient();

  // Student transfer states
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const handleTransferClick = (student: StudentRow) => {
    setSelectedStudent(student);
    setTargetClassId('');
    setIsTransferOpen(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !targetClassId) return;
    setIsTransferring(true);
    try {
      const res = await api.update('students', selectedStudent.id, {
        class_id: targetClassId,
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);

      toast.success(`Chuyển lớp thành công cho học sinh ${selectedStudent.full_name}!`);
      refetchStudents();
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsTransferOpen(false);
    } catch (err) {
      toast.error('Lỗi khi chuyển lớp học', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setIsTransferring(false);
    }
  };

  const handleBulkTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.size === 0 || !targetClassId) return;
    setIsTransferring(true);
    try {
      const promises = Array.from(selectedStudentIds).map((studentId) =>
        api.update('students', studentId, {
          class_id: targetClassId,
          updated_at: new Date().toISOString(),
        })
      );
      await Promise.all(promises);

      toast.success(`Đã chuyển lớp thành công cho ${selectedStudentIds.size} học sinh!`);
      setSelectedStudentIds(new Set());
      refetchStudents();
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
      setIsBulkTransferOpen(false);
    } catch (err) {
      toast.error('Lỗi khi chuyển lớp hàng loạt', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in bg-white p-5 rounded-2xl border border-outline-variant/40 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        <h4 className="text-[13px] font-extrabold text-primary uppercase tracking-wider">
          Danh sách học sinh hoạt động
        </h4>
        {selectedStudentIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              setTargetClassId('');
              setIsBulkTransferOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer select-none shrink-0 whitespace-nowrap"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Chuyển lớp hàng loạt ({selectedStudentIds.size})
          </button>
        )}
      </div>

      {isLoadingStudents ? (
        <div className="space-y-2 py-4 animate-pulse">
          <div className="h-10 bg-surface-container rounded-xl" />
          <div className="h-10 bg-surface-container rounded-xl" />
          <div className="h-10 bg-surface-container rounded-xl" />
        </div>
      ) : students.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-outline-variant rounded-2xl text-on-surface-variant space-y-2">
          <Users className="w-8 h-8 mx-auto text-on-surface-variant/40" />
          <p className="text-[13px] font-bold">Lớp chưa có học sinh</p>
          <p className="text-[11px] text-on-surface-variant/80 px-4">
            Hãy xếp lớp cho trẻ từ mục chờ xếp lớp ngoài trang quản lý chính.
          </p>
        </div>
      ) : (
        <div className="border border-outline-variant/30 rounded-2xl overflow-hidden bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/30 select-none text-[12px] text-on-surface-variant uppercase tracking-wider font-extrabold">
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={students.length > 0 && selectedStudentIds.size === students.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudentIds(new Set(students.map((s) => s.id)));
                      } else {
                        setSelectedStudentIds(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded border-outline accent-primary cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-xs">Mã HS</th>
                <th className="px-4 py-3 font-semibold text-xs">Họ và tên</th>
                <th className="px-4 py-3 font-semibold text-xs">Giới tính</th>
                <th className="px-4 py-3 font-semibold text-xs">Ngày sinh</th>
                <th className="px-4 py-3 font-semibold text-xs text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-medium text-[13.5px]">
              {students.map((student) => {
                const isChecked = selectedStudentIds.has(student.id);
                return (
                  <tr key={student.id} className="hover:bg-surface-container-lowest/50 transition-all">
                    <td className="w-12 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const next = new Set(selectedStudentIds);
                          if (next.has(student.id)) {
                            next.delete(student.id);
                          } else {
                            next.add(student.id);
                          }
                          setSelectedStudentIds(next);
                        }}
                        className="w-4 h-4 rounded border-outline accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-on-surface font-semibold">
                      {student.student_code}
                    </td>
                    <td className="px-4 py-3 font-semibold text-on-surface">
                      {student.full_name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-semibold',
                          student.gender === 'male'
                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                            : 'bg-pink-50 text-pink-700 border border-pink-100'
                        )}
                      >
                        {student.gender === 'male' ? 'Nam' : 'Nữ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      {student.date_of_birth
                        ? new Date(student.date_of_birth).toLocaleDateString('vi-VN')
                        : '---'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleTransferClick(student)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface hover:text-primary rounded-xl text-xs font-semibold border border-outline-variant/40 transition-all cursor-pointer select-none"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Chuyển lớp
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Class Transfer Modal */}
      {isTransferOpen && selectedStudent && (
        <Modal
          open={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          title="Chuyển lớp học sinh"
          size="md"
        >
          <form onSubmit={handleTransferSubmit} className="space-y-5 select-none">
            <div className="p-4 rounded-2xl bg-primary-container/10 border border-primary/20 space-y-2">
              <p className="text-sm font-semibold text-on-surface">
                Học sinh: <span className="font-bold text-primary">{selectedStudent.full_name}</span>
              </p>
              <p className="text-xs text-on-surface-variant">
                Lớp hiện tại: <span className="font-semibold text-on-surface">{className}</span>
              </p>
            </div>

            <Select
              label="Chọn lớp chuyển đến"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn lớp học mới --' },
                ...classesList
                  .filter((c) => c.id !== classId)
                  .map((c) => {
                    const gradeLabel = getGradeLabel(c.grade_level);
                    return {
                      value: c.id,
                      label: gradeLabel ? `${c.name} (Khối ${gradeLabel})` : c.name,
                    };
                  }),
              ]}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setIsTransferOpen(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
                disabled={isTransferring}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!targetClassId || isTransferring}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                {isTransferring ? 'Đang thực hiện...' : 'Xác nhận chuyển'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Student Bulk Class Transfer Modal */}
      {isBulkTransferOpen && selectedStudentIds.size > 0 && (
        <Modal
          open={isBulkTransferOpen}
          onClose={() => setIsBulkTransferOpen(false)}
          title="Chuyển lớp hàng loạt cho học sinh"
          size="md"
        >
          <form onSubmit={handleBulkTransferSubmit} className="space-y-5 select-none">
            <div className="p-4 rounded-2xl bg-primary-container/10 border border-primary/20 space-y-2">
              <p className="text-sm font-semibold text-on-surface">
                Số học sinh được chọn:{' '}
                <span className="font-bold text-primary">{selectedStudentIds.size} học sinh</span>
              </p>
              <p className="text-xs text-on-surface-variant">
                Lớp hiện tại: <span className="font-semibold text-on-surface">{className}</span>
              </p>
            </div>

            <Select
              label="Chọn lớp chuyển đến"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              options={[
                { value: '', label: '-- Chọn lớp học mới --' },
                ...classesList
                  .filter((c) => c.id !== classId)
                  .map((c) => {
                    const gradeLabel = getGradeLabel(c.grade_level);
                    return {
                      value: c.id,
                      label: gradeLabel ? `${c.name} (Khối ${gradeLabel})` : c.name,
                    };
                  }),
              ]}
              required
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40 shrink-0">
              <button
                type="button"
                onClick={() => setIsBulkTransferOpen(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
                disabled={isTransferring}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!targetClassId || isTransferring}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                {isTransferring ? 'Đang thực hiện...' : 'Xác nhận chuyển'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
