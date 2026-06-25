/**
 * @fileoverview Central type re-exports + frontend-specific utility types.
 *
 * Import everything you need from `@/src/types`:
 * ```ts
 * import type { StudentRow, ApiResponse, PaginationParams } from '@/src/types';
 * ```
 */

// ── Re-export every database type ────────────────────────────────────
export type {
  // Enums
  UserRole,
  StudentStatus,
  AttendanceStatus,
  Gender,
  FeeStatus,
  GradeLevel,
  NotificationType,
  NotificationTarget,
  GuardianRelationship,

  // Table Row / Insert / Update types
  SchoolRow,
  SchoolInsert,
  SchoolUpdate,
  AcademicYearRow,
  AcademicYearInsert,
  AcademicYearUpdate,
  UserRow,
  UserInsert,
  UserUpdate,
  ClassRow,
  ClassInsert,
  ClassUpdate,
  ClassTeacherRow,
  ClassTeacherInsert,
  ClassTeacherUpdate,
  StudentRow,
  StudentInsert,
  StudentUpdate,
  GuardianRow,
  GuardianInsert,
  GuardianUpdate,
  AttendanceRow,
  AttendanceInsert,
  AttendanceUpdate,
  HealthRecordRow,
  HealthRecordInsert,
  HealthRecordUpdate,
  TuitionFeeRow,
  TuitionFeeInsert,
  TuitionFeeUpdate,
  MealPlanRow,
  MealPlanInsert,
  MealPlanUpdate,
  NotificationRow,
  NotificationInsert,
  NotificationUpdate,
  StudentEvaluationRow,
  StudentEvaluationInsert,
  StudentEvaluationUpdate,

  // Composite / helper types
  Database,
  TableRow,
  TableInsert,
  TableUpdate,
} from './database';

// ─────────────────────────────────────────────
// Frontend-specific types
// ─────────────────────────────────────────────

import type { UserRole } from './database';

/**
 * The authenticated user available after login.
 * Combines Supabase auth metadata with the `users` profile row.
 */
export interface AuthUser {
  /** Supabase auth uid */
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  school_id: string;
  avatar_url: string | null;
  is_active: boolean;
  work_status: 'active' | 'maternity_leave' | 'inactive' | 'on_leave';
}

/**
 * Sidebar / top-bar navigation item.
 */
export interface NavItem {
  /** Display label (Vietnamese) */
  label: string;
  /** Route path, e.g. `/students` */
  href: string;
  /** Lucide icon name */
  icon?: string;
  /** Roles that may see this item; empty = everyone */
  roles?: UserRole[];
  /** Nested children */
  children?: NavItem[];
  /** Badge count (e.g. unread notifications) */
  badge?: number;
}

/**
 * Generic column descriptor for data-table components.
 * @typeParam T - The row data type rendered by the table.
 */
export interface TableColumn<T> {
  /** Unique key used for React `key` and sorting */
  key: keyof T & string;
  /** Column header label (Vietnamese) */
  label: string;
  /** Whether the column is sortable */
  sortable?: boolean;
  /** Whether the column is visible by default */
  visible?: boolean;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Custom render function */
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

/**
 * Pagination parameters sent alongside list queries.
 */
export interface PaginationParams {
  /** Current page (1-indexed) */
  page: number;
  /** Rows per page */
  pageSize: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Standard API response envelope used by the `api` helper layer.
 * @typeParam T - The shape of the data payload.
 */
export interface ApiResponse<T> {
  /** The returned data (null when an error occurred) */
  data: T | null;
  /** Human-readable error message */
  error: string | null;
  /** Total rows available (for paginated responses) */
  count: number | null;
}

/**
 * Paginated list response for data tables.
 * @typeParam T - The shape of each row item.
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Generic filter options for list views.
 * Each key is the column name; the value is the filter constraint.
 */
export interface FilterOptions {
  /** Free-text search across relevant columns */
  search?: string;
  /** Exact match filters keyed by column */
  filters?: Record<string, string | number | boolean | null>;
  /** Date range filter */
  dateRange?: {
    column: string;
    from: string;
    to: string;
  };
}
