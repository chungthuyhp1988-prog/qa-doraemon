-- ============================================================================
-- Doraemon Kindergarten Management System – Initial Schema
-- Migration: 001_initial_schema.sql
-- Created:   2026-05-27
--
-- Trường Mầm Non Doraemon – Hà Tĩnh
-- ~18 lớp · ~500 học sinh · ~30 giáo viên/nhân viên
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Custom ENUM types
-- ────────────────────────────────────────────────────────────────────────────
CREATE TYPE user_role              AS ENUM ('admin', 'teacher', 'staff');
CREATE TYPE student_status         AS ENUM ('active', 'suspended', 'graduated', 'transferred');
CREATE TYPE attendance_status      AS ENUM ('present', 'absent', 'late', 'sick', 'excused');
CREATE TYPE gender                 AS ENUM ('male', 'female');
CREATE TYPE fee_status             AS ENUM ('pending', 'partial', 'paid', 'overdue');
CREATE TYPE grade_level            AS ENUM ('nha_tre', 'mam', 'choi', 'la');
CREATE TYPE notification_type      AS ENUM ('announcement', 'reminder', 'alert');
CREATE TYPE notification_target    AS ENUM ('all', 'class', 'individual');
CREATE TYPE guardian_relationship  AS ENUM ('cha', 'me', 'ong', 'ba', 'khac');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Helper: auto-update `updated_at` trigger function
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Tables
-- ────────────────────────────────────────────────────────────────────────────

-- 3.1 schools -----------------------------------------------------------
CREATE TABLE schools (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  address          TEXT,
  phone            TEXT,
  email            TEXT,
  principal_name   TEXT,
  logo_url         TEXT,
  established_date DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.2 academic_years ----------------------------------------------------
CREATE TABLE academic_years (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,              -- e.g. '2025-2026'
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_years_school ON academic_years(school_id);
CREATE INDEX idx_academic_years_current ON academic_years(is_current) WHERE is_current = TRUE;

CREATE TRIGGER trg_academic_years_updated_at
  BEFORE UPDATE ON academic_years
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.3 users (profiles) --------------------------------------------------
-- id references auth.users; row is created by the app after sign-up.
CREATE TABLE users (
  id          UUID PRIMARY KEY,           -- = auth.users.id
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'staff',
  phone       TEXT,
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_email  ON users(email);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.4 classes ------------------------------------------------------------
CREATE TABLE classes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  grade_level      grade_level NOT NULL,
  capacity         INT NOT NULL DEFAULT 30,
  room_number      TEXT,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classes_school        ON classes(school_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year_id);
CREATE INDEX idx_classes_grade         ON classes(grade_level);

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.5 class_teachers (junction) -----------------------------------------
CREATE TABLE class_teachers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_homeroom   BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_class_teacher UNIQUE (class_id, teacher_id)
);

CREATE INDEX idx_class_teachers_teacher ON class_teachers(teacher_id);

CREATE TRIGGER trg_class_teachers_updated_at
  BEFORE UPDATE ON class_teachers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.6 students -----------------------------------------------------------
CREATE TABLE students (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
  student_code      TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  date_of_birth     DATE NOT NULL,
  gender            gender NOT NULL,
  address           TEXT,
  enrollment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status            student_status NOT NULL DEFAULT 'active',
  profile_image_url TEXT,
  medical_notes     TEXT,
  allergies         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_school    ON students(school_id);
CREATE INDEX idx_students_class     ON students(class_id);
CREATE INDEX idx_students_name      ON students(full_name);
CREATE INDEX idx_students_code      ON students(student_code);
CREATE INDEX idx_students_status    ON students(status);
CREATE INDEX idx_students_dob       ON students(date_of_birth);

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.7 guardians ----------------------------------------------------------
CREATE TABLE guardians (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  relationship  guardian_relationship NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  address       TEXT,
  occupation    TEXT,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,   -- optional portal login
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guardians_student ON guardians(student_id);
CREATE INDEX idx_guardians_user    ON guardians(user_id);

CREATE TRIGGER trg_guardians_updated_at
  BEFORE UPDATE ON guardians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.8 attendance ---------------------------------------------------------
CREATE TABLE attendance (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id       UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  status         attendance_status NOT NULL,
  check_in_time  TIME,
  check_out_time TIME,
  recorded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_student_date UNIQUE (student_id, date)
);

CREATE INDEX idx_attendance_class    ON attendance(class_id);
CREATE INDEX idx_attendance_date     ON attendance(date);
CREATE INDEX idx_attendance_status   ON attendance(status);
CREATE INDEX idx_attendance_student  ON attendance(student_id);

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.9 health_records -----------------------------------------------------
CREATE TABLE health_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  record_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  height_cm        NUMERIC(5,1),
  weight_kg        NUMERIC(5,1),
  temperature      NUMERIC(4,1),
  blood_type       VARCHAR(5),
  health_status    TEXT,
  vaccination_info TEXT,
  notes            TEXT,
  recorded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_records_student ON health_records(student_id);
CREATE INDEX idx_health_records_date    ON health_records(record_date);

CREATE TRIGGER trg_health_records_updated_at
  BEFORE UPDATE ON health_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.10 tuition_fees ------------------------------------------------------
CREATE TABLE tuition_fees (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  month            INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  base_amount      NUMERIC(12,0) NOT NULL,
  meal_amount      NUMERIC(12,0) NOT NULL DEFAULT 0,
  extra_amount     NUMERIC(12,0) NOT NULL DEFAULT 0,
  discount         NUMERIC(12,0) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,0) NOT NULL,
  paid_amount      NUMERIC(12,0) NOT NULL DEFAULT 0,
  status           fee_status NOT NULL DEFAULT 'pending',
  due_date         DATE NOT NULL,
  paid_date        DATE,
  note             TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tuition_student_month UNIQUE (student_id, month, year)
);

CREATE INDEX idx_tuition_fees_student       ON tuition_fees(student_id);
CREATE INDEX idx_tuition_fees_academic_year ON tuition_fees(academic_year_id);
CREATE INDEX idx_tuition_fees_status        ON tuition_fees(status);
CREATE INDEX idx_tuition_fees_due_date      ON tuition_fees(due_date);

CREATE TRIGGER trg_tuition_fees_updated_at
  BEFORE UPDATE ON tuition_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.11 meal_plans --------------------------------------------------------
CREATE TABLE meal_plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
  date        DATE NOT NULL,
  meal_type   TEXT NOT NULL,              -- e.g. 'breakfast', 'lunch', 'snack'
  menu_items  TEXT NOT NULL,
  calories    INT,
  notes       TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_plans_school ON meal_plans(school_id);
CREATE INDEX idx_meal_plans_date   ON meal_plans(date);
CREATE INDEX idx_meal_plans_class  ON meal_plans(class_id);

CREATE TRIGGER trg_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3.12 notifications -----------------------------------------------------
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  type        notification_type NOT NULL DEFAULT 'announcement',
  target      notification_target NOT NULL DEFAULT 'all',
  target_id   UUID,                        -- class or user id depending on `target`
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_school    ON notifications(school_id);
CREATE INDEX idx_notifications_type      ON notifications(type);
CREATE INDEX idx_notifications_target    ON notifications(target, target_id);
CREATE INDEX idx_notifications_is_read   ON notifications(is_read);
CREATE INDEX idx_notifications_sent_at   ON notifications(sent_at);

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security (RLS)
-- ────────────────────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE schools         ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_fees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;

-- ── Helper function: get the current user's role ──
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper function: check if user is admin ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper function: get class IDs assigned to the current teacher ──
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids()
RETURNS SETOF UUID AS $$
  SELECT class_id FROM public.class_teachers WHERE teacher_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper function: get student IDs linked to the current guardian ──
CREATE OR REPLACE FUNCTION public.get_guardian_student_ids()
RETURNS SETOF UUID AS $$
  SELECT student_id FROM public.guardians WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ────────────────────────────────────
-- 4.1 schools
-- ────────────────────────────────────
CREATE POLICY "schools_select_authenticated"
  ON schools FOR SELECT
  TO authenticated
  USING (TRUE);                              -- any authenticated user

CREATE POLICY "schools_all_admin"
  ON schools FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────
-- 4.2 academic_years
-- ────────────────────────────────────
CREATE POLICY "academic_years_select_authenticated"
  ON academic_years FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "academic_years_all_admin"
  ON academic_years FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────
-- 4.3 users (profiles)
-- ────────────────────────────────────
-- Users can read their own profile
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admins see all users
CREATE POLICY "users_select_admin"
  ON users FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can manage all users
CREATE POLICY "users_all_admin"
  ON users FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Users can update their own profile (limited columns via app logic)
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ────────────────────────────────────
-- 4.4 classes
-- ────────────────────────────────────
CREATE POLICY "classes_select_authenticated"
  ON classes FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "classes_all_admin"
  ON classes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────
-- 4.5 class_teachers
-- ────────────────────────────────────
CREATE POLICY "class_teachers_select_authenticated"
  ON class_teachers FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "class_teachers_all_admin"
  ON class_teachers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ────────────────────────────────────
-- 4.6 students
-- ────────────────────────────────────
-- Admin: full access
CREATE POLICY "students_all_admin"
  ON students FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Teacher: can see students in their assigned classes
CREATE POLICY "students_select_teacher"
  ON students FOR SELECT
  TO authenticated
  USING (
    class_id IN (SELECT public.get_teacher_class_ids())
  );

-- Teacher: can update students in their classes (e.g. notes)
CREATE POLICY "students_update_teacher"
  ON students FOR UPDATE
  TO authenticated
  USING (
    class_id IN (SELECT public.get_teacher_class_ids())
  )
  WITH CHECK (
    class_id IN (SELECT public.get_teacher_class_ids())
  );

-- Guardian: can see their own children
CREATE POLICY "students_select_guardian"
  ON students FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.get_guardian_student_ids())
  );

-- ────────────────────────────────────
-- 4.7 guardians
-- ────────────────────────────────────
CREATE POLICY "guardians_all_admin"
  ON guardians FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "guardians_select_teacher"
  ON guardians FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT public.get_teacher_class_ids())
    )
  );

CREATE POLICY "guardians_select_own"
  ON guardians FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "guardians_update_own"
  ON guardians FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ────────────────────────────────────
-- 4.8 attendance
-- ────────────────────────────────────
CREATE POLICY "attendance_all_admin"
  ON attendance FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Teacher: full CRUD on their classes' attendance
CREATE POLICY "attendance_all_teacher"
  ON attendance FOR ALL
  TO authenticated
  USING (
    class_id IN (SELECT public.get_teacher_class_ids())
  )
  WITH CHECK (
    class_id IN (SELECT public.get_teacher_class_ids())
  );

-- Guardian: read-only on their children
CREATE POLICY "attendance_select_guardian"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT public.get_guardian_student_ids())
  );

-- ────────────────────────────────────
-- 4.9 health_records
-- ────────────────────────────────────
CREATE POLICY "health_records_all_admin"
  ON health_records FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "health_records_all_teacher"
  ON health_records FOR ALL
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT public.get_teacher_class_ids())
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT public.get_teacher_class_ids())
    )
  );

CREATE POLICY "health_records_select_guardian"
  ON health_records FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT public.get_guardian_student_ids())
  );

-- ────────────────────────────────────
-- 4.10 tuition_fees
-- ────────────────────────────────────
CREATE POLICY "tuition_fees_all_admin"
  ON tuition_fees FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "tuition_fees_select_teacher"
  ON tuition_fees FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.class_id IN (SELECT public.get_teacher_class_ids())
    )
  );

CREATE POLICY "tuition_fees_select_guardian"
  ON tuition_fees FOR SELECT
  TO authenticated
  USING (
    student_id IN (SELECT public.get_guardian_student_ids())
  );

-- ────────────────────────────────────
-- 4.11 meal_plans
-- ────────────────────────────────────
CREATE POLICY "meal_plans_select_authenticated"
  ON meal_plans FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "meal_plans_all_admin"
  ON meal_plans FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "meal_plans_insert_teacher"
  ON meal_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() = 'teacher'
  );

CREATE POLICY "meal_plans_update_teacher"
  ON meal_plans FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid()
  );

-- ────────────────────────────────────
-- 4.12 notifications
-- ────────────────────────────────────
CREATE POLICY "notifications_all_admin"
  ON notifications FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Broadcast notifications visible to everyone
CREATE POLICY "notifications_select_broadcast"
  ON notifications FOR SELECT
  TO authenticated
  USING (target = 'all');

-- Class notifications visible to teachers of that class
CREATE POLICY "notifications_select_class_teacher"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    target = 'class'
    AND target_id IN (SELECT public.get_teacher_class_ids())
  );

-- Individual notifications
CREATE POLICY "notifications_select_individual"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    target = 'individual'
    AND target_id = auth.uid()
  );

-- Teachers can create notifications
CREATE POLICY "notifications_insert_teacher"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('admin', 'teacher')
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Seed data
-- ────────────────────────────────────────────────────────────────────────────

-- 5.1 School
INSERT INTO schools (id, name, address, phone, email, principal_name, established_date)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Trường Mầm Non Doraemon',
  'Đường Phan Đình Phùng, Thành phố Hà Tĩnh, Tỉnh Hà Tĩnh',
  '0239 3888 888',
  'doraemon@mamnon-hatinnh.edu.vn',
  'Nguyễn Thị Doraemon',
  '2020-09-01'
);

-- 5.2 Academic year 2025–2026
INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '2025-2026',
  '2025-09-01',
  '2026-06-30',
  TRUE
);

-- 5.3 18 classes following Doraemon theme (6 nhóm × 3 lớp)
-- Doraemon 1–3 (khối Lá)
INSERT INTO classes (school_id, academic_year_id, name, grade_level, capacity) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Doraemon 1', 'la',     30),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Doraemon 2', 'la',     30),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Doraemon 3', 'la',     30),
-- Dorami 1–3 (khối Chồi)
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dorami 1',   'choi',   30),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dorami 2',   'choi',   30),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Dorami 3',   'choi',   30),
-- Nobita 1–3 (khối Mầm)
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Nobita 1',   'mam',    28),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Nobita 2',   'mam',    28),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Nobita 3',   'mam',    28),
-- Shizuka 1–3 (khối Nhà trẻ)
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Shizuka 1',  'nha_tre', 25),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Shizuka 2',  'nha_tre', 25),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Shizuka 3',  'nha_tre', 25);

-- ============================================================================
-- Done! 🎉
-- Run `supabase db reset` or `supabase migration up` to apply.
-- ============================================================================
