/**
 * @fileoverview Database type definitions for the Doraemon Kindergarten Management System.
 *
 * These types mirror the PostgreSQL schema defined in `supabase/migrations/001_initial_schema.sql`.
 * Each table exposes three variants:
 *   - **Row**    – what you read from the DB (all columns present).
 *   - **Insert** – what you send when creating a new row (server-defaulted columns optional).
 *   - **Update** – what you send when patching an existing row (everything optional).
 *
 * Enum string-literal unions are used instead of TypeScript `enum` so they
 * work seamlessly with Supabase's PostgREST serialisation.
 */

// ─────────────────────────────────────────────
// Enum Types
// ─────────────────────────────────────────────

/** Vai trò người dùng trong hệ thống */
export type UserRole = 'admin' | 'teacher' | 'staff';

/** Trạng thái học sinh */
export type StudentStatus = 'active' | 'registered' | 'waiting' | 'suspended' | 'graduated' | 'transferred';

/** Trạng thái điểm danh */
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'sick' | 'excused';

/** Giới tính */
export type Gender = 'male' | 'female';

/** Trạng thái học phí */
export type FeeStatus = 'pending' | 'partial' | 'paid' | 'overdue';

/** Khối lớp */
export type GradeLevel = 'nha_tre' | 'mam' | 'choi' | 'la';

/** Loại thông báo */
export type NotificationType = 'announcement' | 'reminder' | 'alert';

/** Đối tượng nhận thông báo */
export type NotificationTarget = 'all' | 'class' | 'individual';

/** Quan hệ phụ huynh */
export type GuardianRelationship = 'cha' | 'me' | 'ong' | 'ba' | 'khac';

// ─────────────────────────────────────────────
// Table: schools
// ─────────────────────────────────────────────

/** Thông tin trường học */
export interface SchoolRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  principal_name: string | null;
  logo_url: string | null;
  established_date: string | null;
  created_at: string;
  updated_at: string;
  zalo_oa_id: string | null;
  zalo_access_token: string | null;
  zalo_refresh_token: string | null;
  zalo_template_fee: string | null;
  zalo_template_attendance: string | null;
}

export interface SchoolInsert {
  id?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  principal_name?: string | null;
  logo_url?: string | null;
  established_date?: string | null;
  created_at?: string;
  updated_at?: string;
  zalo_oa_id?: string | null;
  zalo_access_token?: string | null;
  zalo_refresh_token?: string | null;
  zalo_template_fee?: string | null;
  zalo_template_attendance?: string | null;
}

export interface SchoolUpdate {
  id?: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  principal_name?: string | null;
  logo_url?: string | null;
  established_date?: string | null;
  updated_at?: string;
  zalo_oa_id?: string | null;
  zalo_access_token?: string | null;
  zalo_refresh_token?: string | null;
  zalo_template_fee?: string | null;
  zalo_template_attendance?: string | null;
}

// ─────────────────────────────────────────────
// Table: academic_years
// ─────────────────────────────────────────────

/** Năm học */
export interface AcademicYearRow {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademicYearInsert {
  id?: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AcademicYearUpdate {
  id?: string;
  school_id?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: users (profiles)
// ─────────────────────────────────────────────

/** Hồ sơ người dùng – liên kết với auth.users qua id */
export interface UserRow {
  id: string;
  school_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  is_active: boolean;
  work_status: 'active' | 'maternity_leave' | 'inactive' | 'on_leave';
  created_at: string;
  updated_at: string;
}

export interface UserInsert {
  id: string; // must match auth.users.id
  school_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  is_active?: boolean;
  work_status?: 'active' | 'maternity_leave' | 'inactive' | 'on_leave';
  created_at?: string;
  updated_at?: string;
}

export interface UserUpdate {
  school_id?: string;
  email?: string;
  full_name?: string;
  role?: UserRole;
  phone?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  is_active?: boolean;
  work_status?: 'active' | 'maternity_leave' | 'inactive' | 'on_leave';
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: classes
// ─────────────────────────────────────────────

/** Lớp học */
export interface ClassRow {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  grade_level: GradeLevel;
  capacity: number;
  room_number: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassInsert {
  id?: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  grade_level: GradeLevel;
  capacity?: number;
  room_number?: string | null;
  description?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ClassUpdate {
  id?: string;
  school_id?: string;
  academic_year_id?: string;
  name?: string;
  grade_level?: GradeLevel;
  capacity?: number;
  room_number?: string | null;
  description?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: class_teachers (junction)
// ─────────────────────────────────────────────

/** Phân công giáo viên – lớp học */
export interface ClassTeacherRow {
  id: string;
  class_id: string;
  teacher_id: string;
  is_homeroom: boolean;
  assigned_date: string;
  created_at: string;
  updated_at: string;
}

export interface ClassTeacherInsert {
  id?: string;
  class_id: string;
  teacher_id: string;
  is_homeroom?: boolean;
  assigned_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClassTeacherUpdate {
  id?: string;
  class_id?: string;
  teacher_id?: string;
  is_homeroom?: boolean;
  assigned_date?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: students
// ─────────────────────────────────────────────

/** Hồ sơ học sinh */
export interface StudentRow {
  id: string;
  school_id: string;
  class_id: string | null;
  student_code: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  address: string | null;
  enrollment_date: string;
  status: StudentStatus;
  profile_image_url: string | null;
  medical_notes: string | null;
  allergies: string | null;
  priority_status: string | null;
  registration_date: string | null;
  target_school_year: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentInsert {
  id?: string;
  school_id: string;
  class_id?: string | null;
  student_code: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  address?: string | null;
  enrollment_date?: string;
  status?: StudentStatus;
  profile_image_url?: string | null;
  medical_notes?: string | null;
  allergies?: string | null;
  priority_status?: string | null;
  registration_date?: string | null;
  target_school_year?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudentUpdate {
  id?: string;
  school_id?: string;
  class_id?: string | null;
  student_code?: string;
  full_name?: string;
  date_of_birth?: string;
  gender?: Gender;
  address?: string | null;
  enrollment_date?: string;
  status?: StudentStatus;
  profile_image_url?: string | null;
  medical_notes?: string | null;
  allergies?: string | null;
  priority_status?: string | null;
  registration_date?: string | null;
  target_school_year?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: guardians
// ─────────────────────────────────────────────

/** Phụ huynh / Người giám hộ */
export interface GuardianRow {
  id: string;
  student_id: string;
  full_name: string;
  relationship: GuardianRelationship;
  phone: string;
  email: string | null;
  address: string | null;
  occupation: string | null;
  is_primary: boolean;
  citizen_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardianInsert {
  id?: string;
  student_id: string;
  full_name: string;
  relationship: GuardianRelationship;
  phone: string;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  is_primary?: boolean;
  citizen_id?: string | null;
  user_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GuardianUpdate {
  id?: string;
  student_id?: string;
  full_name?: string;
  relationship?: GuardianRelationship;
  phone?: string;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  is_primary?: boolean;
  citizen_id?: string | null;
  user_id?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: attendance
// ─────────────────────────────────────────────

/** Bản ghi điểm danh */
export interface AttendanceRow {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  check_out_time: string | null;
  recorded_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceInsert {
  id?: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  check_out_time?: string | null;
  recorded_by?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceUpdate {
  id?: string;
  student_id?: string;
  class_id?: string;
  date?: string;
  status?: AttendanceStatus;
  check_in_time?: string | null;
  check_out_time?: string | null;
  recorded_by?: string | null;
  note?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: health_records
// ─────────────────────────────────────────────

/** Hồ sơ sức khỏe */
export interface HealthRecordRow {
  id: string;
  student_id: string;
  record_date: string;
  height_cm: number | null;
  weight_kg: number | null;
  temperature: number | null;
  blood_type: string | null;
  health_status: string | null;
  vaccination_info: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthRecordInsert {
  id?: string;
  student_id: string;
  record_date?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  temperature?: number | null;
  blood_type?: string | null;
  health_status?: string | null;
  vaccination_info?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HealthRecordUpdate {
  id?: string;
  student_id?: string;
  record_date?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  temperature?: number | null;
  blood_type?: string | null;
  health_status?: string | null;
  vaccination_info?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: tuition_fees
// ─────────────────────────────────────────────

/** Học phí */
export interface TuitionFeeRow {
  id: string;
  student_id: string;
  academic_year_id: string;
  month: number;
  year: number;
  base_amount: number;
  meal_amount: number;
  extra_amount: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  status: FeeStatus;
  due_date: string;
  paid_date: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TuitionFeeInsert {
  id?: string;
  student_id: string;
  academic_year_id: string;
  month: number;
  year: number;
  base_amount: number;
  meal_amount?: number;
  extra_amount?: number;
  discount?: number;
  total_amount: number;
  paid_amount?: number;
  status?: FeeStatus;
  due_date: string;
  paid_date?: string | null;
  note?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TuitionFeeUpdate {
  id?: string;
  student_id?: string;
  academic_year_id?: string;
  month?: number;
  year?: number;
  base_amount?: number;
  meal_amount?: number;
  extra_amount?: number;
  discount?: number;
  total_amount?: number;
  paid_amount?: number;
  status?: FeeStatus;
  due_date?: string;
  paid_date?: string | null;
  note?: string | null;
  created_by?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: meal_plans
// ─────────────────────────────────────────────

/** Thực đơn / Kế hoạch bữa ăn */
export interface MealPlanRow {
  id: string;
  school_id: string;
  class_id: string | null;
  date: string;
  meal_type: string;
  menu_items: string;
  calories: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealPlanInsert {
  id?: string;
  school_id: string;
  class_id?: string | null;
  date: string;
  meal_type: string;
  menu_items: string;
  calories?: number | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MealPlanUpdate {
  id?: string;
  school_id?: string;
  class_id?: string | null;
  date?: string;
  meal_type?: string;
  menu_items?: string;
  calories?: number | null;
  notes?: string | null;
  created_by?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: notifications
// ─────────────────────────────────────────────

/** Thông báo */
export interface NotificationRow {
  id: string;
  school_id: string;
  title: string;
  content: string;
  type: NotificationType;
  target: NotificationTarget;
  target_id: string | null;
  is_read: boolean;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationInsert {
  id?: string;
  school_id: string;
  title: string;
  content: string;
  type?: NotificationType;
  target?: NotificationTarget;
  target_id?: string | null;
  is_read?: boolean;
  sent_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationUpdate {
  id?: string;
  school_id?: string;
  title?: string;
  content?: string;
  type?: NotificationType;
  target?: NotificationTarget;
  target_id?: string | null;
  is_read?: boolean;
  sent_at?: string | null;
  created_by?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Table: student_evaluations
// ─────────────────────────────────────────────

/** Đánh giá học sinh */
export interface StudentEvaluationRow {
  id: string;
  student_id: string;
  evaluator_id: string;
  evaluation_date: string;
  period: string;
  physical_score: number | null;
  physical_note: string | null;
  cognitive_score: number | null;
  cognitive_note: string | null;
  language_score: number | null;
  language_note: string | null;
  social_score: number | null;
  social_note: string | null;
  aesthetic_score: number | null;
  aesthetic_note: string | null;
  overall_comment: string | null;
  recommendation: string | null;
  academic_year_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentEvaluationInsert {
  id?: string;
  student_id: string;
  evaluator_id: string;
  evaluation_date?: string;
  period: string;
  physical_score?: number | null;
  physical_note?: string | null;
  cognitive_score?: number | null;
  cognitive_note?: string | null;
  language_score?: number | null;
  language_note?: string | null;
  social_score?: number | null;
  social_note?: string | null;
  aesthetic_score?: number | null;
  aesthetic_note?: string | null;
  overall_comment?: string | null;
  recommendation?: string | null;
  academic_year_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudentEvaluationUpdate {
  id?: string;
  student_id?: string;
  evaluator_id?: string;
  evaluation_date?: string;
  period?: string;
  physical_score?: number | null;
  physical_note?: string | null;
  cognitive_score?: number | null;
  cognitive_note?: string | null;
  language_score?: number | null;
  language_note?: string | null;
  social_score?: number | null;
  social_note?: string | null;
  aesthetic_score?: number | null;
  aesthetic_note?: string | null;
  overall_comment?: string | null;
  recommendation?: string | null;
  academic_year_id?: string | null;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Supabase Database composite type
// ─────────────────────────────────────────────

/**
 * Supabase-compatible `Database` type used when creating a typed client via
 * `createClient<Database>(...)`.
 *
 * Only the `public` schema is declared; extend with other schemas as needed.
 */
export interface Database {
  public: {
    Tables: {
      schools: {
        Row: SchoolRow;
        Insert: SchoolInsert;
        Update: SchoolUpdate;
      };
      academic_years: {
        Row: AcademicYearRow;
        Insert: AcademicYearInsert;
        Update: AcademicYearUpdate;
      };
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      classes: {
        Row: ClassRow;
        Insert: ClassInsert;
        Update: ClassUpdate;
      };
      class_teachers: {
        Row: ClassTeacherRow;
        Insert: ClassTeacherInsert;
        Update: ClassTeacherUpdate;
      };
      students: {
        Row: StudentRow;
        Insert: StudentInsert;
        Update: StudentUpdate;
      };
      guardians: {
        Row: GuardianRow;
        Insert: GuardianInsert;
        Update: GuardianUpdate;
      };
      attendance: {
        Row: AttendanceRow;
        Insert: AttendanceInsert;
        Update: AttendanceUpdate;
      };
      health_records: {
        Row: HealthRecordRow;
        Insert: HealthRecordInsert;
        Update: HealthRecordUpdate;
      };
      tuition_fees: {
        Row: TuitionFeeRow;
        Insert: TuitionFeeInsert;
        Update: TuitionFeeUpdate;
      };
      meal_plans: {
        Row: MealPlanRow;
        Insert: MealPlanInsert;
        Update: MealPlanUpdate;
      };
      notifications: {
        Row: NotificationRow;
        Insert: NotificationInsert;
        Update: NotificationUpdate;
      };
      student_evaluations: {
        Row: StudentEvaluationRow;
        Insert: StudentEvaluationInsert;
        Update: StudentEvaluationUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      student_status: StudentStatus;
      attendance_status: AttendanceStatus;
      gender: Gender;
      fee_status: FeeStatus;
      grade_level: GradeLevel;
      notification_type: NotificationType;
      notification_target: NotificationTarget;
      guardian_relationship: GuardianRelationship;
    };
  };
}

/**
 * Helper – extract the Row type for a given table name.
 * @example type Student = TableRow<'students'>;
 */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

/**
 * Helper – extract the Insert type for a given table name.
 * @example type NewStudent = TableInsert<'students'>;
 */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

/**
 * Helper – extract the Update type for a given table name.
 * @example type PatchStudent = TableUpdate<'students'>;
 */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
