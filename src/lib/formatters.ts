/**
 * Shared formatting and display utility functions.
 * Consolidates duplicated logic from views and detail panels.
 */

/**
 * Extracts initials from a Vietnamese full name.
 * Takes the first letter of the last word (family name convention in Vietnamese).
 * Example: 'Nguyễn Văn An' => 'A'
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  // Vietnamese names: last word is the given name
  const givenName = parts[parts.length - 1];
  return givenName.charAt(0).toUpperCase();
}

/**
 * Formats a date string or Date to Vietnamese locale.
 * @param date - ISO date string or Date object
 * @param options - Intl.DateTimeFormatOptions (default: dd/MM/yyyy)
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('vi-VN', options || {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Formats a number as Vietnamese currency (VND).
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '0 đ';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns a grade display name from grade_level enum.
 */
export function getGradeName(gradeLevel: string | null | undefined): string {
  switch (gradeLevel) {
    case 'nha_tre': return 'Nhà trẻ';
    case 'mam': return 'Mầm';
    case 'choi': return 'Chồi';
    case 'la': return 'Lá';
    default: return gradeLevel || 'Chưa xếp';
  }
}

/**
 * Returns a status display name from status enum.
 */
export function getStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active': return 'Đang học';
    case 'inactive': return 'Nghỉ học';
    case 'graduated': return 'Đã tốt nghiệp';
    case 'transferred': return 'Đã chuyển';
    case 'pending': return 'Chờ duyệt';
    case 'paid': return 'Đã thu';
    case 'unpaid': return 'Chưa thu';
    case 'partial': return 'Thu một phần';
    case 'overdue': return 'Quá hạn';
    default: return status || '';
  }
}
