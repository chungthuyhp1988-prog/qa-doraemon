import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, Plus, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../stores/toastStore';
import { useQueryClient } from '@tanstack/react-query';
import { Table, Modal, Input } from '../ui';
import type { AcademicYearRow, SchoolRow } from '../../types';

const yearSchema = z.object({
  name: z.string().min(1, 'Tên năm học là bắt buộc (Ví dụ: 2025-2026)'),
  start_date: z.string().min(1, 'Ngày bắt đầu là bắt buộc'),
  end_date: z.string().min(1, 'Ngày kết thúc là bắt buộc'),
});

type YearValues = z.infer<typeof yearSchema>;

interface YearsSettingsTabProps {
  schoolData: SchoolRow | null;
  academicYears: AcademicYearRow[];
  isLoadingYears: boolean;
  handleSetCurrentYear: (year: AcademicYearRow) => Promise<void>;
}

export const YearsSettingsTab: React.FC<YearsSettingsTabProps> = ({
  schoolData,
  academicYears,
  isLoadingYears,
  handleSetCurrentYear,
}) => {
  const queryClient = useQueryClient();
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [yearLoading, setYearLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<YearValues>({
    resolver: zodResolver(yearSchema) as any,
  });

  const onCreateYear = async (values: YearValues) => {
    if (!schoolData?.id) return;
    setYearLoading(true);
    try {
      const res = await api.create('academic_years', {
        school_id: schoolData.id,
        name: values.name.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        is_current: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (res.error) throw new Error(res.error);

      toast.success('Tạo năm học mới thành công!');
      queryClient.invalidateQueries({ queryKey: ['academic-years-settings'] });
      setIsYearModalOpen(false);
      reset();
    } catch (err) {
      toast.error('Lỗi khi tạo năm học', err instanceof Error ? err.message : 'Lỗi hệ thống');
    } finally {
      setYearLoading(false);
    }
  };

  if (isLoadingYears) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-12 bg-surface-container-low rounded-xl" />
        <div className="h-12 bg-surface-container-low rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Quản lý năm học
          </h2>
          <p className="text-xs text-on-surface-variant">
            Kích hoạt hoặc khởi tạo các năm học mới. Các lớp học và học phí sẽ phân nhóm theo năm học này.
          </p>
        </div>
        <button
          onClick={() => setIsYearModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Năm học mới
        </button>
      </div>

      <Table
        className="rounded-2xl border border-outline-variant/30 overflow-hidden bg-white"
        columns={[
          {
            key: 'name',
            header: 'Tên năm học',
            render: (row: AcademicYearRow) => (
              <span className="font-bold text-on-surface">Năm học {row.name}</span>
            ),
          },
          {
            key: 'start_date',
            header: 'Ngày bắt đầu',
            render: (row: AcademicYearRow) => (
              <span className="text-xs text-on-surface-variant">
                {new Date(row.start_date).toLocaleDateString('vi-VN')}
              </span>
            ),
          },
          {
            key: 'end_date',
            header: 'Ngày kết thúc',
            render: (row: AcademicYearRow) => (
              <span className="text-xs text-on-surface-variant">
                {new Date(row.end_date).toLocaleDateString('vi-VN')}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Trạng thái',
            render: (row: AcademicYearRow) =>
              row.is_current ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-2xs select-none">
                  Hiện tại
                </span>
              ) : (
                <span className="text-xs text-on-surface-variant/60 font-medium italic select-none">
                  Lịch sử / Chờ
                </span>
              ),
          },
          {
            key: 'actions',
            header: 'Thao tác',
            align: 'right',
            render: (row: AcademicYearRow) =>
              row.is_current ? (
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 justify-end select-none">
                  <Clock className="w-3.5 h-3.5" />
                  Đang chạy
                </span>
              ) : (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleSetCurrentYear(row)}
                    className="inline-flex items-center px-3 py-1.5 bg-surface-container hover:bg-primary hover:text-on-primary text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/40 transition-all cursor-pointer"
                  >
                    Kích hoạt
                  </button>
                </div>
              ),
          },
        ]}
        data={academicYears}
        rowKey={(row) => row.id}
      />

      {isYearModalOpen && (
        <Modal
          open={isYearModalOpen}
          onClose={() => setIsYearModalOpen(false)}
          title="Tạo năm học nghiệp vụ mới"
          size="md"
        >
          <form onSubmit={handleSubmit(onCreateYear)} className="space-y-5 select-none">
            <Input
              label="Tên năm học"
              placeholder="Ví dụ: 2026-2027"
              error={errors.name?.message}
              {...register('name')}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Ngày bắt đầu"
                type="date"
                error={errors.start_date?.message}
                {...register('start_date')}
              />

              <Input
                label="Ngày kết thúc"
                type="date"
                error={errors.end_date?.message}
                {...register('end_date')}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={() => setIsYearModalOpen(false)}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-sm font-semibold text-on-surface transition-all cursor-pointer"
                disabled={yearLoading}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={yearLoading}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/90 rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
              >
                {yearLoading ? 'Đang tạo...' : 'Tạo mới'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
