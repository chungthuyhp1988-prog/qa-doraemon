-- ============================================================================
-- Migration: 010_staff_rls_policies.sql
-- Purpose: Add RLS policies for the 'staff' role
--
-- Staff members can READ most operational data (students, classes, attendance,
-- health, nutrition, notifications) but cannot WRITE to sensitive tables
-- (tuition_fees, users). Write access is limited to tables they actively
-- contribute to (attendance notes, health records, meal plans, notifications).
-- ============================================================================

-- ── Helper: check if user is staff ──
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'staff'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ────────────────────────────────────
-- students: staff can read all active students
-- ────────────────────────────────────
CREATE POLICY "students_select_staff"
  ON students FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- ────────────────────────────────────
-- guardians: staff can read guardians
-- ────────────────────────────────────
CREATE POLICY "guardians_select_staff"
  ON guardians FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- ────────────────────────────────────
-- attendance: staff can read all attendance
-- ────────────────────────────────────
CREATE POLICY "attendance_select_staff"
  ON attendance FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- ────────────────────────────────────
-- health_records: staff can read and create
-- ────────────────────────────────────
CREATE POLICY "health_records_select_staff"
  ON health_records FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "health_records_insert_staff"
  ON health_records FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

-- ────────────────────────────────────
-- tuition_fees: staff can read only (no write)
-- ────────────────────────────────────
CREATE POLICY "tuition_fees_select_staff"
  ON tuition_fees FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- ────────────────────────────────────
-- meal_plans: staff can read and create
-- ────────────────────────────────────
CREATE POLICY "meal_plans_insert_staff"
  ON meal_plans FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

-- ────────────────────────────────────
-- notifications: staff can read broadcast notifications
-- (class/individual notifications already handled by existing policies)
-- ────────────────────────────────────
-- Already covered by "notifications_select_broadcast" policy (target='all')
-- No additional policy needed for staff notification reads.

-- ============================================================================
-- Done!
-- ============================================================================
