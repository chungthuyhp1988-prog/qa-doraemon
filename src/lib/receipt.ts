import { api } from './api';

export interface ReceiptData {
  receipt_number: string;
  fee_id: string;
  paid_date: string | null;
  month: number;
  year: number;
  due_date: string;
  status: string;
  base_amount: number;
  meal_amount: number;
  extra_amount: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  remaining: number;
  note: string | null;
  student: {
    id: string;
    full_name: string;
    student_code: string;
    date_of_birth: string;
    class_name: string | null;
    grade_level: string | null;
  };
  guardian: {
    full_name: string;
    relationship: string;
    phone: string;
  } | null;
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    principal_name: string;
  };
  created_by: {
    full_name: string;
    email: string;
  } | null;
}

export async function fetchReceipt(feeId: string): Promise<ReceiptData> {
  const { data, error } = await api.callRpc<any>('generate_receipt', { p_fee_id: feeId });
  if (error) throw new Error(error);
  return data as unknown as ReceiptData;
}

export function formatReceiptText(r: ReceiptData): string {
  const line = '─'.repeat(50);
  const vnd = (n: number) => Number(n).toLocaleString('vi-VN') + ' ₫';

  return [
    r.school.name.toUpperCase(),
    r.school.address,
    `ĐT: ${r.school.phone} | Email: ${r.school.email}`,
    line,
    `BIÊN LAI THU HỌC PHÍ`,
    `Số: ${r.receipt_number}`,
    line,
    `Học sinh: ${r.student.full_name} (${r.student.student_code})`,
    `Lớp: ${r.student.class_name || 'Chưa xếp lớp'}`,
    r.guardian ? `Phụ huynh: ${r.guardian.full_name} (${r.guardian.phone})` : '',
    `Tháng: ${r.month}/${r.year}`,
    line,
    `Học phí cơ bản:    ${vnd(r.base_amount)}`,
    `Tiền ăn:           ${vnd(r.meal_amount)}`,
    `Khoản khác:        ${vnd(r.extra_amount)}`,
    `Miễn giảm:        -${vnd(r.discount)}`,
    line,
    `TỔNG CỘNG:         ${vnd(r.total_amount)}`,
    `ĐÃ ĐÓNG:           ${vnd(r.paid_amount)}`,
    `CÒN NỢ:            ${vnd(r.remaining)}`,
    line,
    r.paid_date ? `Ngày đóng: ${r.paid_date}` : 'Chưa thanh toán',
    r.note ? `Ghi chú: ${r.note}` : '',
    '',
    `Người lập: ${r.created_by?.full_name || 'Hệ thống'}`,
    `Hiệu trưởng: ${r.school.principal_name}`,
  ].filter(Boolean).join('\n');
}
