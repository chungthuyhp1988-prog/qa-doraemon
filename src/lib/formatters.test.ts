import { describe, it, expect } from 'vitest';
import { getInitials, formatCurrency, getGradeName, getStatusLabel } from './formatters';

describe('getInitials', () => {
  it('returns last word initial for Vietnamese name', () => {
    expect(getInitials('Nguyễn Văn An')).toBe('A');
  });

  it('returns ? for empty string', () => {
    expect(getInitials('')).toBe('?');
  });

  it('handles single name', () => {
    expect(getInitials('Mai')).toBe('M');
  });
});

describe('formatCurrency', () => {
  it('formats number as VND', () => {
    const result = formatCurrency(1500000);
    expect(result).toContain('1.500.000');
  });

  it('returns 0 đ for null', () => {
    expect(formatCurrency(null)).toBe('0 đ');
  });

  it('returns 0 đ for undefined', () => {
    expect(formatCurrency(undefined)).toBe('0 đ');
  });
});

describe('getGradeName', () => {
  it('maps nha_tre', () => {
    expect(getGradeName('nha_tre')).toBe('Nhà trẻ');
  });

  it('maps la', () => {
    expect(getGradeName('la')).toBe('Lá');
  });

  it('returns Chưa xếp for null', () => {
    expect(getGradeName(null)).toBe('Chưa xếp');
  });
});

describe('getStatusLabel', () => {
  it('maps active', () => {
    expect(getStatusLabel('active')).toBe('Đang học');
  });

  it('maps overdue', () => {
    expect(getStatusLabel('overdue')).toBe('Quá hạn');
  });

  it('returns empty for unknown', () => {
    expect(getStatusLabel(null)).toBe('');
  });
});
