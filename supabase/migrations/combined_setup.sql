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


-- ============================================================================
-- PART 2: SEED CSV STUDENTS & GUARDIANS
-- ============================================================================

-- Seeding students and guardians from CSV

INSERT INTO students (id, school_id, class_id, student_code, full_name, date_of_birth, gender, address, enrollment_date, status) VALUES
  ('2b930716-9dd5-44c7-92ef-d92aab2a6ea6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0001', 'Đặng Trần Thảo An', '2019-01-09', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-07-04', 'active'),
  ('2aef9e26-a50e-483d-9dba-89efb513857a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0002', 'Phan Trần Quỳnh Anh', '2019-05-17', 'male', 'Hà Tĩnh, Hà Tĩnh', '2021-03-16', 'active'),
  ('937830b4-be09-41b1-a9ab-f5e5b9266691', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0003', 'Trần Trâm Anh', '2019-03-10', 'male', 'Lưu Vĩnh Sơn, Thạch Hà, Hà Tĩnh', '2021-09-29', 'active'),
  ('22e34652-555c-4b4f-977e-053811d97231', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0004', 'Nguyễn Quỳnh Anh', '2019-04-17', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-09-01', 'active'),
  ('3f04b5b0-6c67-437b-a819-aa0245a63a91', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0005', 'Lê Đăng Thế Bảo', '2019-03-26', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('ea69bfbc-ffcb-498b-8052-93e6178fe8ac', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0006', 'Lê Minh Chính', '2019-11-09', 'male', 'Tân Giang, Hà Tĩnh, Hà Tĩnh', '2022-04-18', 'active'),
  ('ae06c4ca-bb07-4b0f-bb15-a1bb16a97acc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0007', 'Thái Đoàn Linh Đan', '2019-09-06', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2023-09-25', 'active'),
  ('45d40ecd-7229-4e48-ae8c-af9d3381928b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0008', 'Nguyễn Minh Đăng', '2019-08-29', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2021-10-07', 'active'),
  ('2f1c5f70-ccd9-4f76-b174-63f01eb7da13', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0009', 'Trần Hải Đăng', '2019-02-01', 'female', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2020-09-10', 'active'),
  ('8fa85a04-c2d8-4402-b0bd-e20aa8327923', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0010', 'Nguyễn Xuân Giang', '2019-01-26', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-08-01', 'active'),
  ('6d3ea0fc-018c-436d-8935-ab8310f709c8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0011', 'Nguyễn Xuân Hiếu', '2019-04-24', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-04-25', 'active'),
  ('2045e205-55c5-48ba-afa1-fb2fec897367', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0012', 'Từ Tuấn Hưng', '2019-11-20', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-02-08', 'active'),
  ('f09612fb-0934-475c-a72a-8bf09c9360ba', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0013', 'Phan Công Gia Huy', '2019-05-07', 'female', 'Hà Huy Tập, Hà Tĩnh, Hà Tĩnh', '2021-09-27', 'active'),
  ('075690ed-a49a-4e2a-a78e-af9bb098f628', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0014', 'Mai Văn Gia Huy', '2019-05-20', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-05-11', 'active'),
  ('88c7cf66-e081-45f3-8104-98c561561502', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0015', 'Trương Quang Gia Huy', '2019-07-28', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-05-23', 'active'),
  ('d4229fa4-5f18-496c-89c5-a4ea8e7f0fc6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0016', 'Võ Tá Minh Khang', '2019-07-04', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-03-01', 'active'),
  ('cdd817bf-4e81-4504-9393-4077c707b872', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0017', 'Lê Đăng Khoa', '2019-01-27', 'female', 'Hà Tĩnh, Hà Tĩnh', '2020-08-15', 'active'),
  ('304d6588-5a7a-42b4-89bc-493c9f1d3331', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0018', 'Trần Sỹ Bảo Lâm', '2019-05-16', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-06-06', 'active'),
  ('43b05c45-b84e-4708-b138-eb0d9e6bf10b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0019', 'Nguyễn Tuấn Minh', '2019-08-06', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('52887c73-5d27-4b12-a916-418c4abde36d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0020', 'Phan Thị Ngọc Nhi', '2019-03-29', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2019-09-27', 'active'),
  ('0062e9b9-6793-45fe-8333-cb9e0a57e62a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0021', 'Nguyễn Hoàng Phúc', '2019-08-31', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-07-04', 'active'),
  ('621d3808-e9b2-43d0-a273-0f8692023ad8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0022', 'Nguyễn Linh Phương', '2019-12-10', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2021-08-02', 'active'),
  ('193783c8-3b48-4d0b-8124-f14ef9054b8b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0023', 'Nguyễn Xuân Quang', '2019-03-05', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-04-12', 'active'),
  ('6bc8502b-c0f4-4459-8e3c-3aff7297eba1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0024', 'Trần Anh Sang', '2019-08-16', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-04-18', 'active'),
  ('5fd5f956-6a8a-476d-b0b9-524e874456ff', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0025', 'Nguyễn Lê Phương Thùy', '2019-05-30', 'male', 'Hà Tĩnh, Hà Tĩnh', '2021-07-26', 'active'),
  ('49cdc968-7683-4ddd-8968-3e3525ceebc3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0026', 'Nguyễn Văn Quang Tuấn', '2019-06-06', 'male', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('0e3be470-9fc9-47b7-9a9a-198d4273bbb2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0027', 'Trần Quốc Tuấn', '2019-01-05', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-09-08', 'active'),
  ('e0837493-4fa2-4dcb-ac4d-8610ec95bf68', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0028', 'Nguyễn Trần Tuấn', '2019-04-01', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-05-02', 'active'),
  ('a4fcead1-9c4e-4bbd-bb4e-4e20119d3c1c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0029', 'Đoàn Trọng Vinh', '2019-09-27', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('01160350-1ce2-4d5f-b285-a19a8ef28f6d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 1' LIMIT 1), 'HS0030', 'Đinh Đại Vỹ', '2019-03-07', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('08580be1-d3e3-4202-9bdc-32fb4b95c520', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0031', 'Nguyễn Minh Anh', '2019-03-24', 'male', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('41945769-39f2-4965-be96-d60595353b2e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0032', 'Nguyễn Phan Diệp Anh', '2019-04-15', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('9e9138e3-3ad3-4c97-9cb8-b2c1c50dc17d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0033', 'Nguyễn Ngọc Thảo Chi', '2019-05-17', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('9ae51c80-a7a4-47fd-8a6f-ae978e19bf4d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0034', 'Nguyễn Lê Linh Đan', '2019-09-09', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-06-11', 'active'),
  ('4e8a20a3-39b8-48a0-98b1-6420a0849a7a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0035', 'Võ Lê Ngọc Diệp', '2019-07-30', 'female', 'Nam Hà, Hà Tĩnh, Hà Tĩnh', '2021-02-23', 'active'),
  ('8ff0f6eb-fe23-4d67-a963-f0d9e283ca47', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0036', 'Mai Trọng Minh Đức', '2019-06-11', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2021-02-22', 'active'),
  ('1edccb8b-d75c-49ab-a40d-ad763cd4abaa', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0037', 'Lê Ngọc Thùy Dương', '2019-12-02', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('619b863b-ac25-4846-87a8-b60f350a45ce', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0038', 'Lê Nguyễn Bảo Hà', '2019-07-11', 'male', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('3888fffb-3166-46a0-9752-5f968d3e3954', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0039', 'Nguyễn Duy Hưng', '2019-11-06', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-08-02', 'active'),
  ('59fc80df-dc32-41b6-a6b8-113dc9c0f9da', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0040', 'Phan Gia Hưng', '2019-04-30', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-08-02', 'active'),
  ('470b1704-4bc6-4a8c-bb37-1a90413029bd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0041', 'Nguyễn Gia Huy', '2019-01-03', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2021-02-23', 'active'),
  ('65d1c141-bbea-4816-8c0e-9819592f88cd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0042', 'Hồ Hoàng Ngọc Huyền', '2019-12-14', 'female', 'Lộc Hà, Hà Tĩnh', '2022-09-01', 'active'),
  ('14a95688-62a0-4be1-8bf5-56a5d3374d11', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0043', 'Nguyễn Minh Khang', '2019-05-12', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2021-03-31', 'active'),
  ('e1842820-7d82-461e-a6b3-c58f8d9bee6c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0044', 'Trần Lê Bảo Khang', '2019-02-28', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-07-04', 'active'),
  ('bf4dc7fd-9b53-44a4-ad94-25fed05a6916', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0045', 'Nguyễn Nam Khánh', '2019-12-01', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-17', 'active'),
  ('8452e478-7b95-4021-aefc-d8eb58368815', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0046', 'Lê Duy Khoa', '2019-06-16', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-08-02', 'active'),
  ('49694392-82d4-4ceb-a001-d8af519f3573', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0047', 'Lê Anh Khoa', '2019-04-30', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-07-01', 'active'),
  ('01654380-c7b2-482f-9708-cdea1a2c79b3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0048', 'Trần Ngọc Trang Linh', '2019-01-30', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-07-04', 'active'),
  ('b417213f-eb60-4160-9acd-4c81c8363ee3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0049', 'Hoàng Gia Minh', '2019-12-06', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('931c9d9a-3a25-4998-9190-ba7ce3bf3e48', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0050', 'Nguyễn Phan Minh Ngọc', '2019-11-02', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('ee07c062-cc2b-4220-8fea-9fbb440b2218', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0051', 'Lê Thảo Nguyên', '2019-05-01', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2021-03-29', 'active'),
  ('5cbe8ae4-372f-4c3f-a7ab-c9a0567454ec', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0052', 'Nguyễn Minh Phong', '2019-03-24', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('7ad7362f-474b-4303-80ba-271a5dd15084', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0053', 'Lưu Hoàng Phúc', '2019-06-30', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2021-03-02', 'active'),
  ('0d2a7659-065d-41a0-8960-980de3872369', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0054', 'Nguyễn Minh Phúc', '2019-09-24', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('73a68c74-7576-4ce9-baf5-dee0557f31b6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0055', 'Phan Trần Đăng Quang', '2019-10-08', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-06-01', 'active'),
  ('1fe01ee6-74fa-4694-8ff7-045fa36d51fd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0056', 'Trần Ngọc Thảo', '2019-02-14', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-06-01', 'active'),
  ('5579c861-963b-4367-91c5-316cf85393c2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0057', 'Nguyễn Tuấn Thiện', '2019-04-03', 'male', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('9467a22c-ac24-4adf-a0d2-8ce1abd81d9d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0058', 'Nguyễn Quang Thiệu', '2019-05-30', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('7d5c76b0-710d-4af3-9f93-b5cd0610b738', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0059', 'Nguyễn Anh Thư', '2019-09-09', 'female', 'Thạch Đài, Hà Tĩnh, Hà Tĩnh', '2022-09-01', 'active'),
  ('7517de24-5d19-4521-9b5a-79aa5a82e045', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0060', 'Phan Bảo Tiên', '2019-09-24', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2022-07-05', 'active'),
  ('df6784fe-1ea1-4e34-ad92-7b84e8c87c64', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 2' LIMIT 1), 'HS0061', 'Nguyễn Đức Vượng', '2019-02-09', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('52b7c3e8-bd58-480a-9ce3-cae1370a4d21', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0062', 'Trần Quốc An', '2019-10-22', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('37ed7a34-bea0-4f27-88d9-791a91f5a0fd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0063', 'Vũ Trâm Anh', '2019-11-21', 'male', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2022-09-01', 'active'),
  ('404eb1c7-8e09-4ab3-86d1-1aedf7f54ba0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0064', 'Nguyễn Diệp Chi', '2019-10-25', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-07-19', 'active'),
  ('8aed0649-cbf7-4bea-821d-2831cc81cac7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0065', 'Trần Hoàng Khánh Chi', '2019-02-02', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2022-09-19', 'active'),
  ('e96b7e9f-9c56-425d-b47d-ace83756129d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0066', 'Nguyễn Tấn Đạt', '2019-08-06', 'male', 'Văn Yên, Hà Tĩnh, Hà Tĩnh', '2023-08-01', 'active'),
  ('7aa5d509-6b2a-48b1-86d1-8dfdd434a3a5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0067', 'Nguyễn Trí Minh Đức', '2019-05-03', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-03-20', 'active'),
  ('35674b9a-5700-4c65-9c45-c3e5304db3fe', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0068', 'Trương Khánh Duyên', '2019-11-06', 'female', 'Thạch Đài, Hà Tĩnh, Hà Tĩnh', '2023-01-30', 'active'),
  ('3e85d3df-5596-461a-a76c-66c70ee43dc6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0069', 'Lê Thu Hà', '2019-09-28', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-03-02', 'active'),
  ('c6fb6a12-a98f-4ff6-a654-f4b6de40e2a1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0070', 'Trương Lâm Khả Hân', '2019-02-06', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-08-03', 'active'),
  ('90b2ea12-8415-42bf-b2f5-82936cca3aa7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0071', 'Lê Minh Huy', '2019-03-14', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-07-28', 'active'),
  ('70aa1b3c-23df-46e3-baab-c7a9782dc43e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0072', 'Nguyễn Phương Khánh Huyền', '2019-02-26', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('21c038b1-ba09-4a54-9cd4-ed4fad042d04', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0073', 'Nguyễn Thanh Huyền', '2019-03-02', 'female', 'Hà Huy Tập, Hà Tĩnh, Hà Tĩnh', '2023-09-05', 'active'),
  ('a7896833-0e02-459a-bd3d-f4994dfaed5b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0074', 'Trần Lê An Khang', '2019-07-23', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-09-01', 'active'),
  ('13fb9491-54b7-49ae-92f7-6804179c2b85', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0075', 'Bùi Đăng Khôi', '2019-03-12', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-02-21', 'active'),
  ('61510cd4-1226-4a62-8683-bbfd733a6256', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0076', 'Nguyễn Quốc Phú Lâm', '2019-02-20', 'female', 'Đại Nài, Hà Tĩnh, Hà Tĩnh', '2020-10-12', 'active'),
  ('31e3dc9d-c51c-4b3d-aa5a-db981479a567', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0077', 'Nguyễn Thảo Linh', '2019-11-09', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('9a0609ad-8ac8-4788-9d79-bd1297cb25ba', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0078', 'Lê Thảo Linh', '2019-12-07', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-08-22', 'active'),
  ('0cab414f-ef42-410c-a4a0-77ab81183c7e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0079', 'Nguyễn Anh Minh', '2019-04-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-08-02', 'active'),
  ('8fc99d1e-b984-4fe5-aa16-24818208a9c3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0080', 'Luyện Hoàng Nam', '2019-12-14', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-09', 'active'),
  ('23f94e60-30e6-4db8-af7b-86ac5ad277b1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0081', 'Phạm Thanh Nam', '2019-10-29', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('f8bd734d-7eea-45ab-9ba0-9df5671175cb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0082', 'Nguyễn Lâm Nhi', '2019-03-30', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-08-01', 'active'),
  ('b2399f4e-a29d-4eb7-ae3c-0dceaad96ebb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0083', 'Nguyễn Ngọc An Nhiên', '2019-10-27', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-08-22', 'active'),
  ('d42c88fb-ba94-40d2-8de0-2873caf217b8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0084', 'Trần Thái Anh Thư', '2019-08-29', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-07-25', 'active'),
  ('8b06c398-29e3-4692-ad43-b0f941c0504e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0085', 'Lê Anh Thư', '2019-03-11', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('3c51192f-c524-4cd2-9d08-bde1dd23a699', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0086', 'Đặng Minh Thúy', '2019-04-04', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-06-15', 'active'),
  ('e090c529-57e0-403d-891f-a31dd3db1118', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0087', 'Trương Minh Triết', '2019-10-19', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-08-05', 'active'),
  ('13eb5283-86ec-46a8-b970-e0ae25f9b601', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0088', 'Đào Quang Tuấn', '2019-05-25', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2020-09-03', 'active'),
  ('1f32dfc0-8a7b-4d3d-806c-053de7ee6c1a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0089', 'Nguyễn Duy Minh Vũ', '2019-05-12', 'female', 'Hà Tĩnh, Hà Tĩnh', '2021-07-19', 'active'),
  ('719c77cd-838e-4cb7-82ab-c8f96c622b79', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0090', 'Nguyễn Hữu Nhật Vượng', '2019-09-23', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('92b1a2db-f2bf-48e3-be5d-94162c5bc3e0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Doraemon 3' LIMIT 1), 'HS0091', 'Nguyễn Trần An Vy', '2019-01-19', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('f9120189-ccef-40a0-95f7-f24aa1268030', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0092', 'Lê Hoàng Bảo An', '2021-01-27', 'female', 'Nam Hà, Hà Tĩnh, Hà Tĩnh', '2022-08-09', 'active'),
  ('7b4defe6-d94f-4ac5-af76-dc37075e6cb3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0093', 'Nguyễn Thiên Ân', '2020-08-26', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('411c8a0c-e9f2-4215-82e4-494a5836701c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0094', 'Hồ Trâm Anh', '2021-03-14', 'female', 'Cày, Thạch Hà, Hà Tĩnh', '2022-10-24', 'active'),
  ('78ba2e38-ce63-45db-817d-f94adc19576a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0095', 'Nguyễn Minh Hằng', '2019-10-23', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-06-13', 'active'),
  ('3bb26086-dda4-463e-a83e-997f1144b21d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0096', 'Nguyễn Văn Minh Hiếu', '2020-10-14', 'male', 'Tân Giang, Hà Tĩnh, Hà Tĩnh', '2022-06-17', 'active'),
  ('eb78e69a-3fd1-438d-a2c5-72ba91c4a219', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0097', 'Nguyễn Phúc Hưng', '2020-11-24', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('14f40cff-8eff-4548-b83e-b7e80fe1bc30', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0098', 'Ngô Phúc Hưng', '2020-11-01', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('6a360797-0623-4f30-82ad-6d44059fd01a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0099', 'Võ Hoàng Huy', '2020-10-30', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('2732de23-f55f-4bc8-bdbf-bdfaa499373b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0100', 'Nguyễn Diệu Huyền', '2020-03-09', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-05', 'active');

INSERT INTO students (id, school_id, class_id, student_code, full_name, date_of_birth, gender, address, enrollment_date, status) VALUES
  ('995c3574-1df4-49ff-9ac6-57a84af2bb87', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0101', 'Phan Đình Duy Khánh', '2020-07-12', 'male', 'Hộ Độ, Lộc Hà, Hà Tĩnh', '2023-05-04', 'active'),
  ('96c174a9-fca6-4d7a-a052-0c308c219319', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0102', 'Lê Đăng Khôi', '2020-03-16', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('5aba735b-74a1-4570-b89a-d231741f9ad6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0103', 'Nguyễn Mạnh Kiên', '2020-11-24', 'male', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2022-07-18', 'active'),
  ('9cfc4015-8f23-4fd0-895e-a57663a0a9d2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0104', 'Phạm Trần Khánh Linh', '2020-05-31', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-07-30', 'active'),
  ('bd626906-651c-4352-ba97-6130289aaa17', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0105', 'Phan Hoàng Minh', '2020-04-13', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-07-11', 'active'),
  ('1fc89e10-ddd4-4b9c-a23c-8d94a14994bd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0106', 'Nguyễn Ngọc Lê Na', '2020-04-08', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-09-01', 'active'),
  ('62df8443-475b-402f-9bbd-15997293bc58', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0107', 'Phan Hải Nam', '2020-04-13', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-07-11', 'active'),
  ('cb35a713-c4a6-434d-b249-b4dc6c1ff92f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0108', 'Bùi Khôi Nguyên', '2020-10-24', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('d200f48a-c572-48ea-89a8-d64de81d6c9e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0109', 'Nguyễn Tiến Nhân', '2020-10-09', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-06-28', 'active'),
  ('70e92fad-9286-460d-a8e8-961d6b17724e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0110', 'Trần Phan Gia Nhi', '2021-02-10', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-06-13', 'active'),
  ('3b7ec3bd-3ac7-4148-bc6e-db50d36ea0a9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0111', 'Nguyễn Trọng Phúc', '2020-03-21', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-06-01', 'active'),
  ('dbc217fa-31c4-4edb-82a4-241be48c8a1d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0112', 'Nguyễn Trường Phúc', '2020-05-01', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('5553ddf0-7061-4fd6-8a8b-2836b56c5c54', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0113', 'Nguyễn Thị Như Quỳnh', '2020-12-16', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-11-01', 'active'),
  ('433309ef-9b4f-4b6b-ad54-df0a72dc75ca', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0114', 'Nguyễn Hà Phương Trang', '2021-07-28', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-02-20', 'active'),
  ('9890ff01-543b-4420-9e9d-30c73df3077c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0115', 'Trần Quỳnh Trang', '2020-10-18', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-08-22', 'active'),
  ('3c98eed9-6062-4a2a-953d-bc809efb85f2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0116', 'Đỗ Đức Hưng Vượng', '2020-02-04', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-08-11', 'active'),
  ('30dbb3bb-a45f-48f3-89da-2323c493fbe0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0117', 'Hồ Nhã Vy', '2020-12-19', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-08-24', 'active'),
  ('1dedf6ba-0c95-426e-8952-1ca80609c031', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 1' LIMIT 1), 'HS0118', 'Nguyễn Yến Vy', '2020-07-22', 'female', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2022-06-13', 'active'),
  ('6983aa9a-afdb-4b04-ac4a-9b83882f11c8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0119', 'Trần Khải An', '2020-09-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('facef156-85d9-4194-a5ce-fa2942a1a008', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0120', 'Lê Hồng Ân', '2020-01-06', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('ae46b7bc-1a2c-4388-8fa3-0e32991a95a9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0121', 'Trần Phan Anh', '2020-02-06', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('0853f313-a13b-4ec4-89f8-764aa4269f69', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0122', 'Nguyễn Đặng Gia Bảo', '2020-08-31', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-10-17', 'active'),
  ('dfe63e9c-aa8d-4221-9e1c-cb7de3eca4e1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0123', 'Nguyễn Trọng Minh Bảo', '2020-12-16', 'male', 'Nam Hà, Hà Tĩnh, Hà Tĩnh', '2020-07-01', 'active'),
  ('dfb1a76d-2c9a-4371-bb0e-ad2d1fc79b58', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0124', 'Trần Lê Quỳnh Chi', '2020-05-29', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-08-16', 'active'),
  ('7667cf9c-4f11-4141-a19b-779a20567983', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0125', 'Trần Nguyễn Khánh Chi', '2020-03-07', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-07-20', 'active'),
  ('8a2fda52-863b-4739-a8fc-2d112fc5e819', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0126', 'Phạm Nguyễn Ngọc Diệp', '2020-04-28', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-10-05', 'active'),
  ('5b34dd7c-95f7-4bb2-834f-ee4d902e4c37', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0127', 'Phan Ngọc Ánh Dương', '2020-10-31', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-05-28', 'active'),
  ('2b151757-5d25-44d0-a523-187e50ccae2d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0128', 'Nguyễn Mạnh Hùng', '2019-09-28', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-08-10', 'active'),
  ('831be383-7b44-476b-a513-e71a2cc1b641', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0129', 'Nguyễn Văn Gia Hưng', '2020-05-15', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-02-06', 'active'),
  ('641af681-049c-45b2-9be0-711aad2d057f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0130', 'Trần Quang Huy', '2020-04-17', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-09-01', 'active'),
  ('a2467d82-206e-4929-9f69-84c5f3d887d3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0131', 'Trần Nguyên Khang', '2020-08-17', 'male', 'Hộ Độ, Lộc Hà, Hà Tĩnh', '2023-05-15', 'active'),
  ('273bf258-2174-478c-9aec-39774ab66d5c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0132', 'Lê Đăng Khoa', '2020-06-17', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-09-05', 'active'),
  ('0747b181-4f84-4cce-a54c-71a1751f1d30', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0133', 'Nguyễn Anh Khôi', '2020-04-20', 'male', 'Tân Giang, Hà Tĩnh, Hà Tĩnh', '2022-05-16', 'active'),
  ('37ad5b35-0dc7-4640-b806-d3afc5f4dd80', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0134', 'Trần Tuệ Mẫn', '2020-09-20', 'female', 'Đồng Môn, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('0ec40805-5cfb-449a-be66-a9c4af9dc7e3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0135', 'Lê Nhật Minh', '2020-07-17', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('f97deb85-3864-4103-baab-c72d6fc1ea9f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0136', 'Lê Trọng Anh Minh', '2020-06-30', 'male', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2022-05-16', 'active'),
  ('760f3f4e-be8c-4e93-8fd2-e73b66c2058b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0137', 'Phan Lê Kim Ngân', '2020-06-28', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-04-18', 'active'),
  ('7f747fa0-1b77-4ca8-aed1-b5a6297bfbd2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0138', 'Bùi Thị Kim Ngân', '2020-05-13', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-08-14', 'active'),
  ('8472e5b0-ffbb-4ea0-b63b-f2724329164d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0139', 'Hà Bảo Ngọc', '2020-07-22', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-06-06', 'active'),
  ('c8ae0784-0cc2-47c7-8b47-a40597a2aec0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0140', 'Trần Danh Nguyên', '2020-06-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-02-15', 'active'),
  ('ad5798bb-db3b-4b5f-b689-78300a02be5a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0141', 'Phan Văn Thái Thông', '2020-05-20', 'male', 'Thạch Châu, Lộc Hà, Hà Tĩnh', '2024-02-01', 'active'),
  ('54876f9e-6623-45b9-bbd4-508ea7329e28', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0142', 'Lê Anh Thư', '2020-10-30', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-10-17', 'active'),
  ('5393ab80-5778-4f9e-9d7a-75b8f95dc2f9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0143', 'Nguyễn Trần Phương Trang', '2020-02-15', 'female', 'Lưu Vĩnh Sơn, Hà Tĩnh, Hà Tĩnh', '2022-07-27', 'active'),
  ('dee48c1f-af69-4c35-9822-f15102c2f608', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 2' LIMIT 1), 'HS0144', 'Trần Công Minh Trí', '2020-12-09', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('bd3ea065-d19b-4265-b99c-c60b740c046e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0145', 'Nguyễn Nữ Hà Anh', '2020-08-18', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-09-16', 'active'),
  ('7924082e-8887-4e60-b140-47c9fdfd1783', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0146', 'Nguyễn Phương Anh', '2020-10-19', 'female', 'Vũ Quang, Hà Tĩnh', '2024-10-07', 'active'),
  ('c28c6e24-1862-4e8e-8b80-438b603aa2ea', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0147', 'Quách Thùy Anh', '2020-05-03', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-02-06', 'active'),
  ('24eedb56-477b-4c31-a548-abde8133285f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0148', 'Phạm Mai Chi', '2020-01-10', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2021-08-10', 'active'),
  ('01ca4e79-263e-47c3-a962-2ab1a355d937', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0149', 'Nguyễn Khánh Đan', '2020-10-20', 'female', 'Nam Hà, Hà Tĩnh, Hà Tĩnh', '2022-10-01', 'active'),
  ('fbf398b6-9113-4ea3-afc2-9583e7945e0a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0150', 'Phạm Phúc Đăng', '2020-07-31', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('a6913159-e223-4317-860c-6da26389f727', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0151', 'Nguyễn Hà Diễm', '2020-05-01', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2022-06-06', 'active'),
  ('44121a4f-e811-4c8b-922e-eff8a42e4161', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0152', 'Nguyễn Hoàng Thùy Dương', '2020-02-23', 'male', 'Hà Tĩnh, Hà Tĩnh', '2021-08-31', 'active'),
  ('83da16a5-a93a-4b22-98bc-3e5ca0d37f96', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0153', 'Nguyễn Khánh Hà', '2020-09-19', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-07-18', 'active'),
  ('26c5fe0f-48b0-45b3-a5af-a312c3e7f56c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0154', 'Trần Gia Hân', '2020-01-17', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2021-10-12', 'active'),
  ('67ae2bb4-54aa-4c8e-acad-20f9e0fe361a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0155', 'Trần Phúc Khang', '2020-05-29', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-06-01', 'active'),
  ('1e238b13-de56-44bd-9425-09e30542d8df', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0156', 'Nguyễn Thảo Linh', '2020-04-18', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2021-12-06', 'active'),
  ('bb2d2a28-cd9f-4035-b6ca-3b73f3c0992e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0157', 'Phan Hoàng Minh', '2020-12-17', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-09-19', 'active'),
  ('d8173746-da9d-4548-bbdd-907380484545', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0158', 'Phan Trọng Khánh Nam', '2020-09-13', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2022-03-21', 'active'),
  ('9a4e828b-bc6a-467c-b283-b393978c8c72', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0159', 'Trương Cao Khánh Ngân', '2020-10-09', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('d05db175-89ab-4908-ace7-ad84186d2dbc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0160', 'Lê Hữu Nghĩa', '2020-03-13', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-08-22', 'active'),
  ('1ee5cff0-ce93-4885-894e-d003ea4d34be', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0161', 'Trần Hà Thảo Nhi', '2020-06-09', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-05-16', 'active'),
  ('4bbd19dd-314d-4db4-95c2-203732542918', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0162', 'Ngô Nguyễn Cẩm Nhung', '2020-08-31', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-02-07', 'active'),
  ('5f177958-9ed7-4667-baf2-fb5abcc51435', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0163', 'Phan Hoàng Phong', '2020-09-27', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2020-04-12', 'active'),
  ('8946f79c-722c-43c3-aa58-f1a2c47ce422', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0164', 'Nguyễn Đức Phúc', '2020-12-09', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('0c49be86-8f3b-4399-8cc1-2c1a7b84da1d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0165', 'Nguyễn Duy Mạnh Quân', '2020-03-09', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2022-08-08', 'active'),
  ('2b773290-b5b7-43fd-8504-2a1bbe7381a2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0166', 'Nguyễn Đông Quân', '2020-12-16', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2023-08-02', 'active'),
  ('18526d5a-1990-475a-aae8-2bba12927522', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0167', 'Phan Huy Minh Quang', '2020-04-08', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-02-28', 'active'),
  ('399585fe-9c00-4cb2-9615-1575b7fa10da', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0168', 'Hoàng Thái Sơn', '2020-08-15', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-08-15', 'active'),
  ('1ade637b-01d8-4a1d-bfce-2885e5a6b12a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0169', 'Trần Hoàng Sơn', '2020-03-03', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('ebfa5fbd-f78d-42ec-9084-4c488f93ea7f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0170', 'Nguyễn Tâm Thảo', '2020-07-16', 'female', 'Lưu Vĩnh Sơn, Thạch Hà, Hà Tĩnh', '2024-05-06', 'active'),
  ('1e6d53d1-7b0c-4b36-ab60-0a5212fbec91', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0171', 'Nguyễn Anh Thư', '2020-10-04', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('f33e41a7-f1f8-4a0e-aa4e-b93cc820baad', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Nobita 3' LIMIT 1), 'HS0172', 'Bùi Bá Thế Trí', '2020-07-01', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-03-16', 'active'),
  ('45cb722e-a8ed-4fbd-bb0a-85e2669755c1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0173', 'Lê Minh Anh', '2022-01-04', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-09-18', 'active'),
  ('cb84835c-b13b-4225-8d0f-5278beda13c3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0174', 'Nguyễn Minh Châu', '2021-02-15', 'female', 'Lưu Vĩnh Sơn, Thạch Hà, Hà Tĩnh', '2023-09-21', 'active'),
  ('ea51d355-c8ef-4a30-aed4-2f555c703d2e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0175', 'Nguyễn Ngọc Diệp', '2021-06-19', 'female', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('bc3ea1aa-c1bc-4cc9-a96c-6fb9c511b086', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0176', 'Nguyễn Trần Nhật Hạ', '2021-10-30', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('fe9cdcec-3b11-4c88-adbf-3fca4b595174', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0177', 'Nguyễn Ngọc Gia Hưng', '2021-04-16', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-10-04', 'active'),
  ('30626f7a-44f5-4c45-b7a3-f42fef528647', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0178', 'Lê Doãn Bảo Hưng', '2021-12-14', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-11-15', 'active'),
  ('80b14746-59ec-4665-8146-65d5bbfc517f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0179', 'Lê Minh Khôi', '2021-09-13', 'male', 'Nam Điền, Thạch Hà, Hà Tĩnh', '2023-06-05', 'active'),
  ('be363390-1864-4c23-a03b-8e547473d2ad', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0180', 'Ngô Đức Kiên', '2021-05-08', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('3dd16696-6fda-4621-bc5b-adc4cbebf7ef', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0181', 'Tống Tuệ Lâm', '2021-12-15', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-12', 'active'),
  ('27d2010b-1b84-48d7-9fc3-16f178248243', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0182', 'Hoàng Diệu Linh', '2021-10-28', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-25', 'active'),
  ('517c72bb-eec7-4a9d-b708-712da593ec87', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0183', 'Nguyễn Anh Minh', '2021-12-21', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-09-01', 'active'),
  ('b097ca10-cbd1-49e2-aae0-745a183f6046', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0184', 'Nguyễn Khánh Tuệ Ngân', '2021-12-02', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('378e7f7b-ce3d-44c9-8714-c14eb68194e9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0185', 'Nguyễn Tuệ Ngân', '2021-06-01', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('69588992-d0c0-422d-ac60-0d63febb7920', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0186', 'Đặng Lê Thảo Ngân', '2021-07-04', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-07-04', 'active'),
  ('fe410632-6046-4a64-86a0-b834bcc6a488', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0187', 'Ngô Minh Nhật', '2021-09-10', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-09-01', 'active'),
  ('4a86882a-4c2e-43f3-9f53-19accb4d33a9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0188', 'Lê Hoàng Linh Nhi', '2022-05-23', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-03-06', 'active'),
  ('8d53911a-3585-441e-8831-27e90bd1cecc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0189', 'Lê Đoàn Tuệ Nhi', '2021-10-14', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('f8ddf126-c2f2-45e5-b978-ca4d148397fc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0190', 'Nguyễn Trần Khả Như', '2021-01-01', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('69ce14e4-b4cf-41a4-af22-7267af5b6e3b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0191', 'Lê Linh San', '2021-12-26', 'female', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2023-11-03', 'active'),
  ('2114ad69-46ea-422b-8ae3-6203af1f4ad4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0192', 'Nguyễn Thanh Thảo', '2021-10-15', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-09-18', 'active'),
  ('4f8b2105-462b-492e-a6d3-06605b6faf62', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0193', 'Dương Khánh Trâm', '2021-11-18', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('7e3c4943-7e65-4d62-b8d7-933014f1c7c5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0194', 'Trần Yến Trang', '2021-05-09', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('180e1ca3-54ea-4a2f-b71a-b72511f9b8fa', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0195', 'Trần Minh Trí', '2021-11-26', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-08-02', 'active'),
  ('51a95bdb-8379-4202-9f14-fc680f208daa', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0196', 'Nguyễn Anh Vũ', '2021-09-16', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-03-18', 'active'),
  ('d4242a3c-c8b3-4ad1-b257-712f1d4ee01b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 1' LIMIT 1), 'HS0197', 'Trần Thảo Vy', '2021-06-22', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-08-01', 'active'),
  ('4825e299-6d4c-4867-93e2-b1b484766e08', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0198', 'Trần Nguyễn Bảo Châu', '2021-02-27', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-02-04', 'active'),
  ('6a9bdc08-4ba1-48bb-ac47-ad71aef85ab0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0199', 'Nguyễn An Chi', '2021-03-12', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-08-15', 'active'),
  ('c56d09ce-4cc2-4b4e-8e56-95e8ecced581', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0200', 'Thái Phúc Minh Đăng', '2021-08-29', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-05-06', 'active');

INSERT INTO students (id, school_id, class_id, student_code, full_name, date_of_birth, gender, address, enrollment_date, status) VALUES
  ('f37c24b6-318a-4c8e-93af-6a6644738251', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0201', 'Nguyễn Hữu Đạt', '2021-09-18', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-08-07', 'active'),
  ('8e2deb28-48ae-4262-8200-28fca9bac412', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0202', 'Nguyễn Văn Tuấn Dũng', '2021-08-01', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-08-01', 'active'),
  ('0ecc6de8-fb6d-4bb5-91b7-566f58bbb79b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0203', 'Hồ Ngọc Hân', '2021-10-28', 'female', 'Thạch Hưng, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('fa2f3852-0a07-47bb-95e6-116057a913ab', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0204', 'Trương Huy Gia Hưng', '2021-06-27', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('33ad1ac7-8683-4e4d-b6a5-25631a4ab041', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0205', 'Nguyễn Minh Hưng', '2021-04-02', 'male', 'tỉnh Hà Tĩnh, Hà Tĩnh, Hà Tĩnh', '2023-01-03', 'active'),
  ('4aee7619-4706-410b-ad29-7ab5d9c3c42f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0206', 'Nguyễn Lê Đình Hữu', '2021-03-30', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('91f1d8f1-3875-4767-b57c-92de472fcee3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0207', 'Trần Trung Kiên', '2021-02-21', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-05', 'active'),
  ('abc56063-8541-4ffa-af2e-9d50a6ed9a4e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0208', 'Nguyễn Nhật Linh', '2021-11-10', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-05-04', 'active'),
  ('ae7a5e8d-5289-45a4-95ea-f21007001701', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0209', 'Lê Khánh Linh', '2021-04-12', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-08-14', 'active'),
  ('3153444a-6ff6-4dd4-bfa9-6640651893a3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0210', 'Bùi Nguyễn Thùy Linh', '2021-02-22', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-02-01', 'active'),
  ('3b43efa2-6ba1-41b0-94d9-59a997dda65f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0211', 'Nguyễn Duy Quang Minh', '2021-11-14', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-08-01', 'active'),
  ('150c2973-3562-4d1b-9153-4636d1329e8d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0212', 'Lê Văn Đăng Minh', '2021-12-07', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('9d0cb0d3-84b9-43fc-95eb-9245c9b133fd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0213', 'Nguyễn Trần Hoàng My', '2021-11-12', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2023-07-31', 'active'),
  ('b2f53756-c485-4c6e-b376-2da5b47d1171', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0214', 'Dương Bảo Nam', '2021-09-03', 'male', 'Đại Nài, Hà Tĩnh, Hà Tĩnh', '2023-01-30', 'active'),
  ('939f51ea-c126-414c-a854-b71138f1e732', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0215', 'Trần Nguyễn Kim Ngân', '2021-02-12', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2022-10-11', 'active'),
  ('5112380f-312d-4ab2-b5c9-368a1d527fd7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0216', 'Nguyễn Minh Ngọc', '2021-01-10', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('738c3eff-f1e6-4503-86f6-ae804930ca11', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0217', 'Nguyễn Đình Khôi Nguyên', '2021-09-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('aab13a5c-bff1-4e66-b6f3-f045054d6d2e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0218', 'Nguyễn Đình Nhật', '2021-09-09', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('a3e9b37d-2414-4633-95d0-ec1c93a9ac90', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0219', 'Nguyễn Huy Đức Thắng', '2021-10-06', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-08-03', 'active'),
  ('9c3f2d02-adbb-44db-939d-8385d93b8652', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0220', 'Nguyễn Phương Thảo', '2021-01-08', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('1bb23943-d59a-4674-bacb-95c5d50eeecb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0221', 'Lê Văn Anh Tú', '2021-01-13', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-06-17', 'active'),
  ('8bd21496-fa19-425a-9618-429d83bcdbac', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 2' LIMIT 1), 'HS0222', 'Phan Duy Tùng', '2021-09-30', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('3343d63e-08a3-48b3-b856-c3f677be7a5c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0223', 'Đinh Bảo An', '2021-10-28', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('9e00e2b5-6e9b-422a-8911-7185736bf442', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0224', 'Biện Nguyễn Khánh An', '2021-06-01', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('5a7f2332-6956-4cb5-be0a-e0ee4c7509b4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0225', 'Võ Tuệ Anh', '2021-11-25', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-09-01', 'active'),
  ('c875f6eb-1d6a-4af9-b634-bf326d6c79c2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0226', 'Nguyễn Cao Quỳnh Anh', '2021-10-20', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('e831f0a4-04e8-4feb-83b1-f2eecef70bef', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0227', 'Lê Hoàng Anh', '2021-06-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-12-19', 'active'),
  ('fdd8f94d-d5a7-43b8-9ed8-07834f0ac0c7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0228', 'Phạm Minh Chính', '2021-04-23', 'male', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2022-09-05', 'active'),
  ('dcc79844-a1f3-43b6-9b80-c3da2c5c0e4f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0229', 'Nguyễn Linh Đan', '2021-12-08', 'female', 'Hà Tĩnh, Hà Tĩnh, Hà Tĩnh', '2023-08-12', 'active'),
  ('e2eab20e-f38c-46b1-8e0a-ba15d87fc457', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0230', 'Ngô Hải Đăng', '2021-04-25', 'male', 'Hà Tĩnh, Hà Tĩnh, Hà Tĩnh', '2022-09-13', 'active'),
  ('6ddab1d6-5d5e-4443-98fa-acd19bf9bd8a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0231', 'Nguyễn Khắc Phúc Đăng', '2021-05-09', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-10-10', 'active'),
  ('9a937b6f-913e-437f-b58f-c36a0f9e4e3f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0232', 'Lê Uy Dũng', '2021-05-27', 'male', 'Tân Giang, Hà Tĩnh, Hà Tĩnh', '2022-10-19', 'active'),
  ('2cf846cf-f741-47b6-bb2f-e2b4955daeed', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0233', 'Nguyễn Văn Bảo Khang', '2021-09-29', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('7fa40c0e-c066-4c21-a679-ac34c6082ab1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0234', 'Phan Công Nam Khánh', '2021-09-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-07-03', 'active'),
  ('c8a6b1ea-b53b-4d2d-a0c1-edf3fa3b542a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0235', 'Lê Anh Khôi', '2021-09-10', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-08-01', 'active'),
  ('92b4dffd-4bc9-4360-bd2f-2d38928ea5d4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0236', 'Nguyễn Trung Kiên', '2021-04-06', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-01-30', 'active'),
  ('f55155c7-0957-45c2-9584-28352fc1c995', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0237', 'Nguyễn Văn Phúc Lâm', '2021-01-29', 'male', 'Hà Tĩnh, Hà Tĩnh', '2022-12-01', 'active'),
  ('5f6fe9b9-d222-4fb9-a233-6915b0c16f2e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0238', 'Võ Lê Tú Linh', '2021-08-20', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-02-03', 'active'),
  ('681f57ce-976b-43b6-a492-5cd3b2745ac4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0239', 'Hà Thị Huyền Ly', '2021-01-12', 'female', 'Thạch Đài, Thạch Hà, Hà Tĩnh', '2022-11-28', 'active'),
  ('a313adea-c2bb-4b05-a84d-703a7d8892e3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0240', 'Phan Hà My', '2021-06-05', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-09-01', 'active'),
  ('50ecffea-d354-415d-b256-70cb500f02d1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0241', 'Nguyễn Bảo Ngọc', '2021-08-19', 'male', 'Thạch Hà, Hà Tĩnh, Hà Tĩnh', '2023-01-30', 'active'),
  ('3eb348e0-0a63-43eb-a867-c02b40baf5a5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0242', 'Mai Ngọc Tuệ Nhi', '2021-07-29', 'female', 'Thạch Hà, Hà Tĩnh, Hà Tĩnh', '2023-03-01', 'active'),
  ('de1b129b-56f5-4f9e-b882-eed96840b891', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0243', 'Nguyễn Viết Hoàng Quân', '2021-06-01', 'male', 'Thạch Hưng, Hà Tĩnh, Hà Tĩnh', '2023-01-30', 'active'),
  ('b767ec93-1613-4df1-9e89-9ca239eb6f44', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0244', 'Trần Nhật Quang', '2021-05-02', 'male', 'đường Hà Hoàng, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('fcc17d3f-a31f-446a-b02c-2a2570e2f6e6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0245', 'Tô Linh San', '2021-04-16', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2022-11-28', 'active'),
  ('fe836e7b-71f9-4ed3-b465-7fbb4babb578', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0246', 'Nguyễn Trí Gia Thành', '2021-05-09', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-06-10', 'active'),
  ('13b32b8a-905a-40e4-a7e1-e3f1db06f54c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 3' LIMIT 1), 'HS0247', 'Nguyễn Cát Thảo', '2021-06-19', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-09-01', 'active'),
  ('f1a257e0-4284-4af0-89fc-4e59412cea94', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0248', 'Nguyễn Diệp Anh', '2021-06-09', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-07-07', 'active'),
  ('c0db6b98-04b3-4af1-ae7d-b4f7b5f871d4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0249', 'Hồ Kiều Bảo Anh', '2021-10-25', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('09506cc0-21d0-4b3f-a40f-340922226cf7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0250', 'Trương Hoàng Bách', '2021-02-08', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-27', 'active'),
  ('707dad1d-e0c4-4ffb-90c1-bf553c04f42f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0251', 'Võ Tá Hải Đăng', '2021-08-11', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-04-15', 'active'),
  ('a247734d-fbea-4322-8922-250b0e5e11fc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0252', 'Lê Hải Đăng', '2021-12-13', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-02-27', 'active'),
  ('b74ce70a-9cec-4e61-99d9-56048124b3b6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0253', 'Nguyễn Lê Quỳnh Di', '2021-09-10', 'female', 'Tân Giang, Hà Tĩnh, Hà Tĩnh', '2023-08-10', 'active'),
  ('e60e0b6f-4623-4ac3-91ed-2ddb4d302f1e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0254', 'Võ Quốc Hoàng', '2021-01-30', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-04-17', 'active'),
  ('5c37de2d-1850-4deb-9f6c-f4cf32d4fe7a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0255', 'Lê Gia Huân', '2021-03-09', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-03-01', 'active'),
  ('63ca63b6-dd96-4833-a67e-ff142f2d47f7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0256', 'Hoàng Bảo Khang', '2022-04-21', 'male', 'Thạch Hưng, Hà Tĩnh, Hà Tĩnh', '2024-03-25', 'active'),
  ('46e428bf-610c-4798-b154-42c44839bf3d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0257', 'Mai Gia Khánh', '2021-12-12', 'male', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('3d2cc572-5108-43a3-9a3c-e6533ee792a0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0258', 'Trần Anh Khôi', '2021-01-21', 'male', 'Tượng Sơn, Thạch Hà, Hà Tĩnh', '2023-02-13', 'active'),
  ('d0fea58f-c471-41b8-962e-822af1c77a5c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0259', 'Nguyễn Hoàng Trung Kiên', '2021-06-13', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-03-14', 'active'),
  ('f384b37a-ef61-45b6-8406-6ec99c85eb97', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0260', 'Phạm Thái Minh', '2021-06-21', 'male', 'Thạch Đài, Thạch Hà, Hà Tĩnh', '2023-10-23', 'active'),
  ('b1eb3b40-dc20-4598-badb-090f7dc6fc7e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0261', 'Nguyễn Văn Hoàng Nam', '2021-02-03', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-04-01', 'active'),
  ('f3a899d0-c908-4afc-a9ab-f403634ddd6c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0262', 'Trần Diệu Nhi', '2021-03-10', 'female', 'Sơn Lộc, Can Lộc, Hà Tĩnh', '2023-07-31', 'active'),
  ('dbb0a037-2940-4610-adad-36d3b3686714', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0263', 'Nguyễn Phát', '2021-01-28', 'male', 'Đồng Môn, Hà Tĩnh, Hà Tĩnh', '2023-04-03', 'active'),
  ('21caf213-ff0d-4dcd-9d34-58b4ce3e7c1a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0264', 'Nguyễn Minh Phương', '2021-10-24', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('4f86b27d-b81e-4cc0-bb6e-6d86d9f2d0a5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0265', 'Trần Hoàng Quân', '2021-10-18', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-02-27', 'active'),
  ('4a311a0a-9f3a-4953-ac87-814759c253b7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0266', 'Hoàng Mạnh Quân', '2021-03-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-03-27', 'active'),
  ('233f3c92-0a62-41af-8b71-ad46d2eb34b1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0267', 'Trần Thanh Sang', '2021-07-23', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-04-24', 'active'),
  ('e55127c9-29da-49f9-b61b-a4abf384708a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0268', 'Nguyễn Bảo Trâm', '2021-01-17', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-04-10', 'active'),
  ('a6fbe965-69fb-4c64-a3b1-7c89a9ebcd83', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0269', 'Dương Thùy Trang', '2021-06-01', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-03-06', 'active'),
  ('e40f85b5-3bc6-45c9-9e93-36b2825a4f7a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0270', 'Bùi Bảo Minh Trang', '2021-09-21', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-03-01', 'active'),
  ('35efbef9-300d-41c5-8437-c177ca3ece31', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0271', 'Trần Võ Khánh Vy', '2021-08-25', 'female', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2023-03-23', 'active'),
  ('e1904332-3e16-49bc-879c-7881704cf912', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 4' LIMIT 1), 'HS0272', 'Lê Ngọc Khánh Vy', '2021-06-11', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-04-10', 'active'),
  ('95c7a3c7-3dd8-4607-923f-5a21db9269a8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0273', 'Trần Hà Anh', '2023-03-16', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-07-29', 'active'),
  ('7ba99bff-f03b-4dce-af8a-6794906eabd0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0274', 'Nguyễn Hoàng Minh Châu', '2023-01-04', 'female', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('14b6babc-40c2-48ec-9db8-dc8bc898fed6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0275', 'Nguyễn Kim Chi', '2023-04-13', 'female', 'Đại Nài, Hà Tĩnh, Hà Tĩnh', '2024-05-17', 'active'),
  ('41fccee7-3c0d-4d27-aa64-8ea5202e02cb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0276', 'Nguyễn Trường Hải', '2023-03-23', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-09-10', 'active'),
  ('431b48de-008f-42c4-a642-d94986564318', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0277', 'Nguyễn Gia Hân', '2023-03-17', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-06-18', 'active'),
  ('71c9f0a9-c9c1-4614-b624-3168a1c43795', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0278', 'Văn Ngọc Gia Hân', '2023-03-02', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('bb40785a-a29c-472d-82cb-882d5cd358a6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0279', 'Hà Đăng Khoa', '2023-01-04', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('81a9ed91-9730-4b42-a9e0-31709e0ff71a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0280', 'Nguyễn Xuân Mạnh', '2023-01-22', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('ba852746-450f-4d28-93bd-8cd455754756', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0281', 'Phan Đăng Nhật Minh', '2023-03-31', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('2f3efa52-ed3f-4407-9f97-9eca50a979cf', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0282', 'Trần Hoàng Minh', '2023-01-09', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-01', 'active'),
  ('ca63d63f-9f07-4336-8621-6de0a81a55f6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0283', 'Nguyễn Nhật Minh', '2023-05-26', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('db297ce4-973f-4654-9e01-cf1382f132fb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0284', 'Phan Nguyễn Hà My', '2023-05-14', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('62599974-4273-443e-af1d-dd20a6d71911', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0285', 'Thái Hoàng Gia Nhi', '2023-02-14', 'female', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('972aeeb2-9755-40c4-8ba8-8fb720340f3f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0286', 'Nguyễn Khánh Nhi', '2023-06-01', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-09-16', 'active'),
  ('3daefe59-51ab-4b33-bb6f-5b9f5072ee82', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0287', 'Trần Hoàng Bảo Nhi', '2023-05-24', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2024-07-23', 'active'),
  ('84dc6c7f-6f73-4c02-a412-6e6104088177', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0288', 'Dương Ngọc Cát Nhiên', '2023-07-08', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-10-01', 'active'),
  ('16719286-138f-49c6-a183-e8473e65d0ae', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0289', 'Hoàng Ngọc Phát', '2023-07-26', 'male', 'Thịnh Lộc, Lộc Hà, Hà Tĩnh', '2024-09-04', 'active'),
  ('7058ae5c-b90c-454c-8de6-2c6a0ad1f845', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0290', 'Trần Anh Quân', '2023-03-24', 'male', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2024-10-01', 'active'),
  ('4350a468-7e8f-402b-b210-fc453f37b76a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0291', 'Chu Minh Sang', '2023-02-02', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-06-12', 'active'),
  ('7d120d70-b419-4129-ba1e-7a0c110ec7be', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0292', 'Dương Hoành Sơn', '2023-01-07', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('0b9b68fb-df87-4eec-bbf0-3bdee9e565c7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 2' LIMIT 1), 'HS0293', 'Trần Nguyễn An Vy', '2023-04-16', 'female', 'Cẩm Xuyên, Hà Tĩnh, Hà Tĩnh', '2024-05-17', 'active'),
  ('2351e229-2468-4863-ad7c-137aa9d48ee5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0294', 'Nguyễn Linh Anh', '2022-03-18', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('199e2846-ce58-459c-8687-e1ff13a33d83', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0295', 'Trương Tuệ Chi', '2022-10-24', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('90cd9467-59ca-4ce5-98dd-04d7330836b6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0296', 'Nguyễn Hoàng Diệp Chi', '2022-01-06', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('b1eaa2ea-c2bb-4b5b-a8f1-6d3d07f93007', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0297', 'Đinh Đăng Dũng', '2022-10-15', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('9ecc404b-8d28-48f8-af73-32166b530733', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0298', 'Thân Ngọc Mai Hân', '2022-11-22', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-08-01', 'active'),
  ('2b855899-1a4e-4702-971f-2c31bacd7ac7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0299', 'Nguyễn Việt Hoàng', '2022-02-08', 'male', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2024-04-01', 'active'),
  ('dc789570-61ae-45b7-a670-5258ed7e4b0e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0300', 'Nguyễn Minh Hưng', '2022-02-06', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-11-14', 'active');

INSERT INTO students (id, school_id, class_id, student_code, full_name, date_of_birth, gender, address, enrollment_date, status) VALUES
  ('f139bb60-ff47-41f1-bcd4-bfcb41be74db', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0301', 'Lương Tuấn Hưng', '2022-02-19', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('e586686a-0971-4fde-b224-72640e29e57f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0302', 'Nguyễn Minh Khang', '2022-10-04', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('4d3d63ea-9f81-4efe-965a-bb0729a7ed7a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0303', 'Nguyễn An Khang', '2022-04-22', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-07-12', 'active'),
  ('3e742901-0fcf-4bb0-b43e-82da2d4a9015', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0304', 'Trần Đức Khôi', '2022-04-03', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-12-16', 'active'),
  ('da8f18d2-ad26-4e72-a0af-12bdb6e9b760', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0305', 'Đặng Đình Minh Khôi', '2022-10-10', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('ddbc7181-d3fa-4990-866a-04c30055ff9d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0306', 'Biện Minh Kiên', '2022-01-26', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-08-15', 'active'),
  ('ce98ab83-72c4-4837-bcba-2d17b9626f98', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0307', 'Phạm Dương Huyền My', '2022-01-14', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('429d89eb-3217-43e0-aee8-1d6409522826', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0308', 'Trần Thị Thảo Nguyên', '2022-01-17', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('ec0ce4f5-af84-4b19-b189-da494a29808e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0309', 'Nguyễn Quỳnh Nhi', '2022-11-20', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('39f51745-8e15-4869-8837-095f27898ed3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0310', 'Trần Tuệ Nhi', '2024-06-22', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-22', 'active'),
  ('bc17074e-fc1e-4af3-8c35-f7b90cf624d8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0311', 'Phan Tuệ Nhi', '2022-12-21', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-08-01', 'active'),
  ('2afb060b-1709-4630-b52d-1138457c8c29', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0312', 'Trần Minh Phúc', '2022-09-08', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('c700ccfe-d88f-4a5e-bc88-71d4dfc2c941', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0313', 'Nguyễn Anh Quân', '2022-12-18', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-09-03', 'active'),
  ('fc4c0214-1491-417a-a225-ce3cc96d4bad', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0314', 'Dương Thanh Tâm', '2022-10-15', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-17', 'active'),
  ('7099a776-351f-4c03-8917-9129a72f78ad', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0315', 'Trần Nhã Đan Thư', '2022-11-20', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('bd8f6942-61dd-4b4f-9029-91c8309d30e3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 3' LIMIT 1), 'HS0316', 'Trần Phú Trọng', '2022-09-15', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('3a4afbf2-e37b-41f1-b571-6ee11b7363db', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0317', 'Đặng Đình Tâm An', '2022-11-13', 'male', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2024-08-15', 'active'),
  ('36d98db2-479b-44c8-ae9a-32b3c3789dab', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0318', 'Lê Khánh Chi', '2022-10-15', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('439db5ce-b700-434a-861c-10a45feb90f9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0319', 'Võ Lê Linh Đan', '2022-02-22', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('34e15b79-6869-40f5-ac55-03c06b90eaad', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0320', 'Trương Hồng Diễm', '2022-01-28', 'female', 'Thạch Đài, Thạch Hà, Hà Tĩnh', '2024-06-10', 'active'),
  ('65fc54ce-a98b-4f93-b28c-d1bc69657bed', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0321', 'Lê Ngọc Diệp', '2022-11-09', 'female', 'Đồng Môn, Hà Tĩnh, Hà Tĩnh', '2024-03-25', 'active'),
  ('1b086264-9a76-4043-bb16-f6d647dec18e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0322', 'Nguyễn Văn Phúc Khang', '2022-10-14', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-02-22', 'active'),
  ('3464f831-9a31-4d9c-82cd-46de1e7d19d8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0323', 'Trần Nam khánh', '2022-11-02', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('a473b88d-f36c-41be-996f-05f909fbdad1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0324', 'Trần Ngọc Tuệ Lâm', '2022-10-05', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('ae69b4a7-6493-4974-80fd-2979773ae50d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0325', 'Nguyễn Tuấn Minh', '2022-11-01', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-09-01', 'active'),
  ('925c0197-4ea1-4c99-8a7b-55b36eb0f7c7', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0326', 'Trần Nguyễn Bảo Ngọc', '2022-11-17', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-07-02', 'active'),
  ('ab7dad0e-cab5-4c64-a484-b7f193dc615a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0327', 'Bùi Minh Nhật', '2022-11-13', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('b5ef2e49-ad49-4114-aa16-fdc6185674cf', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0328', 'Phạm Minh Phú', '2022-10-10', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-16', 'active'),
  ('bc73a8a4-1f02-4131-98ab-1ec874c3c327', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0329', 'Lưu Hoàng Phước', '2022-09-13', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-03-10', 'active'),
  ('1e8171c5-e767-41b0-9819-1c24adb0afb2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0330', 'Đậu Đăng Minh Quân', '2022-01-29', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('93fc851c-453c-4b62-8029-6be7d9f203d2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0331', 'Nguyễn Như Đức Quân', '2022-03-26', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-24', 'active'),
  ('d53e2a05-55cc-4659-8bb4-92cbf2a463bc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0332', 'Nguyễn Viết Minh Quân', '2022-11-06', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-07-15', 'active'),
  ('4b0cd3a3-b799-4716-84fc-9f612dc89345', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0333', 'Nguyễn Văn Minh Quân', '2022-12-03', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-07-16', 'active'),
  ('d405f1e6-6b6f-4887-81e0-06c231d827fc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0334', 'Phạm Hữu Thanh Sơn', '2022-08-22', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-12', 'active'),
  ('0ae0a1a0-739d-4abf-bf18-378fdc63a252', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0335', 'Nguyễn Ngọc Anh Thư', '2022-08-19', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('2616862c-b77a-4254-878b-4142fcdcd8c5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0336', 'Nguyễn Hoàng Vũ', '2022-10-17', 'male', 'Cẩm Bình, Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('1936dfd3-68c4-444d-b933-5c81b6f3098a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 4' LIMIT 1), 'HS0337', 'Trần Khánh Vy', '2022-10-17', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('56ddf725-babe-41d5-a17d-a7fada5a4f99', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0338', 'Nguyễn Diệu Anh', '2022-06-14', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-02-22', 'active'),
  ('60ad64ef-c91f-4a01-9215-ecd51f24eada', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0339', 'Trần Châu Phương Anh', '2022-10-21', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('e587ed59-0fe9-42ac-99b2-c79e874941ae', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0340', 'Trần Huyền Chi', '2022-04-07', 'female', 'Phường Tân Giang, Hà Tĩnh, Hà Tĩnh', '2024-03-01', 'active'),
  ('eef53b6b-b3c5-49e9-b1bb-8204c0745675', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0341', 'Phan Ngọc Ánh Diệp', '2022-07-07', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('02284732-d3df-42ab-b73f-25994ca6fe47', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0342', 'Mai Hoàng Dương', '2022-03-24', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('54679363-e63c-498b-9f7c-287fb7c73f98', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0343', 'Nguyễn Minh Khang', '2022-09-28', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-04-24', 'active'),
  ('76a41f6e-9d38-4d73-89f2-8f782b38413b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0344', 'Lê Tuyết Linh', '2022-09-28', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('7a17303c-f9d9-45b6-aa87-a77595c6dd17', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0345', 'Nguyễn Gia Linh', '2022-08-18', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('0b7cc49a-7336-486e-bdb6-57b6ec8b5ef3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0346', 'Vương Khánh My', '2022-09-09', 'female', 'Thạch Hà, Hà Tĩnh', '2024-02-19', 'active'),
  ('cf89ff4d-a253-42cf-8508-9b079a942e91', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0347', 'Nguyễn Hạnh Ngân', '2022-10-23', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('17590c81-8ed3-43c9-9e64-30e47871b912', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0348', 'Nguyễn Khánh Ngọc', '2022-08-28', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-03-25', 'active'),
  ('c88e99f5-699e-4285-9537-394d65720b5a', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0349', 'Nguyễn Bùi Tuệ Nhi', '2022-03-08', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('259121bb-8a89-4836-ae22-dccd2cccd3d2', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0350', 'Trương Tuệ Nhi', '2022-03-22', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('3e4c9dbe-429b-47f5-af8a-af39b51835bc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0351', 'Trần Hà Minh Phúc', '2022-02-17', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-02-01', 'active'),
  ('0c114e37-f098-4ccf-83c3-da8de1323de8', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0352', 'Nguyễn Minh Quân', '2022-09-22', 'male', 'phường Văn Yên, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('61595b14-307c-485c-8d25-b9bee049bd50', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0353', 'Nguyễn Phú Quân', '2022-09-20', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-01-09', 'active'),
  ('e14265cc-3c3e-4764-9164-698006e4636c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0354', 'Phan Trần Diệu San', '2022-03-08', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('acbce55a-ac45-4a2c-bf48-26321204cd02', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0355', 'Hoàng Thanh Sơn', '2022-07-01', 'male', 'Lộc Hà, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('dc8f0108-d6f1-4fb1-9975-08aa3f400638', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0356', 'Nguyễn Quang Thọ', '2022-07-17', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('80e093b6-feec-4d0a-99ee-acbd49fad052', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0357', 'Trần Thị Cẩm Vân', '2022-10-15', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-11', 'active'),
  ('4ee619a0-fb8a-4f1c-99b1-77937c5ee5aa', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0358', 'Nguyễn Uy Vũ', '2022-03-14', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2022-02-01', 'active'),
  ('85a7c0bd-152c-4f96-b212-195988e6e6d0', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 6' LIMIT 1), 'HS0359', 'Hồ Trúc Vy', '2022-12-08', 'female', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2024-03-15', 'active'),
  ('da2d9b5d-eefa-4ee4-b1a8-5e3a37a245a1', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0360', 'Nguyễn Ngọc Bảo Châu', '2023-05-07', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-07-23', 'active'),
  ('74302844-dc84-4e12-897a-fc6e0988bc87', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0361', 'Hoàng Hải Đăng', '2023-02-12', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-07-29', 'active'),
  ('43c030c7-355a-4f34-9b2b-b1e29e98b66e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0362', 'Hồ Hải Đăng', '2023-06-15', 'male', 'Cày, Thạch Hà, Hà Tĩnh', '2024-10-01', 'active'),
  ('9c1c51c6-7d8b-4fa6-b4ca-dc44df660965', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0363', 'Tô Bảo Hân', '2023-06-16', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-10-01', 'active'),
  ('cdb3c45f-9110-47c8-b374-fafa5cf8f19e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0364', 'Hoàng Minh Huy', '2023-06-08', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('9b881f8c-3df9-434d-b8a4-97a3876b6cc6', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0365', 'Lê Minh Khang', '2023-04-21', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-16', 'active'),
  ('38b5ee59-02d4-4d6f-8ebb-a104ba946894', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0366', 'Nguyễn Tuấn Khang', '2023-02-12', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-24', 'active'),
  ('fb98e099-f9ff-4f9a-ac45-f6309e5bf3fd', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0367', 'Nguyễn Văn Minh Khôi', '2023-02-16', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-01', 'active'),
  ('2c1d01b2-229b-4a4d-89ab-4cad904f6cf5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0368', 'Trương Duy Khôi', '2023-04-04', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('762511e6-a559-472e-9b61-26b308c5d9e4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0369', 'Đào Ngọc Mai', '2023-03-26', 'female', 'Cẩm Bình, Cẩm Xuyên, Hà Tĩnh', '2024-07-15', 'active'),
  ('c0e20cb1-ca4f-41c4-a2ad-e97950a73efb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0370', 'Trần Minh Ngọc', '2023-01-27', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('90ab4f91-61ae-4280-85f6-b64c3778f09e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0371', 'Nguyễn Khôi Nguyên', '2023-01-28', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-10-07', 'active'),
  ('581e8a53-18ec-45df-9582-d5b2b7357af9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0372', 'Hà Nguyễn Phương Nhi', '2023-06-04', 'female', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2024-09-03', 'active'),
  ('0323d773-c6e3-496c-bf21-d60e05a70aa3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0373', 'Nguyễn Diệu Nhi', '2023-01-03', 'female', 'Thạch Đài, Thạch Hà, Hà Tĩnh', '2024-06-10', 'active'),
  ('7799b492-19c0-47d1-a64e-b757688debbc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0374', 'Văn Ngọc Diệu Nhi', '2023-02-19', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('be08e12c-d090-4df7-8c27-695bb7d8aebb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0375', 'Văn Ngọc Yến Nhi', '2023-02-19', 'female', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2024-06-09', 'active'),
  ('a80ab719-986a-4bbe-82fe-ddf0156f3319', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0376', 'Hoàng Ngọc Phong', '2023-02-11', 'male', 'Cẩm Nhượng, Cẩm Xuyên, Hà Tĩnh', '2024-07-16', 'active'),
  ('677f2ffb-3881-4326-a41b-b4b606dbd49c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0377', 'Trần Nguyễn Uyên Thư', '2023-02-14', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('33c15622-364f-4ee2-bd81-87419fc1637f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0378', 'Nguyễn Phương Uyên', '2023-01-25', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('a087b1fc-ef38-4436-908e-d457d33e8461', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 1' LIMIT 1), 'HS0379', 'Phạm Thục Vy', '2023-01-21', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('6588956b-f0df-40f5-bc05-a7a63f21dc94', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0380', 'Dương Kim Yến Anh', '2022-02-11', 'female', 'Thạch Lạc, Thạch Hà, Hà Tĩnh', '2023-08-22', 'active'),
  ('9562ea7f-e985-46e8-afdb-cedbdfbb11ca', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0381', 'Nguyễn Quỳnh Chi', '2022-06-14', 'female', 'Cẩm Bình, Cẩm Xuyên, Hà Tĩnh', '2023-08-15', 'active'),
  ('feee04cc-4fdc-4fec-8ca0-bf3dad2ffd7d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0382', 'Trần Hồng Duy', '2022-04-02', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('61a89f80-19d0-4f21-acc1-8e21e472cc80', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0383', 'Nguyễn Minh Ngọc Hân', '2022-03-26', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2024-01-08', 'active'),
  ('d083afa2-4e3d-4935-a4ac-0e75e95871e5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0384', 'Nguyễn Ngọc Hân', '2022-01-26', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-12-06', 'active'),
  ('73f8d884-54f6-4b41-8edf-92a7c9b91fd3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0385', 'Nguyễn Viết Hưng', '2022-07-12', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2023-10-02', 'active'),
  ('3e8d8090-9f01-42da-b474-380cc924ba51', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0386', 'Nguyễn Quang Huy', '2022-01-10', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2023-06-01', 'active'),
  ('e580b365-7aeb-43cb-9458-11be33592c72', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0387', 'Võ Tá Bảo Khang', '2022-02-26', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('a9b51d66-ae46-4d63-a994-bd402951a499', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0388', 'Trịnh Minh Khang', '2022-03-12', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('179e1743-5743-41a8-8f86-3f38b24c0fc3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0389', 'Nguyễn Tuấn Khang', '2022-10-26', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-07-01', 'active'),
  ('754c68c8-c3a6-40bc-810e-97a4989afd0e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0390', 'Lê Hoàng Bảo Khánh', '2022-07-11', 'male', 'Hà Huy Tập, Hà Tĩnh, Hà Tĩnh', '2024-02-19', 'active'),
  ('a684528b-1210-408b-8161-35986c0fc809', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0391', 'Trần Vũ Chí Kiên', '2002-02-23', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2024-08-08', 'active'),
  ('d16beaef-544d-43db-a2f9-f33650dc9f14', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0392', 'Nguyễn Bảo Tuệ Linh', '2022-04-03', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-10-07', 'active'),
  ('06b5fc7e-a7cc-47d2-8468-b6ffc9f05222', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0393', 'Lê Hoàng Kim Ngân', '2002-01-20', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-08-15', 'active'),
  ('2adc1787-5bbf-4ce5-833b-9fca5391149e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0394', 'Nguyễn Minh Nhật', '2022-01-01', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('857d6c0e-4451-4df4-abf9-07a6a4a7e243', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0395', 'Nguyễn Minh Nhật (B)', '2022-01-28', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-06-19', 'active'),
  ('86706a5d-0297-4324-b703-84e16172b4e4', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0396', 'Nguyễn Hoàng Phát', '2022-02-25', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-07-01', 'active'),
  ('98ac21ed-c642-4866-938f-9ca398c5c881', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0397', 'Trương Quang Phát', '2022-04-10', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-09-11', 'active'),
  ('17cf8288-ecd8-44da-a41c-435ac8d17390', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0398', 'Nguyễn Trọng Minh Quân', '2022-06-21', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2023-12-04', 'active'),
  ('4caa1e72-2559-4ca1-bbd3-463b4d61f04b', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0399', 'Trần Khánh Trang', '2022-01-02', 'female', 'Nam Hà, Hà Tĩnh, Hà Tĩnh', '2023-07-03', 'active'),
  ('9211ab86-59e3-46e1-8769-c201cf934bb9', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0400', 'Lê Đặng Nhã Uyên', '2022-01-04', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-08-07', 'active');

INSERT INTO students (id, school_id, class_id, student_code, full_name, date_of_birth, gender, address, enrollment_date, status) VALUES
  ('60f5aa03-0c96-47a7-b702-52971c0b793f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Dorami 5' LIMIT 1), 'HS0401', 'Trần Lê Tường Vy', '2022-10-11', 'female', 'Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('d67dcc17-0724-4eaf-a098-ff02e17dce70', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0402', 'Lê Phan Bảo Châu', '2021-06-21', 'female', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-08-01', 'active'),
  ('ed42a2e7-d6b0-4232-a70a-aa7a581566bc', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0403', 'Nguyễn Đan Chi', '2021-10-02', 'female', 'Hà Tĩnh, Hà Tĩnh', '2022-08-15', 'active'),
  ('df8cd0f2-62d5-4168-bf14-d6252c9196da', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0404', 'Nguyễn Đức Cường', '2021-08-18', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-09-01', 'active'),
  ('9f3dad88-d4f3-4dae-a83d-19d520a7a1be', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0405', 'Mai Nhật Nam Dương', '2021-12-30', 'male', 'Tân Giang, Hà Tĩnh, Hà Tĩnh', '2023-06-12', 'active'),
  ('0a8eb4e9-00b3-41a6-8a67-cfea1aa07c88', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0406', 'Nguyễn Ngọc Ánh Dương', '2021-05-02', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('8bca01a9-31a5-4c7b-aba0-530859a84b52', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0407', 'Phạm Gia Hân', '2021-01-19', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('2e9b91d8-b41b-4c01-94b4-1542cbedc1fb', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0408', 'Trần Nguyễn Khả Hân', '2021-09-22', 'female', 'Thạch Hạ, Hà Tĩnh, Hà Tĩnh', '2021-09-09', 'active'),
  ('cc2df9a9-ae8c-4238-b764-8a5ec3abcebf', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0409', 'Nguyễn Công Gia Hưng', '2021-09-13', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('d205b634-aaa7-4b07-bcb4-4d604f84b5f5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0410', 'Nguyễn Gia Huy', '2021-06-12', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-09-10', 'active'),
  ('7c85ee2c-c646-4dc3-af83-a540a5e3a30d', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0411', 'Nguyễn Bảo Khang', '2021-01-27', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-09-04', 'active'),
  ('33dbfe14-351b-4755-aa0f-296d501b58fa', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0412', 'Phan Đình Hoàng Khang', '2021-02-02', 'male', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2022-08-01', 'active'),
  ('b336013a-bec2-48d2-9aaa-56bac90066ff', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0413', 'Nguyễn Anh Khôi', '2021-10-30', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('bc340e5b-f0fe-4155-a8c9-b20e35961f70', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0414', 'Biện Văn Đức Kiên', '2021-03-13', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-10', 'active'),
  ('459e4c83-c186-4a2a-a17e-b0cbc75268c5', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0415', 'Nguyễn Văn Trung Kiên', '2021-04-27', 'male', 'Bắc Hà, Thạch Hà, Hà Tĩnh', '2023-07-05', 'active'),
  ('5aec75f5-3301-4953-8a18-17a565a3f643', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0416', 'Võ Thiên Kim', '2021-07-18', 'female', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('a4874ead-45e9-4ee1-aacc-817ff33f4c2c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0417', 'Trần Hải Long', '2022-01-04', 'male', 'Thạch Quý, Hà Tĩnh, Hà Tĩnh', '2023-07-01', 'active'),
  ('c80f59d1-1db1-49e1-b1af-99d352e14336', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0418', 'Trần Thành Minh', '2021-01-28', 'male', 'Trần Phú, Hà Tĩnh, Hà Tĩnh', '2024-06-10', 'active'),
  ('538cb572-8c7c-47f4-8e49-99c5851df871', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0419', 'Phan An Nam', '2021-09-29', 'male', 'Nguyễn Du, Hà Tĩnh, Hà Tĩnh', '2023-08-02', 'active'),
  ('9354adc1-a600-4fc0-8f95-a17900635312', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0420', 'Huỳnh Bùi Vân Ngọc', '2021-12-08', 'female', 'Bắc Hà, Hà Tĩnh, Hà Tĩnh', '2023-07-28', 'active'),
  ('bab1f6d0-bc07-4087-93d6-26c960c02e1e', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0421', 'Trần Lê Bảo Ngọc', '2021-12-12', 'female', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2023-07-07', 'active'),
  ('098e7848-89e6-40c5-b061-c35c58f7e2d3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0422', 'Nguyễn Hoàng Nguyên', '2021-10-22', 'male', 'Thạch Linh, Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('cf93ac1b-1e07-4c35-8826-3232725a33a3', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0423', 'Võ Trọng Nguyên', '2021-10-11', 'male', 'Thạch Trung, Hà Tĩnh, Hà Tĩnh', '2024-09-04', 'active'),
  ('261caa3b-b497-4a76-9761-f3b33efcd898', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0424', 'Nguyễn Xuân Sáng', '2021-12-02', 'male', 'Hà Tĩnh, Hà Tĩnh', '2023-06-05', 'active'),
  ('2838cdb8-02c2-443d-b69e-06554a644a3f', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0425', 'Nguyễn Hoàng Sơn', '2021-09-03', 'male', 'Thạch Hà, Hà Tĩnh', '2023-06-05', 'active'),
  ('c0456fa8-36c7-4729-b817-61b9c451848c', '00000000-0000-0000-0000-000000000001', (SELECT id FROM classes WHERE name = 'Shizuka 5' LIMIT 1), 'HS0426', 'Nguyễn Phú Thành', '2021-08-09', 'male', 'Hà Tĩnh, Hà Tĩnh', '2024-07-17', 'active');

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('2b930716-9dd5-44c7-92ef-d92aab2a6ea6', 'Trần Thanh Hoa', 'me', '983898701', true),
  ('2b930716-9dd5-44c7-92ef-d92aab2a6ea6', 'Đặng Sỹ Hùng Mạnh', 'cha', '919782489', false),
  ('2aef9e26-a50e-483d-9dba-89efb513857a', 'Trần Thị Lê Khuyên', 'me', '949246002', true),
  ('2aef9e26-a50e-483d-9dba-89efb513857a', 'Phan Đắc Huân', 'cha', '979089333', false),
  ('937830b4-be09-41b1-a9ab-f5e5b9266691', 'Trương Thị Liên', 'me', '984717586', true),
  ('937830b4-be09-41b1-a9ab-f5e5b9266691', 'Trần Văn Trình', 'cha', '911097697', false),
  ('22e34652-555c-4b4f-977e-053811d97231', 'Phan Thị Bảo Linh', 'me', '853688886', true),
  ('22e34652-555c-4b4f-977e-053811d97231', 'Nguyễn Văn Đoàn', 'cha', '835688886', false),
  ('3f04b5b0-6c67-437b-a819-aa0245a63a91', 'Nguyễn Thùy Dung', 'me', '946946833', true),
  ('3f04b5b0-6c67-437b-a819-aa0245a63a91', 'Lê Đăng Thế Vũ', 'cha', '853131351', false),
  ('ea69bfbc-ffcb-498b-8052-93e6178fe8ac', 'Nguyễn Khánh Linh', 'me', '917222656', true),
  ('ea69bfbc-ffcb-498b-8052-93e6178fe8ac', 'Lê Đình Nhật', 'cha', '941094886', false),
  ('ae06c4ca-bb07-4b0f-bb15-a1bb16a97acc', 'Đoàn Thị Thúy Hằng', 'me', '902102631', true),
  ('ae06c4ca-bb07-4b0f-bb15-a1bb16a97acc', 'Thái Cao Cường', 'cha', '965848789', false),
  ('45d40ecd-7229-4e48-ae8c-af9d3381928b', 'Lê Thị Diệu Thúy', 'me', '972220779', true),
  ('45d40ecd-7229-4e48-ae8c-af9d3381928b', 'Nguyễn Sỹ Phú', 'cha', '964286777', false),
  ('2f1c5f70-ccd9-4f76-b174-63f01eb7da13', 'Trần Thị Trà Vinh', 'me', '917699468', true),
  ('2f1c5f70-ccd9-4f76-b174-63f01eb7da13', 'Trần Xuân Biển', 'cha', '918010187', false),
  ('8fa85a04-c2d8-4402-b0bd-e20aa8327923', 'Nguyễn Thị Khánh Diệu', 'me', '919994669', true),
  ('8fa85a04-c2d8-4402-b0bd-e20aa8327923', 'Nguyễn Đức Anh', 'cha', '917774789', false),
  ('6d3ea0fc-018c-436d-8935-ab8310f709c8', 'Phạm Thị Khánh Linh', 'me', '333458899', true),
  ('6d3ea0fc-018c-436d-8935-ab8310f709c8', 'Nguyễn Xuân Thanh', 'cha', '946892899', false),
  ('2045e205-55c5-48ba-afa1-fb2fec897367', 'Trần Thị Phương Thanh', 'me', '915320032', true),
  ('2045e205-55c5-48ba-afa1-fb2fec897367', 'Từ Tuấn Hùng', 'cha', '917754386', false),
  ('f09612fb-0934-475c-a72a-8bf09c9360ba', 'Nguyễn Thị Trinh', 'me', '915210777', true),
  ('f09612fb-0934-475c-a72a-8bf09c9360ba', 'Phan Công Thiện', 'cha', '911537268', false),
  ('075690ed-a49a-4e2a-a78e-af9bb098f628', 'Nguyễn Thị Mỹ Linh', 'me', '979626439', true),
  ('075690ed-a49a-4e2a-a78e-af9bb098f628', 'Mai Văn Nam', 'cha', '918888963', false),
  ('88c7cf66-e081-45f3-8104-98c561561502', 'Phan Thị Huyền', 'me', '942416556', true),
  ('88c7cf66-e081-45f3-8104-98c561561502', 'Trương Quang Chung', 'cha', '942416556', false),
  ('d4229fa4-5f18-496c-89c5-a4ea8e7f0fc6', 'Phan Thị Hằng Nga', 'me', '911098885', true),
  ('d4229fa4-5f18-496c-89c5-a4ea8e7f0fc6', 'Võ Tá Lê', 'cha', '94894677', false),
  ('cdd817bf-4e81-4504-9393-4077c707b872', 'Lê Thị Kim Tiến', 'me', '911095779', true),
  ('cdd817bf-4e81-4504-9393-4077c707b872', 'Lê Cảnh Hưng', 'cha', '914320779', false),
  ('304d6588-5a7a-42b4-89bc-493c9f1d3331', 'Lâm Thị Mai Phương', 'me', '918817389', true),
  ('304d6588-5a7a-42b4-89bc-493c9f1d3331', 'Trần Sỹ Hoàng', 'cha', '915872277', false),
  ('43b05c45-b84e-4708-b138-eb0d9e6bf10b', 'Lê Thị Minh Châu', 'me', '912121165', true),
  ('43b05c45-b84e-4708-b138-eb0d9e6bf10b', 'Nguyễn Hoài Nam', 'cha', '912121165', false),
  ('52887c73-5d27-4b12-a916-418c4abde36d', 'Lê Thị Trang', 'me', '332394971', true),
  ('52887c73-5d27-4b12-a916-418c4abde36d', 'Phan Thành Cơ', 'cha', '965108686', false),
  ('0062e9b9-6793-45fe-8333-cb9e0a57e62a', 'Trần Nữ Thùy Linh', 'me', '917062287', true),
  ('0062e9b9-6793-45fe-8333-cb9e0a57e62a', 'Nguyễn Đặng Gia Bảo', 'cha', '911199899', false),
  ('621d3808-e9b2-43d0-a273-0f8692023ad8', 'Phan Thị Ánh Ngọc', 'me', '962658602', true),
  ('621d3808-e9b2-43d0-a273-0f8692023ad8', 'Nguyễn Duy Hoàng', 'cha', '941086268', false),
  ('193783c8-3b48-4d0b-8124-f14ef9054b8b', 'Nguyễn Mai Hiền Chi', 'me', '989858685', true),
  ('193783c8-3b48-4d0b-8124-f14ef9054b8b', 'Nguyễn Xuân Phương', 'cha', '911092029', false),
  ('6bc8502b-c0f4-4459-8e3c-3aff7297eba1', 'Nguyễn Thị Trà Giang', 'me', '988934688', true),
  ('6bc8502b-c0f4-4459-8e3c-3aff7297eba1', 'Trần Trường Sơn', 'cha', '903436779', false),
  ('5fd5f956-6a8a-476d-b0b9-524e874456ff', 'Lê Thị Phương Trinh', 'me', '944016619', true),
  ('5fd5f956-6a8a-476d-b0b9-524e874456ff', 'Nguyễn Đăng Thái', 'cha', '978828777', false),
  ('49cdc968-7683-4ddd-8968-3e3525ceebc3', 'Nguyễn Thị Hải Tú', 'me', '914733638', true),
  ('49cdc968-7683-4ddd-8968-3e3525ceebc3', 'Nguyễn Kiên Cường', 'cha', '911716777', false),
  ('0e3be470-9fc9-47b7-9a9a-198d4273bbb2', 'Trần Thị Ngọc Thái', 'me', '346663489', true),
  ('0e3be470-9fc9-47b7-9a9a-198d4273bbb2', 'Trần Văn Công', 'cha', '967867088', false),
  ('e0837493-4fa2-4dcb-ac4d-8610ec95bf68', 'Trần Thị Cẩm Ngọc', 'me', '797386789', true),
  ('e0837493-4fa2-4dcb-ac4d-8610ec95bf68', 'Nguyễn Kế Phú', 'cha', '915368686', false),
  ('a4fcead1-9c4e-4bbd-bb4e-4e20119d3c1c', 'Nguyễn Thị Giang', 'me', '942341386', true),
  ('a4fcead1-9c4e-4bbd-bb4e-4e20119d3c1c', 'Đoàn Trọng Hoàng', 'cha', '964978555', false),
  ('01160350-1ce2-4d5f-b285-a19a8ef28f6d', 'Đặng Thị Đức Thảo', 'me', '986437937', true),
  ('01160350-1ce2-4d5f-b285-a19a8ef28f6d', 'Đinh Văn Túy', 'cha', '973895789', false),
  ('08580be1-d3e3-4202-9bdc-32fb4b95c520', 'Phạm Thị Huyền Trang', 'me', '916506789', true),
  ('41945769-39f2-4965-be96-d60595353b2e', 'Phan Nguyễn Như Quỳnh', 'me', '973268195', true),
  ('41945769-39f2-4965-be96-d60595353b2e', 'Nguyễn Xuân Quang', 'cha', '387778687', false),
  ('9e9138e3-3ad3-4c97-9cb8-b2c1c50dc17d', 'Nguyễn Thị Vân Anh', 'me', '918076695', true),
  ('9e9138e3-3ad3-4c97-9cb8-b2c1c50dc17d', 'Nguyễn Tiến Hùng', 'cha', '915431456', false),
  ('9ae51c80-a7a4-47fd-8a6f-ae978e19bf4d', 'Lê Thị Kim Oanh', 'me', '919497766', true),
  ('9ae51c80-a7a4-47fd-8a6f-ae978e19bf4d', 'Nguyễn Chung Hiếu', 'cha', '913294418', false),
  ('4e8a20a3-39b8-48a0-98b1-6420a0849a7a', 'Lê Thị Vinh', 'me', '988074905', true),
  ('4e8a20a3-39b8-48a0-98b1-6420a0849a7a', 'Võ Hữu Trà', 'cha', '9767375812', false),
  ('8ff0f6eb-fe23-4d67-a963-f0d9e283ca47', 'Đặng Thị Lan', 'me', '914344977', true),
  ('8ff0f6eb-fe23-4d67-a963-f0d9e283ca47', 'Mai Thành Trung', 'cha', '915412599', false),
  ('1edccb8b-d75c-49ab-a40d-ad763cd4abaa', 'Trần Thị Thùy Vinh', 'me', '945812899', true),
  ('1edccb8b-d75c-49ab-a40d-ad763cd4abaa', 'Lê Ngọc Thanh', 'cha', '916624568', false),
  ('619b863b-ac25-4846-87a8-b60f350a45ce', 'Nguyễn Thị Việt Phương', 'me', '904978941', true),
  ('619b863b-ac25-4846-87a8-b60f350a45ce', 'Lê Văn Tuấn', 'cha', '986608303', false),
  ('3888fffb-3166-46a0-9752-5f968d3e3954', 'Phạm Ngọc Hà', 'me', '915755499', true),
  ('3888fffb-3166-46a0-9752-5f968d3e3954', 'Nguyễn Công Hoàng', 'cha', '976587305', false),
  ('59fc80df-dc32-41b6-a6b8-113dc9c0f9da', 'Hồ Thị Mỹ', 'me', '947722368', true),
  ('59fc80df-dc32-41b6-a6b8-113dc9c0f9da', 'Phan Thế Thắng', 'cha', '916844386', false),
  ('470b1704-4bc6-4a8c-bb37-1a90413029bd', 'Nguyễn Thị Liễu', 'me', '917334777', true),
  ('470b1704-4bc6-4a8c-bb37-1a90413029bd', 'Nguyễn Trung Thành', 'cha', '961706333', false),
  ('65d1c141-bbea-4816-8c0e-9819592f88cd', 'Hoàng Thị Tuyết', 'me', '989285743', true),
  ('65d1c141-bbea-4816-8c0e-9819592f88cd', 'Hồ Xuân Kỳ', 'cha', '915976525', false),
  ('14a95688-62a0-4be1-8bf5-56a5d3374d11', 'Nguyễn Thị Phương Thảo', 'me', '948722266', true),
  ('14a95688-62a0-4be1-8bf5-56a5d3374d11', 'Nguyễn Văn Đại', 'cha', '917779809', false),
  ('e1842820-7d82-461e-a6b3-c58f8d9bee6c', 'Lê Thị Lưu Phương', 'me', '973490629', true),
  ('e1842820-7d82-461e-a6b3-c58f8d9bee6c', 'Trần Tiến Dũng', 'cha', '914765746', false),
  ('bf4dc7fd-9b53-44a4-ad94-25fed05a6916', 'Phan Thị Hương', 'me', '919387568', true),
  ('bf4dc7fd-9b53-44a4-ad94-25fed05a6916', 'Nguyễn Nhật Hoàng', 'cha', '973887568', false),
  ('8452e478-7b95-4021-aefc-d8eb58368815', 'Phan Thị Ngọc Duyên', 'me', '943199295', true),
  ('8452e478-7b95-4021-aefc-d8eb58368815', 'Lê Duy Đạt', 'cha', '917042889', false),
  ('49694392-82d4-4ceb-a001-d8af519f3573', 'Trần Thị Hương Trà', 'me', '948187479', true),
  ('49694392-82d4-4ceb-a001-d8af519f3573', 'Lê Anh Tuấn', 'cha', '915614619', false),
  ('01654380-c7b2-482f-9708-cdea1a2c79b3', 'Lại Thị Thu Trang', 'me', '914319484', true),
  ('01654380-c7b2-482f-9708-cdea1a2c79b3', 'Trần Hữu Dũng', 'cha', '943935925', false),
  ('b417213f-eb60-4160-9acd-4c81c8363ee3', 'Trần Thị Thảo Trâm', 'me', '967906867', true),
  ('931c9d9a-3a25-4998-9190-ba7ce3bf3e48', 'Phan Thị Minh Hiền', 'me', '989521932', true),
  ('ee07c062-cc2b-4220-8fea-9fbb440b2218', 'Lê Thị Như Quỳnh', 'me', '917379333', true),
  ('ee07c062-cc2b-4220-8fea-9fbb440b2218', 'Lê Anh Nam', 'cha', '919485668', false),
  ('5cbe8ae4-372f-4c3f-a7ab-c9a0567454ec', 'Phạm Thị Huyền Trang', 'me', '916506789', true);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('7ad7362f-474b-4303-80ba-271a5dd15084', 'Hồ Thị Bích Hồng', 'me', '917931996', true),
  ('7ad7362f-474b-4303-80ba-271a5dd15084', 'Lưu Văn Thọ', 'cha', '912989098', false),
  ('0d2a7659-065d-41a0-8960-980de3872369', 'Phạm Thị Quỳnh Trang', 'me', '948487888', true),
  ('0d2a7659-065d-41a0-8960-980de3872369', 'Nguyễn Văn Hải', 'cha', '943769889', false),
  ('73a68c74-7576-4ce9-baf5-dee0557f31b6', 'Trần Thị Oanh', 'me', '979930799', true),
  ('73a68c74-7576-4ce9-baf5-dee0557f31b6', 'Phan Văn Hòa', 'cha', '988046236', false),
  ('1fe01ee6-74fa-4694-8ff7-045fa36d51fd', 'Nguyễn Thị Hà Giang', 'me', '982325657', true),
  ('1fe01ee6-74fa-4694-8ff7-045fa36d51fd', 'Trần Đình Bình', 'cha', '982325758', false),
  ('5579c861-963b-4367-91c5-316cf85393c2', 'Từ Thị Cẩm', 'me', '917526889', true),
  ('5579c861-963b-4367-91c5-316cf85393c2', 'Nguyễn Tuấn Anh', 'cha', '0000000000', false),
  ('9467a22c-ac24-4adf-a0d2-8ce1abd81d9d', 'Phạm Thị Tú', 'me', '974724985', true),
  ('9467a22c-ac24-4adf-a0d2-8ce1abd81d9d', 'Nguyễn Quang Thạch', 'cha', '0000000000', false),
  ('7d5c76b0-710d-4af3-9f93-b5cd0610b738', 'Nguyễn Thị Hồng', 'me', '962020688', true),
  ('7d5c76b0-710d-4af3-9f93-b5cd0610b738', 'Nguyễn Đình Đức', 'cha', '948223993', false),
  ('7517de24-5d19-4521-9b5a-79aa5a82e045', 'Trần Thị Huyền Trang', 'me', '782876666', true),
  ('7517de24-5d19-4521-9b5a-79aa5a82e045', 'Phan Ngọc Thái', 'cha', '915018888', false),
  ('df6784fe-1ea1-4e34-ad92-7b84e8c87c64', 'Bùi Thị Quỳnh Châu', 'me', '904997045', true),
  ('df6784fe-1ea1-4e34-ad92-7b84e8c87c64', 'Nguyễn Đức Chung', 'cha', '989837889', false),
  ('52b7c3e8-bd58-480a-9ce3-cae1370a4d21', 'Nguyễn Thị Trâm Anh', 'me', '948557456', true),
  ('52b7c3e8-bd58-480a-9ce3-cae1370a4d21', 'Trần Quốc Ánh', 'cha', '915525676', false),
  ('37ed7a34-bea0-4f27-88d9-791a91f5a0fd', 'Phan Thị Trâm', 'me', '972972583', true),
  ('37ed7a34-bea0-4f27-88d9-791a91f5a0fd', 'Vũ Đức Trinh', 'cha', '972972584', false),
  ('404eb1c7-8e09-4ab3-86d1-1aedf7f54ba0', 'Nguyễn Thị Diệu Thúy', 'me', '985217292', true),
  ('404eb1c7-8e09-4ab3-86d1-1aedf7f54ba0', 'Nguyễn Sỹ Thành', 'cha', '969879696', false),
  ('8aed0649-cbf7-4bea-821d-2831cc81cac7', 'Hoàng Thị Lệ Thủy', 'me', '917694282', true),
  ('8aed0649-cbf7-4bea-821d-2831cc81cac7', 'Trần Hoàng Quý', 'cha', '968552686', false),
  ('e96b7e9f-9c56-425d-b47d-ace83756129d', 'Đinh Thị Quỳnh', 'me', '967839215', true),
  ('e96b7e9f-9c56-425d-b47d-ace83756129d', 'Nguyễn Giang Nam', 'cha', '868769660', false),
  ('7aa5d509-6b2a-48b1-86d1-8dfdd434a3a5', 'Hà Thị Huyền Trang', 'me', '985027106', true),
  ('7aa5d509-6b2a-48b1-86d1-8dfdd434a3a5', 'Nguyễn Trí Trung', 'cha', '918833968', false),
  ('35674b9a-5700-4c65-9c45-c3e5304db3fe', 'Chu Thị Kim Thêu', 'me', '976645593', true),
  ('35674b9a-5700-4c65-9c45-c3e5304db3fe', 'Trương Minh Châu', 'cha', '987689011', false),
  ('3e85d3df-5596-461a-a76c-66c70ee43dc6', 'Võ Thị Hải', 'me', '977089470', true),
  ('3e85d3df-5596-461a-a76c-66c70ee43dc6', 'Lê Văn Cường', 'cha', '968160508', false),
  ('c6fb6a12-a98f-4ff6-a654-f4b6de40e2a1', 'Nguyễn Thị Thảo Hà', 'me', '911512626', true),
  ('c6fb6a12-a98f-4ff6-a654-f4b6de40e2a1', 'Trương Duy Kỷ', 'cha', '917383662', false),
  ('90b2ea12-8415-42bf-b2f5-82936cca3aa7', 'Lê Trà My', 'me', '982273111', true),
  ('90b2ea12-8415-42bf-b2f5-82936cca3aa7', 'Lê Phi Diệu', 'cha', '888326677', false),
  ('70aa1b3c-23df-46e3-baab-c7a9782dc43e', 'Cù Thị Bích Ngọc', 'me', '936190592', true),
  ('70aa1b3c-23df-46e3-baab-c7a9782dc43e', 'Nguyễn Trọng Võ', 'cha', '968245888', false),
  ('21c038b1-ba09-4a54-9cd4-ed4fad042d04', 'Nguyễn Thị Hồng Hà', 'me', '946284888', true),
  ('21c038b1-ba09-4a54-9cd4-ed4fad042d04', 'Nguyễn Quốc Sách', 'cha', '985903456', false),
  ('a7896833-0e02-459a-bd3d-f4994dfaed5b', 'Đậu Thị Thuý Hà', 'me', '919561186', true),
  ('a7896833-0e02-459a-bd3d-f4994dfaed5b', 'Trần Lê Công Thành', 'cha', '919561186', false),
  ('13fb9491-54b7-49ae-92f7-6804179c2b85', 'Nguyễn Thị Thu', 'me', '912373798', true),
  ('13fb9491-54b7-49ae-92f7-6804179c2b85', 'Bùi Văn Khoa', 'cha', '985147751', false),
  ('61510cd4-1226-4a62-8683-bbfd733a6256', 'Trần Thị Phương Mai', 'me', '945563292', true),
  ('61510cd4-1226-4a62-8683-bbfd733a6256', 'Nguyễn Quốc Tiến', 'cha', '915573889', false),
  ('31e3dc9d-c51c-4b3d-aa5a-db981479a567', 'Trần Thị Kiều Oanh', 'me', '943554992', true),
  ('31e3dc9d-c51c-4b3d-aa5a-db981479a567', 'Nguyễn Tiến Dũng', 'cha', '942421236', false),
  ('9a0609ad-8ac8-4788-9d79-bd1297cb25ba', 'Nguyễn Thị Thu Hoài', 'me', '916626138', true),
  ('9a0609ad-8ac8-4788-9d79-bd1297cb25ba', 'Lê Văn Dũng', 'cha', '918216138', false),
  ('8fc99d1e-b984-4fe5-aa16-24818208a9c3', 'Lê Thị Thùy Dương', 'me', '941585686', true),
  ('8fc99d1e-b984-4fe5-aa16-24818208a9c3', 'Luyện Việt Hòa', 'cha', '0000000000', false),
  ('23f94e60-30e6-4db8-af7b-86ac5ad277b1', 'Ngô Thị Thoa', 'me', '912939099', true),
  ('23f94e60-30e6-4db8-af7b-86ac5ad277b1', 'Phạm Thanh Nam', 'cha', '912182182', false),
  ('f8bd734d-7eea-45ab-9ba0-9df5671175cb', 'Lê Thị Hồng Lộc', 'me', '934399929', true),
  ('f8bd734d-7eea-45ab-9ba0-9df5671175cb', 'Nguyễn Trung Thành', 'cha', '948186343', false),
  ('b2399f4e-a29d-4eb7-ae3c-0dceaad96ebb', 'Nguyễn Thị Thắm', 'me', '984698268', true),
  ('b2399f4e-a29d-4eb7-ae3c-0dceaad96ebb', 'Nguyễn Văn Chiến', 'cha', '914085268', false),
  ('d42c88fb-ba94-40d2-8de0-2873caf217b8', 'Trần Thị Tố Loan', 'me', '869538098', true),
  ('d42c88fb-ba94-40d2-8de0-2873caf217b8', 'Trần Thái Bảo', 'cha', '988763678', false),
  ('3c51192f-c524-4cd2-9d08-bde1dd23a699', 'Nguyễn Thái Minh Huyền', 'me', '932391983', true),
  ('3c51192f-c524-4cd2-9d08-bde1dd23a699', 'Đặng Hoài Sơn', 'cha', '934644968', false),
  ('e090c529-57e0-403d-891f-a31dd3db1118', 'Thái Thị Thu Huyền', 'me', '946906668', true),
  ('13eb5283-86ec-46a8-b970-e0ae25f9b601', 'Bùi Thị Tố Na', 'me', '914266277', true),
  ('13eb5283-86ec-46a8-b970-e0ae25f9b601', 'Đào Quang Hưng', 'cha', '912583763', false),
  ('1f32dfc0-8a7b-4d3d-806c-053de7ee6c1a', 'Trần Thị Hải Yến', 'me', '943919243', true),
  ('1f32dfc0-8a7b-4d3d-806c-053de7ee6c1a', 'Nguyễn Mai Giáp', 'cha', '917241168', false),
  ('719c77cd-838e-4cb7-82ab-c8f96c622b79', 'Nguyễn Thị Trang', 'me', '965303705', true),
  ('719c77cd-838e-4cb7-82ab-c8f96c622b79', 'Nguyễn Hữu Đức', 'cha', '868999977', false),
  ('92b1a2db-f2bf-48e3-be5d-94162c5bc3e0', 'Trần Thị Hiên', 'me', '355855381', true),
  ('92b1a2db-f2bf-48e3-be5d-94162c5bc3e0', 'Nguyễn Văn Trung', 'cha', '375081430', false),
  ('f9120189-ccef-40a0-95f7-f24aa1268030', 'Bùi Thị Trâm', 'me', '916600558', true),
  ('f9120189-ccef-40a0-95f7-f24aa1268030', 'Lê Thanh Bình', 'cha', '975535444', false),
  ('7b4defe6-d94f-4ac5-af76-dc37075e6cb3', 'Nguyễn Thị Minh Tâm', 'me', '903571995', true),
  ('7b4defe6-d94f-4ac5-af76-dc37075e6cb3', 'Nguyễn Quang Huy', 'cha', '965437998', false),
  ('411c8a0c-e9f2-4215-82e4-494a5836701c', 'Thân Thị Huyền', 'me', '963320318', true),
  ('411c8a0c-e9f2-4215-82e4-494a5836701c', 'Hồ Phúc Thành', 'cha', '971955858', false),
  ('78ba2e38-ce63-45db-817d-f94adc19576a', 'Cao Thị Ngọc Diệp', 'me', '917150816', true),
  ('78ba2e38-ce63-45db-817d-f94adc19576a', 'Nguyễn Nam Thắng', 'cha', '982128078', false),
  ('3bb26086-dda4-463e-a83e-997f1144b21d', 'Ngô Thị Huyền Trang', 'me', '948212188', true),
  ('3bb26086-dda4-463e-a83e-997f1144b21d', 'Nguyễn Văn Việt Linh', 'cha', '916207997', false),
  ('eb78e69a-3fd1-438d-a2c5-72ba91c4a219', 'Nguyễn Thị Minh Thúy', 'me', '974772523', true),
  ('eb78e69a-3fd1-438d-a2c5-72ba91c4a219', 'Nguyễn Văn Dũng', 'cha', '963707887', false),
  ('14f40cff-8eff-4548-b83e-b7e80fe1bc30', 'Võ Cẩm Thủy', 'me', '973033559', true),
  ('6a360797-0623-4f30-82ad-6d44059fd01a', 'Hoàng Thị Kim Oanh', 'me', '985380706', true),
  ('6a360797-0623-4f30-82ad-6d44059fd01a', 'Võ Tá Duẩn', 'cha', '919252312', false),
  ('2732de23-f55f-4bc8-bdbf-bdfaa499373b', 'Võ Thị Hiệp', 'me', '918209995', true),
  ('2732de23-f55f-4bc8-bdbf-bdfaa499373b', 'Nguyễn Văn Anh', 'cha', '912349768', false),
  ('995c3574-1df4-49ff-9ac6-57a84af2bb87', 'Nguyễn Lệ Giang', 'me', '931228568', true),
  ('995c3574-1df4-49ff-9ac6-57a84af2bb87', 'Phan Đình Nghĩa', 'cha', '815863979', false),
  ('96c174a9-fca6-4d7a-a052-0c308c219319', 'Đặng Quỳnh Nga', 'me', '989489081', true),
  ('96c174a9-fca6-4d7a-a052-0c308c219319', 'Lê Văn Công', 'cha', '947662418', false),
  ('5aba735b-74a1-4570-b89a-d231741f9ad6', 'Nguyễn Thị Thủy', 'me', '974912332', true),
  ('5aba735b-74a1-4570-b89a-d231741f9ad6', 'Nguyễn Văn Tuấn', 'cha', '944936318', false),
  ('9cfc4015-8f23-4fd0-895e-a57663a0a9d2', 'Trần Thị Hà Mi', 'me', '382737789', true),
  ('9cfc4015-8f23-4fd0-895e-a57663a0a9d2', 'Phạm Mạnh Thuần', 'cha', '971875789', false),
  ('bd626906-651c-4352-ba97-6130289aaa17', 'Lê Thị Thùy Dương', 'me', '941428008', true),
  ('bd626906-651c-4352-ba97-6130289aaa17', 'Phan Thanh Hải', 'cha', '914445618', false);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('1fc89e10-ddd4-4b9c-a23c-8d94a14994bd', 'Nguyễn Mỹ Lê', 'me', '979292845', true),
  ('1fc89e10-ddd4-4b9c-a23c-8d94a14994bd', 'Nguyễn Mạnh Hùng', 'cha', '977843333', false),
  ('62df8443-475b-402f-9bbd-15997293bc58', 'Lê Thị Thùy Dương', 'me', '941428008', true),
  ('62df8443-475b-402f-9bbd-15997293bc58', 'Phan Thanh Hải', 'cha', '914445618', false),
  ('cb35a713-c4a6-434d-b249-b4dc6c1ff92f', 'Lê Thị Kiều Oanh', 'me', '982340307', true),
  ('cb35a713-c4a6-434d-b249-b4dc6c1ff92f', 'Bùi Anh Tuấn', 'cha', '978645333', false),
  ('d200f48a-c572-48ea-89a8-d64de81d6c9e', 'Bùi Thị Diễn', 'me', '912912492', true),
  ('d200f48a-c572-48ea-89a8-d64de81d6c9e', 'Nguyễn Tiến Dũng', 'cha', '0000000000', false),
  ('70e92fad-9286-460d-a8e8-961d6b17724e', 'Phan Thị Huyền', 'me', '918663222', true),
  ('70e92fad-9286-460d-a8e8-961d6b17724e', 'Trần Xuân Linh', 'cha', '948266188', false),
  ('3b7ec3bd-3ac7-4148-bc6e-db50d36ea0a9', 'Lê Thị Hường', 'me', '982854708', true),
  ('3b7ec3bd-3ac7-4148-bc6e-db50d36ea0a9', 'Nguyễn Tiến Thắng', 'cha', '0982951285', false),
  ('dbc217fa-31c4-4edb-82a4-241be48c8a1d', 'Lê Thị Quỳnh Anh', 'me', '941089798', true),
  ('dbc217fa-31c4-4edb-82a4-241be48c8a1d', 'Nguyễn Văn Lĩnh', 'cha', '948895555', false),
  ('433309ef-9b4f-4b6b-ad54-df0a72dc75ca', 'Nguyễn Thị Tâm Lan', 'me', '984766773', true),
  ('433309ef-9b4f-4b6b-ad54-df0a72dc75ca', 'Nguyễn Văn Tùng', 'cha', '911902999', false),
  ('9890ff01-543b-4420-9e9d-30c73df3077c', 'Dương Thị Minh Nguyệt', 'me', '988042668', true),
  ('9890ff01-543b-4420-9e9d-30c73df3077c', 'Trần Văn Cường', 'cha', '918889590', false),
  ('3c98eed9-6062-4a2a-953d-bc809efb85f2', 'Trần Thị Hằng', 'me', '916113678', true),
  ('3c98eed9-6062-4a2a-953d-bc809efb85f2', 'Đỗ Đức Chung', 'cha', '983886899', false),
  ('30dbb3bb-a45f-48f3-89da-2323c493fbe0', 'Trương Thị Tuyết Mai', 'me', '835231116', true),
  ('30dbb3bb-a45f-48f3-89da-2323c493fbe0', 'Hồ Anh Hoàng', 'cha', '972701999', false),
  ('1dedf6ba-0c95-426e-8952-1ca80609c031', 'Nguyễn Thị Hải Yến', 'me', '912079220', true),
  ('1dedf6ba-0c95-426e-8952-1ca80609c031', 'Nguyễn Công Phú', 'cha', '949092552', false),
  ('6983aa9a-afdb-4b04-ac4a-9b83882f11c8', 'Nguyễn Thị Trang', 'me', '789896996', true),
  ('facef156-85d9-4194-a5ce-fa2942a1a008', 'Trần Thị Thơ', 'me', '914297313', true),
  ('facef156-85d9-4194-a5ce-fa2942a1a008', 'Lê Chí Hướng', 'cha', '911465668', false),
  ('ae46b7bc-1a2c-4388-8fa3-0e32991a95a9', 'Phan Thị Lan Chi', 'me', '943855127', true),
  ('ae46b7bc-1a2c-4388-8fa3-0e32991a95a9', 'Trần Hồng Quân', 'cha', '947903819', false),
  ('0853f313-a13b-4ec4-89f8-764aa4269f69', 'Đặng Thị Phương', 'me', '763067022', true),
  ('0853f313-a13b-4ec4-89f8-764aa4269f69', 'Nguyễn Văn Huyền', 'cha', '931385060', false),
  ('dfe63e9c-aa8d-4221-9e1c-cb7de3eca4e1', 'Trương Thị Long', 'me', '931389393', true),
  ('dfe63e9c-aa8d-4221-9e1c-cb7de3eca4e1', 'Nguyễn Trọng Hùng', 'cha', '912592225', false),
  ('dfb1a76d-2c9a-4371-bb0e-ad2d1fc79b58', 'Lê Thị Quỳnh Liên', 'me', '915179991', true),
  ('dfb1a76d-2c9a-4371-bb0e-ad2d1fc79b58', 'Trần Đức Mạnh', 'cha', '948861994', false),
  ('7667cf9c-4f11-4141-a19b-779a20567983', 'Nguyễn Thị Liên', 'me', '945190493', true),
  ('8a2fda52-863b-4739-a8fc-2d112fc5e819', 'Nguyễn Thị Trang', 'me', '916489858', true),
  ('5b34dd7c-95f7-4bb2-834f-ee4d902e4c37', 'Nguyễn Thị Bích Ngọc', 'me', '911528696', true),
  ('5b34dd7c-95f7-4bb2-834f-ee4d902e4c37', 'Phan Bá Nam', 'cha', '913698286', false),
  ('2b151757-5d25-44d0-a523-187e50ccae2d', 'Phan Thị Thanh Huyền', 'me', '968998599', true),
  ('2b151757-5d25-44d0-a523-187e50ccae2d', 'Nguyễn Đức Thuận', 'cha', '974732742', false),
  ('831be383-7b44-476b-a513-e71a2cc1b641', 'Nguyễn Thị Trang', 'me', '976074941', true),
  ('831be383-7b44-476b-a513-e71a2cc1b641', 'Nguyễn Văn Dũng', 'cha', '985508517', false),
  ('641af681-049c-45b2-9be0-711aad2d057f', 'Trần Thị Hằng', 'me', '859696726', true),
  ('641af681-049c-45b2-9be0-711aad2d057f', 'Trần Hữu Thuần', 'cha', '0000000000', false),
  ('a2467d82-206e-4929-9f69-84c5f3d887d3', 'Nguyễn Thị Vân Anh', 'me', '943456896', true),
  ('a2467d82-206e-4929-9f69-84c5f3d887d3', 'Trần Đình Thái', 'cha', '943456896', false),
  ('273bf258-2174-478c-9aec-39774ab66d5c', 'Mẹ Hoàng An', 'me', '948122777', true),
  ('0747b181-4f84-4cce-a54c-71a1751f1d30', 'Trương Thị Hải Yến', 'me', '945288268', true),
  ('0747b181-4f84-4cce-a54c-71a1751f1d30', 'Nguyễn Thái Trung', 'cha', '984551089', false),
  ('37ad5b35-0dc7-4640-b806-d3afc5f4dd80', 'Trần Thị Vân', 'me', '942415576', true),
  ('37ad5b35-0dc7-4640-b806-d3afc5f4dd80', 'Trần Trọng Tấn', 'cha', '946858715', false),
  ('0ec40805-5cfb-449a-be66-a9c4af9dc7e3', 'Hồ Thị Ngọc Quỳnh', 'me', '919626778', true),
  ('0ec40805-5cfb-449a-be66-a9c4af9dc7e3', 'Lê Quốc Thành', 'cha', '911377689', false),
  ('f97deb85-3864-4103-baab-c72d6fc1ea9f', 'Trương Thị Thảo', 'me', '941331955', true),
  ('f97deb85-3864-4103-baab-c72d6fc1ea9f', 'Lê Trọng Hoàng', 'cha', '942939393', false),
  ('760f3f4e-be8c-4e93-8fd2-e73b66c2058b', 'Lê Thị Tố Nga', 'me', '915532978', true),
  ('760f3f4e-be8c-4e93-8fd2-e73b66c2058b', 'Phan Bá Linh', 'cha', '913104468', false),
  ('7f747fa0-1b77-4ca8-aed1-b5a6297bfbd2', 'Trần Thị Hương', 'me', '913129047', true),
  ('7f747fa0-1b77-4ca8-aed1-b5a6297bfbd2', 'Bùi Trọng Hùng', 'cha', '973997699', false),
  ('8472e5b0-ffbb-4ea0-b63b-f2724329164d', 'Phan Thị Quỳnh Nga', 'me', '947519396', true),
  ('8472e5b0-ffbb-4ea0-b63b-f2724329164d', 'Hà Huy Phong', 'cha', '984727777', false),
  ('c8ae0784-0cc2-47c7-8b47-a40597a2aec0', 'Nguyễn Thị Nhung', 'me', '979666730', true),
  ('ad5798bb-db3b-4b5f-b689-78300a02be5a', 'Thái Thị Dung', 'me', '824872558', true),
  ('ad5798bb-db3b-4b5f-b689-78300a02be5a', 'Phan Văn Minh', 'cha', '855082547', false),
  ('54876f9e-6623-45b9-bbd4-508ea7329e28', 'Bùi Thị Quý', 'me', '903371686', true),
  ('54876f9e-6623-45b9-bbd4-508ea7329e28', 'Lê Hữu Đức', 'cha', '919849938', false),
  ('5393ab80-5778-4f9e-9d7a-75b8f95dc2f9', 'Trần Cẩm Vân', 'me', '989904307', true),
  ('5393ab80-5778-4f9e-9d7a-75b8f95dc2f9', 'Nguyễn Bình Nam', 'cha', '979394943', false),
  ('dee48c1f-af69-4c35-9822-f15102c2f608', 'Chu Ngọc Mai', 'me', '985799698', true),
  ('dee48c1f-af69-4c35-9822-f15102c2f608', 'Trần Công Vũ', 'cha', '392345333', false),
  ('bd3ea065-d19b-4265-b99c-c60b740c046e', 'Nguyễn Nữ Ngân Hà', 'me', '986321826', true),
  ('bd3ea065-d19b-4265-b99c-c60b740c046e', 'Nguyễn Thành Nam', 'cha', '978681098', false),
  ('7924082e-8887-4e60-b140-47c9fdfd1783', 'Bà Nguyễn Thị Bình', 'me', '915465974', true),
  ('7924082e-8887-4e60-b140-47c9fdfd1783', 'Mẹ Hoàng Sơn', 'cha', '376522893', false),
  ('c28c6e24-1862-4e8e-8b80-438b603aa2ea', 'Lê Thị Thùy An', 'me', '969967796', true),
  ('c28c6e24-1862-4e8e-8b80-438b603aa2ea', 'Quách Hữu Tuấn', 'cha', '0000000000', false),
  ('24eedb56-477b-4c31-a548-abde8133285f', 'Nguyễn Lê Thanh Nhã', 'me', '919412991', true),
  ('24eedb56-477b-4c31-a548-abde8133285f', 'Phạm Tuấn Ánh', 'cha', '972236869', false),
  ('01ca4e79-263e-47c3-a962-2ab1a355d937', 'Trần Thị THùy Mai', 'me', '919020488', true),
  ('01ca4e79-263e-47c3-a962-2ab1a355d937', 'Nguyễn Xuân Hoàng', 'cha', '906104818', false),
  ('fbf398b6-9113-4ea3-afc2-9583e7945e0a', 'Đoàn Thùy Linh', 'me', '943268232', true),
  ('fbf398b6-9113-4ea3-afc2-9583e7945e0a', 'Phạm Anh Tú', 'cha', '915080992', false),
  ('a6913159-e223-4317-860c-6da26389f727', 'Phan Thị Cẩm Vân', 'me', '942281092', true),
  ('a6913159-e223-4317-860c-6da26389f727', 'Nguyễn Quý Đức', 'cha', '942111256', false),
  ('44121a4f-e811-4c8b-922e-eff8a42e4161', 'Nguyễn Thị Kiều Mai', 'me', '858753995', true),
  ('83da16a5-a93a-4b22-98bc-3e5ca0d37f96', 'Nguyễn Thị Hồng Liên', 'me', '948618567', true),
  ('83da16a5-a93a-4b22-98bc-3e5ca0d37f96', 'Nguyễn Phi Hùng', 'cha', '916274777', false),
  ('26c5fe0f-48b0-45b3-a5af-a312c3e7f56c', 'Hoàng Thị Thanh', 'me', '987245809', true),
  ('26c5fe0f-48b0-45b3-a5af-a312c3e7f56c', 'Trần Văn Huy', 'cha', '973400777', false),
  ('67ae2bb4-54aa-4c8e-acad-20f9e0fe361a', 'Nguyễn Thị Lê Dung', 'me', '986632286', true),
  ('67ae2bb4-54aa-4c8e-acad-20f9e0fe361a', 'Trần Hồng Phúc', 'cha', '913858520', false),
  ('1e238b13-de56-44bd-9425-09e30542d8df', 'Trần Thị Việt Hương', 'me', '914145060', true),
  ('bb2d2a28-cd9f-4035-b6ca-3b73f3c0992e', 'Hoàng Minh Thương', 'me', '942811733', true),
  ('bb2d2a28-cd9f-4035-b6ca-3b73f3c0992e', 'Phan Văn Thanh', 'cha', '948154444', false),
  ('d8173746-da9d-4548-bbdd-907380484545', 'Nguyễn Thị Thuần', 'me', '912785889', true),
  ('d8173746-da9d-4548-bbdd-907380484545', 'Phan Văn Thanh', 'cha', '912885889', false),
  ('9a4e828b-bc6a-467c-b283-b393978c8c72', 'Cao Thị Thùy Dung', 'me', '916516046', true),
  ('9a4e828b-bc6a-467c-b283-b393978c8c72', 'Trương Công Chính Đại', 'cha', '945492288', false),
  ('d05db175-89ab-4908-ace7-ad84186d2dbc', 'Trần Thị Minh Thư', 'me', '918522456', true);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('d05db175-89ab-4908-ace7-ad84186d2dbc', 'Lê Hữu Dũng', 'cha', '916649789', false),
  ('1ee5cff0-ce93-4885-894e-d003ea4d34be', 'Hà Phương Nhụy', 'me', '967730618', true),
  ('1ee5cff0-ce93-4885-894e-d003ea4d34be', 'Trần Việt Anh', 'cha', '948833868', false),
  ('4bbd19dd-314d-4db4-95c2-203732542918', 'Nguyễn Thị Diễm Ngọc', 'me', '918042368', true),
  ('4bbd19dd-314d-4db4-95c2-203732542918', 'Ngô Anh Dũng', 'cha', '912885658', false),
  ('5f177958-9ed7-4667-baf2-fb5abcc51435', 'Nguyễn Thị Phương Trinh', 'me', '969756914', true),
  ('5f177958-9ed7-4667-baf2-fb5abcc51435', 'Phan Hoàng Vũ', 'cha', '919342057', false),
  ('8946f79c-722c-43c3-aa58-f1a2c47ce422', 'Nguyễn Thị Trường An', 'me', '916785990', true),
  ('8946f79c-722c-43c3-aa58-f1a2c47ce422', 'Nguyễn Thu Dần', 'cha', '962712456', false),
  ('0c49be86-8f3b-4399-8cc1-2c1a7b84da1d', 'Nguyễn Thị Trà Giang', 'me', '985834092', true),
  ('0c49be86-8f3b-4399-8cc1-2c1a7b84da1d', 'Nguyễn Duy Trung', 'cha', '946627777', false),
  ('2b773290-b5b7-43fd-8504-2a1bbe7381a2', 'Trần Thị Thanh Hiền', 'me', '968749698', true),
  ('2b773290-b5b7-43fd-8504-2a1bbe7381a2', 'Nguyễn Sỹ Nhâm', 'cha', '941170888', false),
  ('18526d5a-1990-475a-aae8-2bba12927522', 'Phan Huy Trung', 'cha', '973891018', true),
  ('399585fe-9c00-4cb2-9615-1575b7fa10da', 'Dương Thị Như Quỳnh', 'me', '974674801', true),
  ('399585fe-9c00-4cb2-9615-1575b7fa10da', 'Hoàng Công Tuấn', 'cha', '964746937', false),
  ('ebfa5fbd-f78d-42ec-9084-4c488f93ea7f', 'Nguyễn Thị Lộc', 'me', '868450276', true),
  ('ebfa5fbd-f78d-42ec-9084-4c488f93ea7f', 'Nguyễn Phan Thành Duẫn', 'cha', '987298985', false),
  ('1e6d53d1-7b0c-4b36-ab60-0a5212fbec91', 'Nguyễn Thị Hà Trang', 'me', '799011997', true),
  ('1e6d53d1-7b0c-4b36-ab60-0a5212fbec91', 'Nguyễn Quốc Thắng', 'cha', '886479994', false),
  ('f33e41a7-f1f8-4a0e-aa4e-b93cc820baad', 'Trịnh Thị Thanh Mai', 'me', '962430690', true),
  ('f33e41a7-f1f8-4a0e-aa4e-b93cc820baad', 'Bùi Thế Hạnh', 'cha', '984909509', false),
  ('45cb722e-a8ed-4fbd-bb0a-85e2669755c1', 'Lê Thị Mai Linh', 'me', '911383885', true),
  ('45cb722e-a8ed-4fbd-bb0a-85e2669755c1', 'Lê Doãn Hoàng', 'cha', '914715889', false),
  ('cb84835c-b13b-4225-8d0f-5278beda13c3', 'Nguyễn Thị Thùy Dung', 'me', '977918088', true),
  ('cb84835c-b13b-4225-8d0f-5278beda13c3', 'Nguyễn Văn Hoàng', 'cha', '888543789', false),
  ('ea51d355-c8ef-4a30-aed4-2f555c703d2e', 'Đậu Thị Thu', 'me', '913863768', true),
  ('ea51d355-c8ef-4a30-aed4-2f555c703d2e', 'Nguyễn Văn Thắng', 'cha', '917813386', false),
  ('fe9cdcec-3b11-4c88-adbf-3fca4b595174', 'Trần Thị Ngọc', 'me', '971246678', true),
  ('fe9cdcec-3b11-4c88-adbf-3fca4b595174', 'Nguyễn Ngọc Thiện', 'cha', '866400886', false),
  ('30626f7a-44f5-4c45-b7a3-f42fef528647', 'Nguyễn Thị Huyền Trang', 'me', '982477695', true),
  ('30626f7a-44f5-4c45-b7a3-f42fef528647', 'Lê Doãn Thái', 'cha', '918606489', false),
  ('80b14746-59ec-4665-8146-65d5bbfc517f', 'Phạm Thị Hoa', 'me', '349952525', true),
  ('80b14746-59ec-4665-8146-65d5bbfc517f', 'Lê Văn Hùng', 'cha', '835363268', false),
  ('3dd16696-6fda-4621-bc5b-adc4cbebf7ef', 'Nguyễn Thị Hải Như', 'me', '983855021', true),
  ('3dd16696-6fda-4621-bc5b-adc4cbebf7ef', 'Tống Trần Tín', 'cha', '983411564', false),
  ('27d2010b-1b84-48d7-9fc3-16f178248243', 'Hoàng Thị Thanh Huyền', 'me', '914735689', true),
  ('27d2010b-1b84-48d7-9fc3-16f178248243', 'Hoàng Quang Trung', 'cha', '913294305', false),
  ('517c72bb-eec7-4a9d-b708-712da593ec87', 'Phan Thị Hường', 'me', '934507779', true),
  ('517c72bb-eec7-4a9d-b708-712da593ec87', 'Nguyễn Anh Tuấn', 'cha', '973457778', false),
  ('378e7f7b-ce3d-44c9-8714-c14eb68194e9', 'Nguyễn Thị Phượng', 'me', '945681510', true),
  ('378e7f7b-ce3d-44c9-8714-c14eb68194e9', 'Nguyễn Thành Đạt', 'cha', '985032675', false),
  ('fe410632-6046-4a64-86a0-b834bcc6a488', 'Hoàng Thị Hiền', 'me', '917836886', true),
  ('fe410632-6046-4a64-86a0-b834bcc6a488', 'Ngô Việt Hùng', 'cha', '917845548', false),
  ('8d53911a-3585-441e-8831-27e90bd1cecc', 'Đoàn Hồng Hạnh', 'me', '846651998', true),
  ('8d53911a-3585-441e-8831-27e90bd1cecc', 'Lê Thành Đạt', 'cha', '358271168', false),
  ('f8ddf126-c2f2-45e5-b978-ca4d148397fc', 'Trần Hải Yến', 'me', '772266893', true),
  ('f8ddf126-c2f2-45e5-b978-ca4d148397fc', 'Nguyễn Việt Dũng', 'cha', '936273178', false),
  ('69ce14e4-b4cf-41a4-af22-7267af5b6e3b', 'Lê Thị Thành Chung', 'me', '916901091', true),
  ('69ce14e4-b4cf-41a4-af22-7267af5b6e3b', 'Lê Hải Đăng', 'cha', '918676266', false),
  ('2114ad69-46ea-422b-8ae3-6203af1f4ad4', 'Nguyễn Thị Hồng Hà', 'me', '946284888', true),
  ('2114ad69-46ea-422b-8ae3-6203af1f4ad4', 'Nguyễn Quốc Sách', 'cha', '985903456', false),
  ('4f8b2105-462b-492e-a6d3-06605b6faf62', 'Lê Thị Nguyệt', 'me', '943422895', true),
  ('4f8b2105-462b-492e-a6d3-06605b6faf62', 'Dương Thế Lâm', 'cha', '941068968', false),
  ('7e3c4943-7e65-4d62-b8d7-933014f1c7c5', 'Nguyễn Thùy Dung', 'me', '944346456', true),
  ('7e3c4943-7e65-4d62-b8d7-933014f1c7c5', 'Trần Quốc Toản', 'cha', '917053567', false),
  ('180e1ca3-54ea-4a2f-b71a-b72511f9b8fa', 'Trần Thị Ngọc Thái', 'me', '346663489', true),
  ('180e1ca3-54ea-4a2f-b71a-b72511f9b8fa', 'Trần Văn Công', 'cha', '967867088', false),
  ('51a95bdb-8379-4202-9f14-fc680f208daa', 'Trần Phú An', 'me', '916737418', true),
  ('d4242a3c-c8b3-4ad1-b257-712f1d4ee01b', 'Dương Thị Hiền', 'me', '916898656', true),
  ('d4242a3c-c8b3-4ad1-b257-712f1d4ee01b', 'Trần Anh Hoàng', 'cha', '966090988', false),
  ('4825e299-6d4c-4867-93e2-b1b484766e08', 'Nguyễn Thị Hương', 'me', '944840456', true),
  ('4825e299-6d4c-4867-93e2-b1b484766e08', 'Trần Đức Tuấn', 'cha', '916778186', false),
  ('6a9bdc08-4ba1-48bb-ac47-ad71aef85ab0', 'Trần Ngọc Mai', 'me', '946486246', true),
  ('6a9bdc08-4ba1-48bb-ac47-ad71aef85ab0', 'Nguyễn Văn Bảo', 'cha', '0000000000', false),
  ('c56d09ce-4cc2-4b4e-8e56-95e8ecced581', 'Phan Thị Trúc Linh', 'me', '915296788', true),
  ('c56d09ce-4cc2-4b4e-8e56-95e8ecced581', 'Thái Văn Trung', 'cha', '919453639', false),
  ('f37c24b6-318a-4c8e-93af-6a6644738251', 'Nguyễn Thị Hằng Nga', 'me', '913238237', true),
  ('f37c24b6-318a-4c8e-93af-6a6644738251', 'Nguyễn Hữu Hòa', 'cha', '943019181', false),
  ('8e2deb28-48ae-4262-8200-28fca9bac412', 'Phan Lê Mỹ Duyên', 'me', '969864822', true),
  ('8e2deb28-48ae-4262-8200-28fca9bac412', 'Nguyễn Văn Tuấn', 'cha', '941768963', false),
  ('0ecc6de8-fb6d-4bb5-91b7-566f58bbb79b', 'Phan Bảo Anh', 'me', '979051797', true),
  ('0ecc6de8-fb6d-4bb5-91b7-566f58bbb79b', 'Hồ Viết Phú', 'cha', '963447694', false),
  ('fa2f3852-0a07-47bb-95e6-116057a913ab', 'Dương Thị Hà Linh', 'me', '942581278', true),
  ('fa2f3852-0a07-47bb-95e6-116057a913ab', 'Trương Huy Giáp', 'cha', '911212366', false),
  ('33ad1ac7-8683-4e4d-b6a5-25631a4ab041', 'Hoàng Thị Thùy Linh', 'me', '911416268', true),
  ('33ad1ac7-8683-4e4d-b6a5-25631a4ab041', 'Nguyễn Đình Hạnh', 'cha', '0000000000', false),
  ('4aee7619-4706-410b-ad29-7ab5d9c3c42f', 'Lê Thị Tú Anh', 'me', '988420002', true),
  ('4aee7619-4706-410b-ad29-7ab5d9c3c42f', 'Nguyễn Ngọc Hiếu', 'cha', '973434777', false),
  ('91f1d8f1-3875-4767-b57c-92de472fcee3', 'Dương Thị Hải Yến', 'me', '914738388', true),
  ('91f1d8f1-3875-4767-b57c-92de472fcee3', 'Trần Văn Sử', 'cha', '904618098', false),
  ('abc56063-8541-4ffa-af2e-9d50a6ed9a4e', 'Nguyễn Thị Lệ Huyền', 'me', '919387168', true),
  ('abc56063-8541-4ffa-af2e-9d50a6ed9a4e', 'Nguyễn Gia Thịnh', 'cha', '988469666', false),
  ('ae7a5e8d-5289-45a4-95ea-f21007001701', 'Nguyễn Thị Quỳnh Anh', 'me', '978938298', true),
  ('ae7a5e8d-5289-45a4-95ea-f21007001701', 'Lê Anh Quyền', 'cha', '962454668', false),
  ('3153444a-6ff6-4dd4-bfa9-6640651893a3', 'Nguyễn Thị Cẩm Trang', 'me', '948638289', true),
  ('3153444a-6ff6-4dd4-bfa9-6640651893a3', 'Bùi Đức Anh', 'cha', '941633838', false),
  ('3b43efa2-6ba1-41b0-94d9-59a997dda65f', 'Trần Thị Hải Yến', 'me', '943919243', true),
  ('3b43efa2-6ba1-41b0-94d9-59a997dda65f', 'Nguyễn Mai Giáp', 'cha', '917241168', false),
  ('150c2973-3562-4d1b-9153-4636d1329e8d', 'Phùng Thị Thu Hiền', 'me', '984398015', true),
  ('150c2973-3562-4d1b-9153-4636d1329e8d', 'Lê Văn Kiêm', 'cha', '968986666', false),
  ('9d0cb0d3-84b9-43fc-95eb-9245c9b133fd', 'Trần Thị Ánh Quỳnh', 'me', '916477986', true),
  ('9d0cb0d3-84b9-43fc-95eb-9245c9b133fd', 'Nguyễn Văn Thành', 'cha', '949213125', false),
  ('b2f53756-c485-4c6e-b376-2da5b47d1171', 'Nguyễn Thị Thu', 'me', '917616663', true),
  ('b2f53756-c485-4c6e-b376-2da5b47d1171', 'Dương Phi Thăng', 'cha', '0000000000', false),
  ('939f51ea-c126-414c-a854-b71138f1e732', 'Nguyễn Thị Hương', 'me', '974608788', true),
  ('939f51ea-c126-414c-a854-b71138f1e732', 'Trần Nam Phượng', 'cha', '942028558', false),
  ('5112380f-312d-4ab2-b5c9-368a1d527fd7', 'Phan Thị Thảo', 'me', '967138088', true),
  ('5112380f-312d-4ab2-b5c9-368a1d527fd7', 'Nguyễn Văn Nghị', 'cha', '0000000000', false),
  ('aab13a5c-bff1-4e66-b6f3-f045054d6d2e', 'Nguyễn Thị Trinh', 'me', '916729866', true);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('a3e9b37d-2414-4633-95d0-ec1c93a9ac90', 'Đoàn Thị Hoài Thương', 'me', '986358087', true),
  ('a3e9b37d-2414-4633-95d0-ec1c93a9ac90', 'Nguyễn Huy Phong', 'cha', '915448566', false),
  ('9c3f2d02-adbb-44db-939d-8385d93b8652', 'Phạm Thị Khánh Linh', 'me', '333458899', true),
  ('9c3f2d02-adbb-44db-939d-8385d93b8652', 'Nguyễn Xuân Thanh', 'cha', '946892899', false),
  ('1bb23943-d59a-4674-bacb-95c5d50eeecb', 'Trần Thị Thắm', 'me', '335241497', true),
  ('1bb23943-d59a-4674-bacb-95c5d50eeecb', 'Lê Văn Tuấn', 'cha', '917906691', false),
  ('8bd21496-fa19-425a-9618-429d83bcdbac', 'Nguyễn Thị Thoa', 'me', '379316521', true),
  ('8bd21496-fa19-425a-9618-429d83bcdbac', 'Phan Đình Thịnh', 'cha', '917088922', false),
  ('3343d63e-08a3-48b3-b856-c3f677be7a5c', 'Lương Trần Thanh Huyền', 'me', '349730769', true),
  ('3343d63e-08a3-48b3-b856-c3f677be7a5c', 'Đinh Văn Tiến', 'cha', '914443491', false),
  ('9e00e2b5-6e9b-422a-8911-7185736bf442', 'Nguyễn Thị Cẩm Tú', 'me', '911036663', true),
  ('9e00e2b5-6e9b-422a-8911-7185736bf442', 'Biện Thanh Sơn', 'cha', '915407222', false),
  ('5a7f2332-6956-4cb5-be0a-e0ee4c7509b4', 'Nguyễn Thị Thanh Thủy', 'me', '941298222', true),
  ('5a7f2332-6956-4cb5-be0a-e0ee4c7509b4', 'Võ Tuấn Anh', 'cha', '946169977', false),
  ('c875f6eb-1d6a-4af9-b634-bf326d6c79c2', 'Võ Thị Như Quỳnh', 'me', '0904410888', true),
  ('c875f6eb-1d6a-4af9-b634-bf326d6c79c2', 'Nguyễn Cao Cường', 'cha', '916776299', false),
  ('e831f0a4-04e8-4feb-83b1-f2eecef70bef', 'Phạm Thị Tuyết', 'me', '984838946', true),
  ('e831f0a4-04e8-4feb-83b1-f2eecef70bef', 'Lê Văn Bảo', 'cha', '976700747', false),
  ('fdd8f94d-d5a7-43b8-9ed8-07834f0ac0c7', 'Lê Nguyễn Quỳnh Hoa', 'me', '983067697', true),
  ('fdd8f94d-d5a7-43b8-9ed8-07834f0ac0c7', 'Phạm Đình Sang', 'cha', '989090194', false),
  ('dcc79844-a1f3-43b6-9b80-c3da2c5c0e4f', 'Võ Thị Xuân', 'me', '979797529', true),
  ('dcc79844-a1f3-43b6-9b80-c3da2c5c0e4f', 'Nguyễn Ngọc Chung', 'cha', '946263269', false),
  ('e2eab20e-f38c-46b1-8e0a-ba15d87fc457', 'Biện Thị Nghĩa', 'me', '984560379', true),
  ('e2eab20e-f38c-46b1-8e0a-ba15d87fc457', 'Ngô Đăng Dương', 'cha', '974047008', false),
  ('6ddab1d6-5d5e-4443-98fa-acd19bf9bd8a', 'Nguyễn Thị Hoài Phương', 'me', '987105055', true),
  ('6ddab1d6-5d5e-4443-98fa-acd19bf9bd8a', 'Nguyễn Khắc Tuân', 'cha', '0000000000', false),
  ('9a937b6f-913e-437f-b58f-c36a0f9e4e3f', 'Nguyễn Thị Ngọc Vân', 'me', '918908226', true),
  ('9a937b6f-913e-437f-b58f-c36a0f9e4e3f', 'Lê Văn Mậu', 'cha', '942188488', false),
  ('2cf846cf-f741-47b6-bb2f-e2b4955daeed', 'Phan Thị Thanh Huyền', 'me', '942233626', true),
  ('2cf846cf-f741-47b6-bb2f-e2b4955daeed', 'Nguyễn Tâm Đức', 'cha', '943736667', false),
  ('7fa40c0e-c066-4c21-a679-ac34c6082ab1', 'Nguyễn Thị Tuyến Lê', 'me', '973380477', true),
  ('7fa40c0e-c066-4c21-a679-ac34c6082ab1', 'Phan Công Hải', 'cha', '989248248', false),
  ('92b4dffd-4bc9-4360-bd2f-2d38928ea5d4', 'Nguyễn Văn Trung', 'me', '375081430', true),
  ('92b4dffd-4bc9-4360-bd2f-2d38928ea5d4', 'Trần Thị Hiên', 'cha', '355855381', false),
  ('f55155c7-0957-45c2-9584-28352fc1c995', 'Trần Thị Thủy', 'me', '914949494', true),
  ('f55155c7-0957-45c2-9584-28352fc1c995', 'Nguyễn Ngọc Anh', 'cha', '919194566', false),
  ('5f6fe9b9-d222-4fb9-a233-6915b0c16f2e', 'Lê Quỳnh Trang', 'me', '969813995', true),
  ('5f6fe9b9-d222-4fb9-a233-6915b0c16f2e', 'Võ Lâm Quốc Thắng', 'cha', '859286789', false),
  ('681f57ce-976b-43b6-a492-5cd3b2745ac4', 'Phạm Thị Hương', 'me', '917553268', true),
  ('681f57ce-976b-43b6-a492-5cd3b2745ac4', 'Hà Huy Minh', 'cha', '917767779', false),
  ('a313adea-c2bb-4b05-a84d-703a7d8892e3', 'Nguyễn Thị Trinh', 'me', '915210777', true),
  ('a313adea-c2bb-4b05-a84d-703a7d8892e3', 'Phan Công Thiện', 'cha', '911537268', false),
  ('50ecffea-d354-415d-b256-70cb500f02d1', 'Nguyễn Thị Mỹ Hoa', 'me', '917631699', true),
  ('50ecffea-d354-415d-b256-70cb500f02d1', 'Nguyễn Thế Trường', 'cha', '912124699', false),
  ('3eb348e0-0a63-43eb-a867-c02b40baf5a5', 'Nguyễn Thị Mỹ Linh', 'me', '979626439', true),
  ('3eb348e0-0a63-43eb-a867-c02b40baf5a5', 'Mai Văn Nam', 'cha', '918888963', false),
  ('de1b129b-56f5-4f9e-b882-eed96840b891', 'Nguyễn Hải Vân', 'me', '947336797', true),
  ('de1b129b-56f5-4f9e-b882-eed96840b891', 'Nguyễn Văn Khánh', 'cha', '916608618', false),
  ('b767ec93-1613-4df1-9e89-9ca239eb6f44', 'Trần Thị Thu Hiền', 'me', '948707656', true),
  ('b767ec93-1613-4df1-9e89-9ca239eb6f44', 'Trần Huy Trung', 'cha', '915433779', false),
  ('fcc17d3f-a31f-446a-b02c-2a2570e2f6e6', 'Lê Thị Thanh Nga', 'me', '971294286', true),
  ('fcc17d3f-a31f-446a-b02c-2a2570e2f6e6', 'Tô Đình Ái', 'cha', '972861286', false),
  ('fe836e7b-71f9-4ed3-b465-7fbb4babb578', 'Bùi Thị Thủy Ninh', 'me', '961419686', true),
  ('fe836e7b-71f9-4ed3-b465-7fbb4babb578', 'Nguyễn Hoàng Sáng', 'cha', '942582668', false),
  ('13b32b8a-905a-40e4-a7e1-e3f1db06f54c', 'Lưu Thị Trâm Anh', 'me', '976393717', true),
  ('13b32b8a-905a-40e4-a7e1-e3f1db06f54c', 'Nguyễn Hữu Quốc', 'cha', '912322696', false),
  ('f1a257e0-4284-4af0-89fc-4e59412cea94', 'Phan Thị Thu Phương', 'me', '932324545', true),
  ('f1a257e0-4284-4af0-89fc-4e59412cea94', 'Nguyễn Đức Mậu', 'cha', '971454545', false),
  ('c0db6b98-04b3-4af1-ae7d-b4f7b5f871d4', 'Mẹ Chi', 'me', '916686402', true),
  ('09506cc0-21d0-4b3f-a40f-340922226cf7', 'Đặng Thị Thúy Diễm', 'me', '982085361', true),
  ('09506cc0-21d0-4b3f-a40f-340922226cf7', 'Trương Hải Đức', 'cha', '912342358', false),
  ('707dad1d-e0c4-4ffb-90c1-bf553c04f42f', 'Trần Thị Hằng', 'me', '973989303', true),
  ('707dad1d-e0c4-4ffb-90c1-bf553c04f42f', 'Võ Tá Quế', 'cha', '973779199', false),
  ('a247734d-fbea-4322-8922-250b0e5e11fc', 'Nguyễn Thị Lệ Thủy', 'me', '838490777', true),
  ('a247734d-fbea-4322-8922-250b0e5e11fc', 'Lê Văn Hải', 'cha', '981004567', false),
  ('b74ce70a-9cec-4e61-99d9-56048124b3b6', 'Lê Thị Lệ Hồng', 'me', '906251025', true),
  ('b74ce70a-9cec-4e61-99d9-56048124b3b6', 'Nguyễn Tuấn Vũ', 'cha', '917146869', false),
  ('e60e0b6f-4623-4ac3-91ed-2ddb4d302f1e', 'Phan Thị Hà Phương', 'me', '915613131', true),
  ('e60e0b6f-4623-4ac3-91ed-2ddb4d302f1e', 'Võ Tuấn Anh', 'cha', '949107789', false),
  ('5c37de2d-1850-4deb-9f6c-f4cf32d4fe7a', 'Phạm Thị Hoài Thơ', 'me', '349616101', true),
  ('5c37de2d-1850-4deb-9f6c-f4cf32d4fe7a', 'Lê Văn Duật', 'cha', '987742525', false),
  ('63ca63b6-dd96-4833-a67e-ff142f2d47f7', 'Thiều Thị Lê', 'me', '778556336', true),
  ('63ca63b6-dd96-4833-a67e-ff142f2d47f7', 'Hoàng Văn Thái', 'cha', '934455288', false),
  ('46e428bf-610c-4798-b154-42c44839bf3d', 'Nguyễn Thị Hương', 'me', '399715369', true),
  ('46e428bf-610c-4798-b154-42c44839bf3d', 'Mai Văn Tươi', 'cha', '0977450893', false),
  ('3d2cc572-5108-43a3-9a3c-e6533ee792a0', 'Nguyễn Thị Nga', 'me', '975637025', true),
  ('3d2cc572-5108-43a3-9a3c-e6533ee792a0', 'Trần Quốc Tuấn', 'cha', '859387116', false),
  ('d0fea58f-c471-41b8-962e-822af1c77a5c', 'Hoàng Hải Yến', 'me', '946798668', true),
  ('d0fea58f-c471-41b8-962e-822af1c77a5c', 'Nguyễn Tuấn Vũ', 'cha', '945552005', false),
  ('f384b37a-ef61-45b6-8406-6ec99c85eb97', 'Nguyễn Thị Quý', 'me', '0000000000', true),
  ('f384b37a-ef61-45b6-8406-6ec99c85eb97', 'Phạm Thái Tài', 'cha', '913379597', false),
  ('b1eb3b40-dc20-4598-badb-090f7dc6fc7e', 'Hoàng Thị Thu', 'me', '967287125', true),
  ('b1eb3b40-dc20-4598-badb-090f7dc6fc7e', 'Nguyễn Văn Linh', 'cha', '971971797', false),
  ('f3a899d0-c908-4afc-a9ab-f403634ddd6c', 'Hoàng Thị Nga', 'me', '947303993', true),
  ('f3a899d0-c908-4afc-a9ab-f403634ddd6c', 'Trần Quốc Đức', 'cha', '869180142', false),
  ('dbb0a037-2940-4610-adad-36d3b3686714', 'Nguyễn Thị Hằng Nga', 'me', '946083388', true),
  ('dbb0a037-2940-4610-adad-36d3b3686714', 'Nguyễn Xuân Diệt', 'cha', '916657789', false),
  ('21caf213-ff0d-4dcd-9d34-58b4ce3e7c1a', 'Phạm Thị Huyền Trang', 'me', '916506789', true),
  ('21caf213-ff0d-4dcd-9d34-58b4ce3e7c1a', 'Nguyễn Tiến Bắc', 'cha', '942633333', false),
  ('4f86b27d-b81e-4cc0-bb6e-6d86d9f2d0a5', 'Bùi Thị Thơm', 'me', '983262012', true),
  ('4a311a0a-9f3a-4953-ac87-814759c253b7', 'Nguyễn Thị Ngọc Bé', 'me', '982254678', true),
  ('4a311a0a-9f3a-4953-ac87-814759c253b7', 'Hoàng Mạnh Hùng', 'cha', '966956956', false),
  ('233f3c92-0a62-41af-8b71-ad46d2eb34b1', 'Trịnh Thị Hồng Thơm', 'me', '975262234', true),
  ('233f3c92-0a62-41af-8b71-ad46d2eb34b1', 'Trần Chính Nghĩa', 'cha', '866287555', false),
  ('e55127c9-29da-49f9-b61b-a4abf384708a', 'Phạm Thị Huyền Linh', 'me', '967893233', true),
  ('a6fbe965-69fb-4c64-a3b1-7c89a9ebcd83', 'Trần Thị Linh', 'me', '976126927', true),
  ('a6fbe965-69fb-4c64-a3b1-7c89a9ebcd83', 'Dương Minh Đức', 'cha', '989044860', false),
  ('e40f85b5-3bc6-45c9-9e93-36b2825a4f7a', 'Tô Thị Mỹ Duyên', 'me', '915538595', true),
  ('e40f85b5-3bc6-45c9-9e93-36b2825a4f7a', 'Bùi Bảo Trung', 'cha', '967753757', false),
  ('35efbef9-300d-41c5-8437-c177ca3ece31', 'Võ Thị Yên', 'me', '948131112', true);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('35efbef9-300d-41c5-8437-c177ca3ece31', 'Trần Văn Hùng', 'cha', '916103676', false),
  ('e1904332-3e16-49bc-879c-7881704cf912', 'Vương Thị Huyền Trang', 'me', '931364456', true),
  ('e1904332-3e16-49bc-879c-7881704cf912', 'Lê Ngọc Hoàng', 'cha', '942642555', false),
  ('95c7a3c7-3dd8-4607-923f-5a21db9269a8', 'Nguyễn Thị Năm', 'me', '966717903', true),
  ('95c7a3c7-3dd8-4607-923f-5a21db9269a8', 'Trần Đình Nhâm', 'cha', '392985372', false),
  ('7ba99bff-f03b-4dce-af8a-6794906eabd0', 'Võ Thị Hương', 'me', '977692228', true),
  ('7ba99bff-f03b-4dce-af8a-6794906eabd0', 'Nguyễn Hoàng Dũng', 'cha', '943155244', false),
  ('14b6babc-40c2-48ec-9db8-dc8bc898fed6', 'Nguyễn Thị Kim Ngân', 'me', '911975651', true),
  ('14b6babc-40c2-48ec-9db8-dc8bc898fed6', 'Nguyễn Khai Rốp', 'cha', '988670726', false),
  ('41fccee7-3c0d-4d27-aa64-8ea5202e02cb', 'Phan Thị Minh Hiền', 'me', '989521932', true),
  ('431b48de-008f-42c4-a642-d94986564318', 'Nguyễn Thị Liễu', 'me', '917334777', true),
  ('431b48de-008f-42c4-a642-d94986564318', 'Nguyễn Trung Thành', 'cha', '961706333', false),
  ('bb40785a-a29c-472d-82cb-882d5cd358a6', 'Nguyễn Thị Trang', 'me', '937836262', true),
  ('bb40785a-a29c-472d-82cb-882d5cd358a6', 'Hà Văn Thái', 'cha', '911559697', false),
  ('81a9ed91-9730-4b42-a9e0-31709e0ff71a', 'Võ Thị Loan', 'me', '384199235', true),
  ('81a9ed91-9730-4b42-a9e0-31709e0ff71a', 'Nguyễn Hùng Cường', 'cha', '977255291', false),
  ('ba852746-450f-4d28-93bd-8cd455754756', 'Đặng Thị Kim Anh', 'me', '963450506', true),
  ('ba852746-450f-4d28-93bd-8cd455754756', 'Phan Lê Đăng Khôi', 'cha', '915645456', false),
  ('2f3efa52-ed3f-4407-9f97-9eca50a979cf', 'Hà Phương Nhụy', 'me', '967730618', true),
  ('2f3efa52-ed3f-4407-9f97-9eca50a979cf', 'Trần Việt Anh', 'cha', '948833868', false),
  ('ca63d63f-9f07-4336-8621-6de0a81a55f6', 'Lê Thị Mỹ', 'me', '917675586', true),
  ('62599974-4273-443e-af1d-dd20a6d71911', 'Đặng Hoàng Anh Thư', 'me', '974507888', true),
  ('62599974-4273-443e-af1d-dd20a6d71911', 'Thái Biểu', 'cha', '901729196', false),
  ('972aeeb2-9755-40c4-8ba8-8fb720340f3f', 'Hoài Thương', 'me', '988989907', true),
  ('3daefe59-51ab-4b33-bb6f-5b9f5072ee82', 'Hoàng Thị Trang', 'me', '914735450', true),
  ('3daefe59-51ab-4b33-bb6f-5b9f5072ee82', 'Trần Xuân Hoàng', 'cha', '326353627', false),
  ('84dc6c7f-6f73-4c02-a412-6e6104088177', 'Mẹ Huyền', 'me', '372007593', true),
  ('7058ae5c-b90c-454c-8de6-2c6a0ad1f845', 'Lê Thị Hà Phương', 'me', '911081456', true),
  ('7058ae5c-b90c-454c-8de6-2c6a0ad1f845', 'Trần Văn Anh', 'cha', '976322023', false),
  ('4350a468-7e8f-402b-b210-fc453f37b76a', 'Bùi Thị Thanh Hải', 'me', '385751251', true),
  ('4350a468-7e8f-402b-b210-fc453f37b76a', 'Chu Mạnh Thủy', 'cha', '972120121', false),
  ('0b9b68fb-df87-4eec-bbf0-3bdee9e565c7', 'Trần Văn Phi', 'me', '986765092', true),
  ('0b9b68fb-df87-4eec-bbf0-3bdee9e565c7', 'Nguyễn Thị Thanh Hoài', 'cha', '368078133', false),
  ('b1eaa2ea-c2bb-4b5b-a8f1-6d3d07f93007', 'Mẹ Hạnh', 'me', '917817889', true),
  ('9ecc404b-8d28-48f8-af73-32166b530733', 'Nguyễn Thị Huyền Trang', 'me', '949514222', true),
  ('9ecc404b-8d28-48f8-af73-32166b530733', 'Thân Văn Dũng', 'cha', '918689396', false),
  ('2b855899-1a4e-4702-971f-2c31bacd7ac7', 'Trần Thị Kim Chung', 'me', '974379939', true),
  ('2b855899-1a4e-4702-971f-2c31bacd7ac7', 'Nguyễn Doãn Hải', 'cha', '0000000000', false),
  ('dc789570-61ae-45b7-a670-5258ed7e4b0e', 'Phan Hồng Hạnh', 'me', '943227889', true),
  ('dc789570-61ae-45b7-a670-5258ed7e4b0e', 'Nguyễn Huy Hoàng', 'cha', '916566679', false),
  ('f139bb60-ff47-41f1-bcd4-bfcb41be74db', 'Trần Thị Mai Anh', 'me', '342047181', true),
  ('f139bb60-ff47-41f1-bcd4-bfcb41be74db', 'Lương Tuấn Nhật', 'cha', '917899197', false),
  ('e586686a-0971-4fde-b224-72640e29e57f', 'Nguyễn Thị Thảo', 'me', '968024358', true),
  ('e586686a-0971-4fde-b224-72640e29e57f', 'Nguyễn Đức Thắng', 'cha', '853835069', false),
  ('4d3d63ea-9f81-4efe-965a-bb0729a7ed7a', 'Nguyễn Khánh Anh', 'me', '972335151', true),
  ('3e742901-0fcf-4bb0-b43e-82da2d4a9015', 'Đậu Thị Tố Uyên', 'me', '974105323', true),
  ('3e742901-0fcf-4bb0-b43e-82da2d4a9015', 'Trần Đình Tiến', 'cha', '967080345', false),
  ('da8f18d2-ad26-4e72-a0af-12bdb6e9b760', 'Cù Thị Ngọc Huyền', 'me', '984178773', true),
  ('da8f18d2-ad26-4e72-a0af-12bdb6e9b760', 'Đặng Đình Báu', 'cha', '817761234', false),
  ('ddbc7181-d3fa-4990-866a-04c30055ff9d', 'Hà Thị Dung', 'me', '989652699', true),
  ('ec0ce4f5-af84-4b19-b189-da494a29808e', 'Trần Thị Mỹ', 'me', '816100594', true),
  ('39f51745-8e15-4869-8837-095f27898ed3', 'Nguyễn Phương Anh', 'me', '917692255', true),
  ('39f51745-8e15-4869-8837-095f27898ed3', 'Trần Anh Dũng', 'cha', '845481333', false),
  ('bc17074e-fc1e-4af3-8c35-f7b90cf624d8', 'Trương Thị Giang', 'me', '941473366', true),
  ('bc17074e-fc1e-4af3-8c35-f7b90cf624d8', 'Phan Mạnh Cường', 'cha', '948775666', false),
  ('2afb060b-1709-4630-b52d-1138457c8c29', 'Nguyễn Thị Thương', 'me', '942750555', true),
  ('2afb060b-1709-4630-b52d-1138457c8c29', 'Trần Anh Hào', 'cha', '947768768', false),
  ('c700ccfe-d88f-4a5e-bc88-71d4dfc2c941', 'Nguyễn Thị Hồng', 'me', '392932882', true),
  ('c700ccfe-d88f-4a5e-bc88-71d4dfc2c941', 'Nguyễn Văn Hiệp', 'cha', '982834741', false),
  ('fc4c0214-1491-417a-a225-ce3cc96d4bad', 'Trịnh Thị Na', 'me', '943617897', true),
  ('fc4c0214-1491-417a-a225-ce3cc96d4bad', 'Dương Văn Mậu', 'cha', '947687198', false),
  ('7099a776-351f-4c03-8917-9129a72f78ad', 'Nguyễn Trương Khánh Huyền', 'me', '387393916', true),
  ('7099a776-351f-4c03-8917-9129a72f78ad', 'Trần Thanh Việt', 'cha', '983855550', false),
  ('bd8f6942-61dd-4b4f-9029-91c8309d30e3', 'Thiều Thị Lê', 'me', '976020996', true),
  ('3a4afbf2-e37b-41f1-b571-6ee11b7363db', 'Nguyễn Thị Hường', 'me', '817234668', true),
  ('3a4afbf2-e37b-41f1-b571-6ee11b7363db', 'Đặng Đình Nhân', 'cha', '973727197', false),
  ('36d98db2-479b-44c8-ae9a-32b3c3789dab', 'Bùi Thị Quý', 'me', '903371686', true),
  ('36d98db2-479b-44c8-ae9a-32b3c3789dab', 'Lê Hữu Đức', 'cha', '903371686', false),
  ('439db5ce-b700-434a-861c-10a45feb90f9', 'Lê Thị Hoài', 'me', '913294637', true),
  ('439db5ce-b700-434a-861c-10a45feb90f9', 'Võ Xuân Dũng', 'cha', '979568283', false),
  ('34e15b79-6869-40f5-ac55-03c06b90eaad', 'Chu Thị Kim Thêu', 'me', '976645593', true),
  ('34e15b79-6869-40f5-ac55-03c06b90eaad', 'Trương Minh Châu', 'cha', '987689011', false),
  ('65fc54ce-a98b-4f93-b28c-d1bc69657bed', 'Trần Thị Hằng', 'me', '976710115', true),
  ('65fc54ce-a98b-4f93-b28c-d1bc69657bed', 'Lê Huỳnh Đức', 'cha', '911057789', false),
  ('1b086264-9a76-4043-bb16-f6d647dec18e', 'Trần Thị Thủy', 'me', '914949494', true),
  ('1b086264-9a76-4043-bb16-f6d647dec18e', 'Nguyễn Ngọc Anh', 'cha', '0000000000', false),
  ('3464f831-9a31-4d9c-82cd-46de1e7d19d8', 'Đoàn Nữ Mai Phương', 'me', '975951225', true),
  ('3464f831-9a31-4d9c-82cd-46de1e7d19d8', 'Trần Hải Quân', 'cha', '977619602', false),
  ('a473b88d-f36c-41be-996f-05f909fbdad1', 'Biện Thị Hằng', 'me', '947888667', true),
  ('ae69b4a7-6493-4974-80fd-2979773ae50d', 'Trần Thị Thanh Tâm', 'me', '977594610', true),
  ('ae69b4a7-6493-4974-80fd-2979773ae50d', 'Nguyễn Đình Huấn', 'cha', '917635455', false),
  ('925c0197-4ea1-4c99-8a7b-55b36eb0f7c7', 'Nguyễn Thị Anh', 'me', '966708243', true),
  ('ab7dad0e-cab5-4c64-a484-b7f193dc615a', 'Nguyễn Thị Kim Chi', 'me', '911748789', true),
  ('ab7dad0e-cab5-4c64-a484-b7f193dc615a', 'Bùi Ngọc Sơn', 'cha', '0000000000', false),
  ('b5ef2e49-ad49-4114-aa16-fdc6185674cf', 'Trần Thị Hà Mi', 'me', '382737789', true),
  ('bc73a8a4-1f02-4131-98ab-1ec874c3c327', 'Hồ Thị Bích Hồng', 'me', '917931996', true),
  ('bc73a8a4-1f02-4131-98ab-1ec874c3c327', 'Lưu Văn Thọ', 'cha', '912989098', false),
  ('1e8171c5-e767-41b0-9819-1c24adb0afb2', 'Mẹ Thùy Trang', 'me', '974001575', true),
  ('d53e2a05-55cc-4659-8bb4-92cbf2a463bc', 'Hồ Thúy Nga', 'me', '919092992', true),
  ('d53e2a05-55cc-4659-8bb4-92cbf2a463bc', 'Nguyễn Viết Dũng', 'cha', '918513386', false),
  ('4b0cd3a3-b799-4716-84fc-9f612dc89345', 'Võ Thị Thanh Hải', 'me', '858703789', true),
  ('4b0cd3a3-b799-4716-84fc-9f612dc89345', 'Nguyễn Anh Tú', 'cha', '976604345', false),
  ('d405f1e6-6b6f-4887-81e0-06c231d827fc', 'Nguyễn Lê Thanh Nhã', 'me', '919412991', true),
  ('d405f1e6-6b6f-4887-81e0-06c231d827fc', 'Phạm Tuấn Anh', 'cha', '972236869', false),
  ('0ae0a1a0-739d-4abf-bf18-378fdc63a252', 'Nguyễn Thị Mai', 'me', '776130123', true),
  ('2616862c-b77a-4254-878b-4142fcdcd8c5', 'Trác Thị Thủy', 'me', '904953288', true),
  ('2616862c-b77a-4254-878b-4142fcdcd8c5', 'Nguyễn Văn Quân', 'cha', '903568286', false),
  ('1936dfd3-68c4-444d-b933-5c81b6f3098a', 'Lê Thị Mỹ', 'me', '886259590', true),
  ('56ddf725-babe-41d5-a17d-a7fada5a4f99', 'Nguyễn Thị Huyền Trang', 'me', '983723826', true),
  ('60ad64ef-c91f-4a01-9215-ecd51f24eada', 'Phan Thị Huyền Trang', 'me', '789896996', true);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('60ad64ef-c91f-4a01-9215-ecd51f24eada', 'Trần Đình Dinh', 'cha', '981696968', false),
  ('e587ed59-0fe9-42ac-99b2-c79e874941ae', 'Hồ Thị Khánh Linh', 'me', '337809888', true),
  ('e587ed59-0fe9-42ac-99b2-c79e874941ae', 'Trần Thế Anh', 'cha', '327887468', false),
  ('02284732-d3df-42ab-b73f-25994ca6fe47', 'Bùi Thị Nga', 'me', '399228553', true),
  ('02284732-d3df-42ab-b73f-25994ca6fe47', 'Mai Văn Sáng', 'cha', '986081357', false),
  ('54679363-e63c-498b-9f7c-287fb7c73f98', 'Lê Thị Diệu Thúy', 'me', '972220779', true),
  ('76a41f6e-9d38-4d73-89f2-8f782b38413b', 'Trương Thị Thảo (Mẹ Thóc Shi2)', 'me', '941331955', true),
  ('7a17303c-f9d9-45b6-aa87-a77595c6dd17', 'Nguyễn Thị Minh Giang', 'me', '975989306', true),
  ('7a17303c-f9d9-45b6-aa87-a77595c6dd17', 'Nguyễn Công Hiếu', 'cha', '969569555', false),
  ('0b7cc49a-7336-486e-bdb6-57b6ec8b5ef3', 'Đặng Thị Thanh Hải', 'me', '912485909', true),
  ('0b7cc49a-7336-486e-bdb6-57b6ec8b5ef3', 'Vương Khả Tuấn Anh', 'cha', '949614789', false),
  ('cf89ff4d-a253-42cf-8508-9b079a942e91', 'Phạm Thị Linh Nga', 'me', '911099169', true),
  ('cf89ff4d-a253-42cf-8508-9b079a942e91', 'Nguyễn Văn Chiên', 'cha', '919296667', false),
  ('17590c81-8ed3-43c9-9e64-30e47871b912', 'Nguyễn Thị Tuyết', 'me', '945319956', true),
  ('17590c81-8ed3-43c9-9e64-30e47871b912', 'Nguyễn Việt Đức', 'cha', '945319956', false),
  ('259121bb-8a89-4836-ae22-dccd2cccd3d2', 'Hồ Thị Hồng Trinh', 'me', '962904470', true),
  ('3e4c9dbe-429b-47f5-af8a-af39b51835bc', 'Hà Thị Hoa', 'me', '914839090', true),
  ('3e4c9dbe-429b-47f5-af8a-af39b51835bc', 'Trần Văn Hoàng', 'cha', '913036263', false),
  ('0c114e37-f098-4ccf-83c3-da8de1323de8', 'Hoàng Thị Thùy Linh', 'me', '911416268', true),
  ('0c114e37-f098-4ccf-83c3-da8de1323de8', 'Nguyễn Đình Hạnh', 'cha', '0000000000', false),
  ('61595b14-307c-485c-8d25-b9bee049bd50', 'Kiều Thị Thanh Huyền', 'me', '987954388', true),
  ('e14265cc-3c3e-4764-9164-698006e4636c', 'Trần Thị Lê Khuyên', 'me', '949246002', true),
  ('acbce55a-ac45-4a2c-bf48-26321204cd02', 'Trương Thị Dung', 'me', '335229779', true),
  ('acbce55a-ac45-4a2c-bf48-26321204cd02', 'Hoàng Văn Hà', 'cha', '372719638', false),
  ('dc8f0108-d6f1-4fb1-9975-08aa3f400638', 'Phạm Thị Tú', 'me', '974724985', true),
  ('80e093b6-feec-4d0a-99ee-acbd49fad052', 'Dương Thị Thảo', 'me', '326086697', true),
  ('4ee619a0-fb8a-4f1c-99b1-77937c5ee5aa', 'Nguyễn Thị Vân Anh', 'me', '918076695', true),
  ('4ee619a0-fb8a-4f1c-99b1-77937c5ee5aa', 'Nguyễn Tiến Hùng', 'cha', '915431456', false),
  ('85a7c0bd-152c-4f96-b212-195988e6e6d0', 'Phạm Thị Liên', 'me', '947143222', true),
  ('da2d9b5d-eefa-4ee4-b1a8-5e3a37a245a1', 'Nguyễn Thị Ngọc Huyền', 'me', '908516968', true),
  ('da2d9b5d-eefa-4ee4-b1a8-5e3a37a245a1', 'Nguyễn Văn Tân', 'cha', '912755891', false),
  ('74302844-dc84-4e12-897a-fc6e0988bc87', 'Phan Nguyễn Thương Hiền', 'me', '563083362', true),
  ('74302844-dc84-4e12-897a-fc6e0988bc87', 'Hoàng Vũ Tuấn Tú', 'cha', '974173656', false),
  ('43c030c7-355a-4f34-9b2b-b1e29e98b66e', 'Thân Thị Huyền', 'me', '963320318', true),
  ('43c030c7-355a-4f34-9b2b-b1e29e98b66e', 'Hồ Phúc Thành', 'cha', '0000000000', false),
  ('9c1c51c6-7d8b-4fa6-b4ca-dc44df660965', 'Lê Thị Thanh Nga', 'me', '971294286', true),
  ('9c1c51c6-7d8b-4fa6-b4ca-dc44df660965', 'Tô Đình Ái', 'cha', '917357997', false),
  ('cdb3c45f-9110-47c8-b374-fafa5cf8f19e', 'Nguyễn Thị Phương Thảo', 'me', '943848555', true),
  ('9b881f8c-3df9-434d-b8a4-97a3876b6cc6', 'Trần Huyền Ly', 'me', '911082229', true),
  ('9b881f8c-3df9-434d-b8a4-97a3876b6cc6', 'Lê Văn Tú', 'cha', '913391996', false),
  ('38b5ee59-02d4-4d6f-8ebb-a104ba946894', 'Nguyễn Thị Thùy Linh', 'me', '902230205', true),
  ('38b5ee59-02d4-4d6f-8ebb-a104ba946894', 'Nguyễn Trọng Phước', 'cha', '949566226', false),
  ('fb98e099-f9ff-4f9a-ac45-f6309e5bf3fd', 'Nguyễn Thị Mỹ Duyên', 'me', '919534981', true),
  ('2c1d01b2-229b-4a4d-89ab-4cad904f6cf5', 'Nguyễn Thị Thảo Hà', 'me', '911512626', true),
  ('2c1d01b2-229b-4a4d-89ab-4cad904f6cf5', 'Trương Duy Kỷ', 'cha', '917383662', false),
  ('762511e6-a559-472e-9b61-26b308c5d9e4', 'Nguyễn Thị Linh Hương', 'me', '949992196', true),
  ('c0e20cb1-ca4f-41c4-a2ad-e97950a73efb', 'Bùi Thị Hằng', 'me', '886629498', true),
  ('c0e20cb1-ca4f-41c4-a2ad-e97950a73efb', 'Trần Quốc Việt', 'cha', '916050195', false),
  ('90ab4f91-61ae-4280-85f6-b64c3778f09e', 'Mẹ Hiền', 'me', '941279538', true),
  ('581e8a53-18ec-45df-9582-d5b2b7357af9', 'Nguyễn Thị Hồng Nhung', 'me', '975127327', true),
  ('581e8a53-18ec-45df-9582-d5b2b7357af9', 'Hà Văn Danh', 'cha', '886684777', false),
  ('0323d773-c6e3-496c-bf21-d60e05a70aa3', 'Nguyễn Thị Diệu Huyền', 'me', '911095424', true),
  ('0323d773-c6e3-496c-bf21-d60e05a70aa3', 'Nguyễn Văn Hiếu', 'cha', '914367887', false),
  ('be08e12c-d090-4df7-8c27-695bb7d8aebb', 'Trần Thị Huyền Thương', 'me', '948992358', true),
  ('be08e12c-d090-4df7-8c27-695bb7d8aebb', 'Văn Hồng Quân', 'cha', '911419994', false),
  ('a80ab719-986a-4bbe-82fe-ddf0156f3319', 'Hồ Thị Ánh', 'me', '928968996', true),
  ('677f2ffb-3881-4326-a41b-b4b606dbd49c', 'Nguyễn Thị Hương Ly', 'me', '354652345', true),
  ('677f2ffb-3881-4326-a41b-b4b606dbd49c', 'Trần Hữu Dũng', 'cha', '977982342', false),
  ('33c15622-364f-4ee2-bd81-87419fc1637f', 'Nguyễn Mai Hiền Chi', 'me', '989858685', true),
  ('33c15622-364f-4ee2-bd81-87419fc1637f', 'Nguyễn Xuân Phương', 'cha', '911092029', false),
  ('a087b1fc-ef38-4436-908e-d457d33e8461', 'Nguyễn Thị Thanh Linh', 'me', '978821318', true),
  ('a087b1fc-ef38-4436-908e-d457d33e8461', 'Phạm Bảo Dân', 'cha', '941812777', false),
  ('6588956b-f0df-40f5-bc05-a7a63f21dc94', 'Nguyễn Thị Kim Yến', 'me', '817655678', true),
  ('6588956b-f0df-40f5-bc05-a7a63f21dc94', 'Dương Kim Hoan', 'cha', '963998986', false),
  ('9562ea7f-e985-46e8-afdb-cedbdfbb11ca', 'Phạm Thị Cẩm Hoài', 'me', '337392084', true),
  ('9562ea7f-e985-46e8-afdb-cedbdfbb11ca', 'Nguyễn Xuân Công', 'cha', '989642223', false),
  ('feee04cc-4fdc-4fec-8ca0-bf3dad2ffd7d', 'Phan Thị Lan Chi', 'me', '943855127', true),
  ('feee04cc-4fdc-4fec-8ca0-bf3dad2ffd7d', 'Trần Hồng Quân', 'cha', '947903819', false),
  ('61a89f80-19d0-4f21-acc1-8e21e472cc80', 'Nguyễn Thị Lợi', 'me', '905590067', true),
  ('61a89f80-19d0-4f21-acc1-8e21e472cc80', 'Nguyễn Minh Trường', 'cha', '918425168', false),
  ('d083afa2-4e3d-4935-a4ac-0e75e95871e5', 'Phạm Thị Thu Hằng', 'me', '941093337', true),
  ('d083afa2-4e3d-4935-a4ac-0e75e95871e5', 'Nguyễn Ngọc Linh', 'cha', '903282283', false),
  ('73f8d884-54f6-4b41-8edf-92a7c9b91fd3', 'Hoàng Thị Tú Anh', 'me', '378167454', true),
  ('73f8d884-54f6-4b41-8edf-92a7c9b91fd3', 'Nguyễn Viết Khánh', 'cha', '898641111', false),
  ('3e8d8090-9f01-42da-b474-380cc924ba51', 'Đinh Thị Ngọc Anh', 'me', '948576265', true),
  ('3e8d8090-9f01-42da-b474-380cc924ba51', 'Nguyễn Quang Chung', 'cha', '902214777', false),
  ('e580b365-7aeb-43cb-9458-11be33592c72', 'Nguyễn Thị Phương Thảo', 'me', '941755222', true),
  ('e580b365-7aeb-43cb-9458-11be33592c72', 'Võ Tá Bảo', 'cha', '912616222', false),
  ('a9b51d66-ae46-4d63-a994-bd402951a499', 'Trần Thị Kim Oanh', 'me', '941437128', true),
  ('179e1743-5743-41a8-8f86-3f38b24c0fc3', 'Đinh Thị Ngọc Hà', 'me', '915808387', true),
  ('179e1743-5743-41a8-8f86-3f38b24c0fc3', 'Nguyễn Văn Ngọc', 'cha', '987560968', false),
  ('a684528b-1210-408b-8161-35986c0fc809', 'Thừa Thị Nga', 'me', '916345607', true),
  ('a684528b-1210-408b-8161-35986c0fc809', 'Trần Vũ Trọng', 'cha', '944414567', false),
  ('d16beaef-544d-43db-a2f9-f33650dc9f14', 'Trần Hà Việt Phương', 'me', '915815588', true),
  ('d16beaef-544d-43db-a2f9-f33650dc9f14', 'Nguyễn Mai Xuân Hải', 'cha', '968970620', false),
  ('06b5fc7e-a7cc-47d2-8468-b6ffc9f05222', 'Nguyễn Minh Cẩm Nhung', 'me', '981093226', true),
  ('06b5fc7e-a7cc-47d2-8468-b6ffc9f05222', 'Lê Hoàng Đồng', 'cha', '913006663', false),
  ('2adc1787-5bbf-4ce5-833b-9fca5391149e', 'Ngọc Ánh', 'me', '832310777', true),
  ('857d6c0e-4451-4df4-abf9-07a6a4a7e243', 'Cao Thị Thanh Hương', 'me', '975698598', true),
  ('857d6c0e-4451-4df4-abf9-07a6a4a7e243', 'Nguyễn Văn Kiên', 'cha', '967821999', false),
  ('86706a5d-0297-4324-b703-84e16172b4e4', 'Hoàng Diệu Thùy', 'me', '916125570', true),
  ('86706a5d-0297-4324-b703-84e16172b4e4', 'Nguyễn Văn Viễn', 'cha', '941151567', false),
  ('98ac21ed-c642-4866-938f-9ca398c5c881', 'Phan Thị Cẩm Tú', 'me', '912769585', true),
  ('98ac21ed-c642-4866-938f-9ca398c5c881', 'Trương Quang Cường', 'cha', '948402666', false),
  ('17cf8288-ecd8-44da-a41c-435ac8d17390', 'Trương Thị Thanh Thanh', 'me', '915157186', true),
  ('17cf8288-ecd8-44da-a41c-435ac8d17390', 'Nguyễn Trọng Mạnh', 'cha', '368515157', false),
  ('4caa1e72-2559-4ca1-bbd3-463b4d61f04b', 'Lê Thị Khánh Linh', 'me', '917981993', true),
  ('4caa1e72-2559-4ca1-bbd3-463b4d61f04b', 'Trần Thái Hoàng', 'cha', '0000000000', false),
  ('9211ab86-59e3-46e1-8769-c201cf934bb9', 'Đặng Quỳnh Nga', 'me', '947662418', true),
  ('9211ab86-59e3-46e1-8769-c201cf934bb9', 'Lê Văn Công', 'cha', '914968558', false);

INSERT INTO guardians (student_id, full_name, relationship, phone, is_primary) VALUES
  ('60f5aa03-0c96-47a7-b702-52971c0b793f', 'Lê Thị Thanh Nga', 'me', '915477272', true),
  ('d67dcc17-0724-4eaf-a098-ff02e17dce70', 'Phan Thị Kim Cúc', 'me', '911411777', true),
  ('d67dcc17-0724-4eaf-a098-ff02e17dce70', 'Lê Đức Nghĩa', 'cha', '914764777', false),
  ('ed42a2e7-d6b0-4232-a70a-aa7a581566bc', 'Võ Thị Oanh', 'me', '975010687', true),
  ('df8cd0f2-62d5-4168-bf14-d6252c9196da', 'Nguyễn Thị Ánh', 'me', '947923067', true),
  ('df8cd0f2-62d5-4168-bf14-d6252c9196da', 'Trần Hữu Phong', 'cha', '836036999', false),
  ('9f3dad88-d4f3-4dae-a83d-19d520a7a1be', 'Nguyễn Thị Thúy', 'me', '911110884', true),
  ('9f3dad88-d4f3-4dae-a83d-19d520a7a1be', 'Mai Văn Tuấn', 'cha', '902244558', false),
  ('0a8eb4e9-00b3-41a6-8a67-cfea1aa07c88', 'Nguyễn Thị Duyên', 'me', '973077099', true),
  ('0a8eb4e9-00b3-41a6-8a67-cfea1aa07c88', 'Nguyễn Tiến Mạnh', 'cha', '945623789', false),
  ('8bca01a9-31a5-4c7b-aba0-530859a84b52', 'Trần Thị Vân', 'me', '977065981', true),
  ('8bca01a9-31a5-4c7b-aba0-530859a84b52', 'Phạm Văn Đức', 'cha', '977069681', false),
  ('2e9b91d8-b41b-4c01-94b4-1542cbedc1fb', 'Nguyễn Thị Cẩm Hà', 'me', '917052828', true),
  ('2e9b91d8-b41b-4c01-94b4-1542cbedc1fb', 'Trần Quốc Lợi', 'cha', '936130555', false),
  ('cc2df9a9-ae8c-4238-b764-8a5ec3abcebf', 'Nguyễn Thị Thúy An', 'me', '358498061', true),
  ('d205b634-aaa7-4b07-bcb4-4d604f84b5f5', 'O Nguyễn Thị Lan', 'me', '888829899', true),
  ('7c85ee2c-c646-4dc3-af83-a540a5e3a30d', 'Võ Thị Xuân Hoài', 'me', '977052712', true),
  ('33dbfe14-351b-4755-aa0f-296d501b58fa', 'Trần Thị Sông Hương', 'me', '917279969', true),
  ('33dbfe14-351b-4755-aa0f-296d501b58fa', 'Phan Đình Hải', 'cha', '0000000000', false),
  ('b336013a-bec2-48d2-9aaa-56bac90066ff', 'Trần Thị Thục Hoài', 'me', '941396596', true),
  ('b336013a-bec2-48d2-9aaa-56bac90066ff', 'Nguyễn Quý Anh', 'cha', '917346345', false),
  ('bc340e5b-f0fe-4155-a8c9-b20e35961f70', 'Cù Thanh Như', 'me', '967173689', true),
  ('459e4c83-c186-4a2a-a17e-b0cbc75268c5', 'Trương Thị Hằng', 'me', '938813686', true),
  ('459e4c83-c186-4a2a-a17e-b0cbc75268c5', 'Nguyễn Văn Khánh', 'cha', '919100887', false),
  ('5aec75f5-3301-4953-8a18-17a565a3f643', 'Nguyễn Thị Hải Đông', 'me', '911091165', true),
  ('5aec75f5-3301-4953-8a18-17a565a3f643', 'Võ Huy Hiếu', 'cha', '988947593', false),
  ('a4874ead-45e9-4ee1-aacc-817ff33f4c2c', 'Trần Thị Trà Vinh', 'me', '917699468', true),
  ('a4874ead-45e9-4ee1-aacc-817ff33f4c2c', 'Trần Xuân Biển', 'cha', '948010187', false),
  ('c80f59d1-1db1-49e1-b1af-99d352e14336', 'Phan Thị Hà Trang', 'me', '985643391', true),
  ('c80f59d1-1db1-49e1-b1af-99d352e14336', 'Trần Việt Anh', 'cha', '985811732', false),
  ('538cb572-8c7c-47f4-8e49-99c5851df871', 'Phạm Thị Sao', 'me', '968364636', true),
  ('538cb572-8c7c-47f4-8e49-99c5851df871', 'Phan Thế Anh', 'cha', '962202345', false),
  ('9354adc1-a600-4fc0-8f95-a17900635312', 'Bùi Thị Thương', 'me', '989848661', true),
  ('9354adc1-a600-4fc0-8f95-a17900635312', 'Huỳnh Ngọc Tuấn', 'cha', '877318686', false),
  ('bab1f6d0-bc07-4087-93d6-26c960c02e1e', 'Lê Thị Thùy Dung', 'me', '911785899', true),
  ('bab1f6d0-bc07-4087-93d6-26c960c02e1e', 'Trần Văn Quốc', 'cha', '972767386', false),
  ('098e7848-89e6-40c5-b061-c35c58f7e2d3', 'Phạm Thị Thanh Duyên', 'me', '977290655', true),
  ('098e7848-89e6-40c5-b061-c35c58f7e2d3', 'Nguyễn Xuân Thành', 'cha', '971116499', false),
  ('261caa3b-b497-4a76-9761-f3b33efcd898', 'Nguyễn Khánh Hòa', 'me', '943413891', true),
  ('261caa3b-b497-4a76-9761-f3b33efcd898', 'Nguyễn Xuân Nhật', 'cha', '948969575', false),
  ('2838cdb8-02c2-443d-b69e-06554a644a3f', 'Nguyễn Thị Thu Huyền', 'me', '382995773', true),
  ('2838cdb8-02c2-443d-b69e-06554a644a3f', 'Nguyễn Hữu Chung', 'cha', '987729611', false),
  ('c0456fa8-36c7-4729-b817-61b9c451848c', 'Nguyễn Thị Kim Vui', 'me', '915007776', true),
  ('c0456fa8-36c7-4729-b817-61b9c451848c', 'Nguyễn Văn Hoài', 'cha', '915001776', false);



-- ============================================================================
-- PART 3: DEFAULT ADMIN USER
-- ============================================================================

-- ============================================================================
-- Doraemon Kindergarten Management System – Admin Seed
-- Migration: 003_admin_user.sql
-- Created:   2026-05-27
--
-- Tạo tài khoản Admin mặc định cho hệ thống:
-- Email:    admin@doraemon.edu.vn
-- Mật khẩu: 123456
-- ============================================================================

-- 1. Thêm tài khoản vào auth.users (schema hệ thống của Supabase)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', -- ID cố định cho tài khoản admin
  'authenticated',
  'authenticated',
  'admin@doraemon.edu.vn',
  extensions.crypt('123456', extensions.gen_salt('bf')), -- Mật khẩu '123456' được hash
  NOW(),
  NULL,
  NULL,
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Quản trị viên"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- 2. Thêm thông tin hồ sơ vào public.users
INSERT INTO public.users (
  id,
  school_id,
  email,
  full_name,
  role,
  phone,
  avatar_url,
  is_active
) VALUES (
  'a0000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001', -- Link tới trường Doraemon đã có trong seed 001
  'admin@doraemon.edu.vn',
  'Quản trị viên Doraemon',
  'admin',
  NULL,
  NULL,
  TRUE
) ON CONFLICT (id) DO NOTHING;
