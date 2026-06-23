/**
 * @fileoverview Generic, type-safe API helper layer on top of Supabase.
 *
 * Provides CRUD primitives with built-in pagination, error handling and
 * type safety so that feature modules never need to call `supabase.from()`
 * directly.
 *
 * @example
 * ```ts
 * import { api } from '@/src/lib/api';
 * import type { StudentRow, StudentInsert } from '@/src/types';
 *
 * // Paginated list
 * const result = await api.getAll<StudentRow>('students', {
 *   page: 1,
 *   pageSize: 20,
 *   sortBy: 'full_name',
 * });
 *
 * // Single row
 * const student = await api.getById<StudentRow>('students', id);
 *
 * // Create
 * const created = await api.create<StudentInsert, StudentRow>('students', payload);
 * ```
 */

import { supabase } from './supabase';
import type { Database } from '../types/database';
import type { ApiResponse, PaginatedResponse, PaginationParams, FilterOptions } from '../types';

/** Shorthand for a public table name. */
type TableName = keyof Database['public']['Tables'];

// ─────────────────────────────────────────────
// Error wrapper
// ─────────────────────────────────────────────

/**
 * Wrap a Supabase call and normalise its result into an `ApiResponse<T>`.
 *
 * @typeParam T - Expected data shape.
 * @param promise - The Supabase query promise.
 * @returns Normalised `ApiResponse<T>`.
 */
async function handleResponse<T>(
  promise: PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>,
): Promise<ApiResponse<T>> {
  try {
    const { data, error, count } = await promise;
    if (error) {
      console.error('[api] Supabase error:', error.message);
      return { data: null, error: error.message, count: null };
    }
    return { data, error: null, count: count ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định';
    console.error('[api] Unexpected error:', message);
    return { data: null, error: message, count: null };
  }
}

// ─────────────────────────────────────────────
// Query builder helpers
// ─────────────────────────────────────────────

/**
 * Apply `FilterOptions` to a Supabase query builder.
 *
 * @param query   - The Supabase `PostgrestFilterBuilder`.
 * @param options - Filter options from the calling code.
 * @returns The mutated query.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, options?: FilterOptions, table?: string): any {
  if (!options) return query;

  // Exact-match filters
  if (options.filters) {
    for (const [column, value] of Object.entries(options.filters)) {
      if (value === null) {
        query = query.is(column, null);
      } else {
        query = query.eq(column, value);
      }
    }
  }

  // Date range
  if (options.dateRange) {
    const { column, from, to } = options.dateRange;
    query = query.gte(column, from).lte(column, to);
  }

  // Free-text search (uses table-aware column mappings)
  if (options.search) {
    const searchVal = options.search.trim();
    if (searchVal) {
      const searchColumns: Record<string, string> = {
        students: `full_name.ilike.%${searchVal}%,student_code.ilike.%${searchVal}%`,
        users: `full_name.ilike.%${searchVal}%,email.ilike.%${searchVal}%,phone.ilike.%${searchVal}%`,
        notifications: `title.ilike.%${searchVal}%,content.ilike.%${searchVal}%`,
        classes: `name.ilike.%${searchVal}%`,
        meal_plans: `menu_items.ilike.%${searchVal}%,notes.ilike.%${searchVal}%`,
        health_records: `notes.ilike.%${searchVal}%,medical_notes.ilike.%${searchVal}%`,
        student_evaluations: `notes.ilike.%${searchVal}%`,
      };

      const searchOr = searchColumns[table || ''];
      if (searchOr) {
        query = query.or(searchOr);
      } else if (table) {
        // Safe fallback: try 'name' column (works for schools, academic_years)
        query = query.or(`name.ilike.%${searchVal}%`);
      }
    }
  }

  return query;
}

// ─────────────────────────────────────────────
// CRUD functions
// ─────────────────────────────────────────────

/**
 * Fetch a paginated list of rows from `table`.
 *
 * @typeParam T - Row type (e.g. `StudentRow`).
 * @param table       - Supabase table name.
 * @param pagination  - Page, pageSize, sortBy, sortOrder.
 * @param options     - Optional filters and search.
 * @param selectQuery - Custom select expression (default `*`).
 * @returns `PaginatedResponse<T>` with data + count.
 */
async function getAll<T>(
  table: TableName,
  pagination: PaginationParams = { page: 1, pageSize: 20 },
  options?: FilterOptions,
  selectQuery = '*',
): Promise<ApiResponse<PaginatedResponse<T>>> {
  const { page, pageSize, sortBy, sortOrder = 'asc' } = pagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from(table)
    .select(selectQuery, { count: 'exact' })
    .range(from, to);

  // Sorting
  if (sortBy) {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Filters
  query = applyFilters(query, options, table);

  const { data, error, count } = await query;

  if (error) {
    console.error(`[api.getAll] ${table}:`, error.message);
    return { data: null, error: error.message, count: null };
  }

  const totalCount = count ?? 0;
  let rawData = (data as unknown as T[]) ?? [];

  if (table === 'classes') {
    const gradeOrder: Record<string, number> = {
      nha_tre: 1,
      mam: 2,
      choi: 3,
      la: 4,
    };
    rawData = [...rawData].sort((a: any, b: any) => {
      const orderA = (a.grade_level && gradeOrder[a.grade_level]) || 99;
      const orderB = (b.grade_level && gradeOrder[b.grade_level]) || 99;

      if (orderA !== orderB) return orderA - orderB;

      // Same grade: sort by name (numeric-aware for 'Doraemon 1', 'Doraemon 2')
      return (a.name || '').localeCompare(b.name || '', 'vi', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  const paginated: PaginatedResponse<T> = {
    data: rawData,
    count: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  };

  return { data: paginated, error: null, count: totalCount };
}

/**
 * Fetch a single row by its primary key (`id`).
 *
 * @typeParam T - Row type.
 * @param table       - Supabase table name.
 * @param id          - UUID of the row.
 * @param selectQuery - Custom select expression.
 */
async function getById<T>(
  table: TableName,
  id: string,
  selectQuery = '*',
): Promise<ApiResponse<T>> {
  return handleResponse<T>(
    supabase
      .from(table)
      .select(selectQuery)
      .eq('id', id)
      .single() as PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>,
  );
}

/**
 * Insert one or more rows.
 *
 * @typeParam TInsert - Insert payload type (e.g. `StudentInsert`).
 * @typeParam TRow    - Returned row type (e.g. `StudentRow`).
 * @param table   - Supabase table name.
 * @param payload - Data to insert.
 */
async function create<TInsert extends Record<string, unknown>, TRow = TInsert>(
  table: TableName,
  payload: TInsert,
): Promise<ApiResponse<TRow>> {
  return handleResponse<TRow>(
    supabase
      .from(table)
      .insert(payload as never)
      .select()
      .single() as PromiseLike<{ data: TRow | null; error: { message: string } | null; count?: number | null }>,
  );
}

/**
 * Batch insert multiple rows.
 *
 * @typeParam TInsert - Insert payload type.
 * @typeParam TRow    - Returned row type.
 * @param table   - Supabase table name.
 * @param payload - Array of rows to insert.
 */
async function createMany<TInsert extends Record<string, unknown>, TRow = TInsert>(
  table: TableName,
  payload: TInsert[],
): Promise<ApiResponse<TRow[]>> {
  return handleResponse<TRow[]>(
    supabase
      .from(table)
      .insert(payload as never[])
      .select() as PromiseLike<{ data: TRow[] | null; error: { message: string } | null; count?: number | null }>,
  );
}

/**
 * Update an existing row by `id`.
 *
 * @typeParam TUpdate - Update payload type (e.g. `StudentUpdate`).
 * @typeParam TRow    - Returned row type.
 * @param table   - Supabase table name.
 * @param id      - UUID of the row to update.
 * @param payload - Partial data to update.
 */
async function update<TUpdate extends Record<string, unknown>, TRow = TUpdate>(
  table: TableName,
  id: string,
  payload: TUpdate,
): Promise<ApiResponse<TRow>> {
  return handleResponse<TRow>(
    supabase
      .from(table)
      .update(payload as never)
      .eq('id', id)
      .select()
      .single() as PromiseLike<{ data: TRow | null; error: { message: string } | null; count?: number | null }>,
  );
}

/**
 * Delete a row by `id`.
 *
 * @param table - Supabase table name.
 * @param id    - UUID of the row to delete.
 */
async function remove(table: TableName, id: string): Promise<ApiResponse<null>> {
  return handleResponse<null>(
    supabase
      .from(table)
      .delete()
      .eq('id', id) as PromiseLike<{ data: null; error: { message: string } | null; count?: number | null }>,
  );
}

/**
 * Soft-delete: set `is_active = false` instead of removing the row.
 *
 * @param table - Supabase table name (must have an `is_active` column).
 * @param id    - UUID of the row.
 */
async function softDelete<TRow>(table: TableName, id: string): Promise<ApiResponse<TRow>> {
  return handleResponse<TRow>(
    supabase
      .from(table)
      .update({ is_active: false } as never)
      .eq('id', id)
      .select()
      .single() as PromiseLike<{ data: TRow | null; error: { message: string } | null; count?: number | null }>,
  );
}

// ─────────────────────────────────────────────
// Specialised query helpers
// ─────────────────────────────────────────────

/**
 * Count rows in a table, optionally filtered.
 *
 * @param table   - Supabase table name.
 * @param options - Optional filters.
 */
async function count(table: TableName, options?: FilterOptions): Promise<ApiResponse<number>> {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });
  query = applyFilters(query, options);

  const { count: rowCount, error } = await query;
  if (error) {
    return { data: null, error: error.message, count: null };
  }
  return { data: rowCount ?? 0, error: null, count: rowCount ?? 0 };
}

/**
 * Check whether a row with the given `id` exists.
 *
 * @param table - Supabase table name.
 * @param id    - UUID to check.
 */
async function exists(table: TableName, id: string): Promise<boolean> {
  const { count: c } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('id', id);
  return (c ?? 0) > 0;
}

// ─────────────────────────────────────────────
// Public API object
// ─────────────────────────────────────────────

/**
 * Namespace-style API helper.
 *
 * @example
 * ```ts
 * import { api } from '@/src/lib/api';
 * const res = await api.getAll<StudentRow>('students', { page: 1, pageSize: 10 });
 * ```
 */
export const api = {
  getAll,
  getById,
  create,
  createMany,
  update,
  remove,
  softDelete,
  count,
  exists,
} as const;

export default api;
