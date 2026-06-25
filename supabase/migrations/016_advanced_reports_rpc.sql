-- ============================================================================
-- Migration: 016_advanced_reports_rpc.sql
-- Purpose: RPC functions for advanced reporting (by class, grade, academic year)
-- ============================================================================

-- ── Attendance report by class/month ──

CREATE OR REPLACE FUNCTION public.report_attendance(
  p_academic_year_id UUID,
  p_month INT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate reports';
  END IF;

  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT
      c.id AS class_id,
      c.name AS class_name,
      c.grade_level,
      COUNT(DISTINCT a.student_id) AS total_students,
      COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
      COUNT(*) FILTER (WHERE a.status = 'absent_excused') AS excused_count,
      COUNT(*) FILTER (WHERE a.status = 'absent_unexcused') AS unexcused_count,
      COUNT(*) AS total_records,
      ROUND(
        COUNT(*) FILTER (WHERE a.status = 'present')::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      ) AS attendance_rate
    FROM attendance a
    JOIN students s ON s.id = a.student_id
    JOIN class_students cs ON cs.student_id = s.id
    JOIN classes c ON c.id = cs.class_id
    WHERE c.academic_year_id = p_academic_year_id
      AND (p_month IS NULL OR EXTRACT(MONTH FROM a.date) = p_month)
      AND (p_class_id IS NULL OR c.id = p_class_id)
    GROUP BY c.id, c.name, c.grade_level
    ORDER BY c.grade_level, c.name
  ) t INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── Finance report by class/month ──

CREATE OR REPLACE FUNCTION public.report_finance(
  p_academic_year_id UUID,
  p_month INT DEFAULT NULL,
  p_class_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate reports';
  END IF;

  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT
      c.id AS class_id,
      c.name AS class_name,
      c.grade_level,
      COUNT(DISTINCT tf.student_id) AS total_students,
      SUM(tf.total_amount) AS total_expected,
      SUM(tf.paid_amount) AS total_paid,
      SUM(tf.total_amount) - SUM(tf.paid_amount) AS total_remaining,
      COUNT(*) FILTER (WHERE tf.status = 'paid') AS paid_count,
      COUNT(*) FILTER (WHERE tf.status = 'unpaid') AS unpaid_count,
      COUNT(*) FILTER (WHERE tf.status = 'overdue') AS overdue_count,
      COUNT(*) FILTER (WHERE tf.status = 'partial') AS partial_count,
      ROUND(
        SUM(tf.paid_amount)::NUMERIC /
        NULLIF(SUM(tf.total_amount), 0) * 100, 1
      ) AS collection_rate
    FROM tuition_fees tf
    JOIN students s ON s.id = tf.student_id
    JOIN class_students cs ON cs.student_id = s.id
    JOIN classes c ON c.id = cs.class_id
    WHERE c.academic_year_id = p_academic_year_id
      AND (p_month IS NULL OR tf.month = p_month)
      AND (p_class_id IS NULL OR c.id = p_class_id)
    GROUP BY c.id, c.name, c.grade_level
    ORDER BY c.grade_level, c.name
  ) t INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── Student summary report ──

CREATE OR REPLACE FUNCTION public.report_students_summary(
  p_academic_year_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate reports';
  END IF;

  SELECT json_build_object(
    'by_grade', (
      SELECT json_agg(row_to_json(g))
      FROM (
        SELECT
          c.grade_level,
          COUNT(DISTINCT cs.student_id) AS total,
          COUNT(DISTINCT cs.student_id) FILTER (WHERE s.status = 'active') AS active,
          COUNT(DISTINCT cs.student_id) FILTER (WHERE s.gender = 'male') AS male,
          COUNT(DISTINCT cs.student_id) FILTER (WHERE s.gender = 'female') AS female
        FROM classes c
        JOIN class_students cs ON cs.class_id = c.id
        JOIN students s ON s.id = cs.student_id
        WHERE c.academic_year_id = p_academic_year_id
        GROUP BY c.grade_level
        ORDER BY c.grade_level
      ) g
    ),
    'by_class', (
      SELECT json_agg(row_to_json(cl))
      FROM (
        SELECT
          c.id AS class_id,
          c.name AS class_name,
          c.grade_level,
          u.full_name AS teacher_name,
          COUNT(DISTINCT cs.student_id) AS total,
          COUNT(DISTINCT cs.student_id) FILTER (WHERE s.status = 'active') AS active
        FROM classes c
        LEFT JOIN users u ON u.id = c.teacher_id
        LEFT JOIN class_students cs ON cs.class_id = c.id
        LEFT JOIN students s ON s.id = cs.student_id
        WHERE c.academic_year_id = p_academic_year_id
        GROUP BY c.id, c.name, c.grade_level, u.full_name
        ORDER BY c.grade_level, c.name
      ) cl
    ),
    'total_active', (
      SELECT COUNT(DISTINCT cs.student_id)
      FROM classes c
      JOIN class_students cs ON cs.class_id = c.id
      JOIN students s ON s.id = cs.student_id
      WHERE c.academic_year_id = p_academic_year_id AND s.status = 'active'
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_attendance(UUID, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_finance(UUID, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_students_summary(UUID) TO authenticated;
