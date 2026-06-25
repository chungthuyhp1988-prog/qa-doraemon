import { describe, it, expect } from 'vitest';
import { formatReceiptText, type ReceiptData } from './receipt';

const sampleReceipt: ReceiptData = {
  receipt_number: 'BL-20260615-abc12345',
  fee_id: 'abc12345-0000-0000-0000-000000000000',
  paid_date: '2026-06-15',
  month: 6,
  year: 2026,
  due_date: '2026-06-10',
  status: 'paid',
  base_amount: 1500000,
  meal_amount: 500000,
  extra_amount: 200000,
  discount: 100000,
  total_amount: 2100000,
  paid_amount: 2100000,
  remaining: 0,
  note: 'Thu đủ',
  student: {
    id: 's1',
    full_name: 'Nguyễn Văn An',
    student_code: 'HS001',
    date_of_birth: '2021-03-15',
    class_name: 'Doraemon 1',
    grade_level: 'la',
  },
  guardian: {
    full_name: 'Nguyễn Văn Bình',
    relationship: 'cha',
    phone: '0912345678',
  },
  school: {
    name: 'Trường Mầm Non Doraemon',
    address: 'Đường Phan Đình Phùng, Hà Tĩnh',
    phone: '0239 3888 888',
    email: 'doraemon@mamnon.edu.vn',
    principal_name: 'Nguyễn Thị Doraemon',
  },
  created_by: {
    full_name: 'Admin',
    email: 'admin@doraemon.edu.vn',
  },
};

describe('formatReceiptText', () => {
  it('includes school name', () => {
    const text = formatReceiptText(sampleReceipt);
    expect(text).toContain('TRƯỜNG MẦM NON DORAEMON');
  });

  it('includes student info', () => {
    const text = formatReceiptText(sampleReceipt);
    expect(text).toContain('Nguyễn Văn An');
    expect(text).toContain('HS001');
  });

  it('includes receipt number', () => {
    const text = formatReceiptText(sampleReceipt);
    expect(text).toContain('BL-20260615-abc12345');
  });

  it('includes guardian info', () => {
    const text = formatReceiptText(sampleReceipt);
    expect(text).toContain('Nguyễn Văn Bình');
    expect(text).toContain('0912345678');
  });

  it('includes amounts', () => {
    const text = formatReceiptText(sampleReceipt);
    expect(text).toContain('TỔNG CỘNG');
    expect(text).toContain('ĐÃ ĐÓNG');
  });

  it('shows paid date when available', () => {
    const text = formatReceiptText(sampleReceipt);
    expect(text).toContain('Ngày đóng: 2026-06-15');
  });

  it('shows "Chưa thanh toán" when no paid_date', () => {
    const unpaid = { ...sampleReceipt, paid_date: null };
    const text = formatReceiptText(unpaid);
    expect(text).toContain('Chưa thanh toán');
  });
});
