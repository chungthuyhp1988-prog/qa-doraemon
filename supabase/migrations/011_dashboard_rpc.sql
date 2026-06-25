-- ============================================================================
-- Migration: 011_dashboard_rpc.sql
-- Purpose: Server-side RPC for dashboard statistics
--
-- Replaces client-side aggregation of 1000–5000 rows with a single
-- function call that returns all dashboard data as JSON.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.dashboard_stats(p_date DATE DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
  v_month INT := EXTRACT(MONTH FROM p_date);
  v_year INT := EXTRACT(YEAR FROM p_date);
  v_today TEXT := to_char(p_date, 'YYYY-MM-DD');
  v_week_start DATE := date_trunc('week', p_date)::DATE; -- Monday
  v_week_end DATE := v_week_start + 4; -- Friday
  v_today_md TEXT := to_char(p_date, 'MM-DD');
BEGIN
  SELECT json_build_object(
    -- 1. Total active students
    'total_students', (
      SELECT COUNT(*) FROM students WHERE status = 'active'
    ),

    -- 2. Today's attendance summary
    'today_present', (
      SELECT COUNT(*) FROM attendance
      WHERE date = p_date AND status IN ('present', 'late')
    ),
    'today_absent', (
      SELECT COUNT(*) FROM attendance
      WHERE date = p_date AND status IN ('absent', 'sick', 'excused')
    ),
    'today_total_marked', (
      SELECT COUNT(*) FROM attendance WHERE date = p_date
    ),

    -- 3. Monthly tuition summary
    'month_expected', (
      SELECT COALESCE(SUM(total_amount), 0) FROM tuition_fees
      WHERE month = v_month AND year = v_year
    ),
    'month_paid', (
      SELECT COALESCE(SUM(paid_amount), 0) FROM tuition_fees
      WHERE month = v_month AND year = v_year
    ),

    -- 4. Overdue fees (top 5)
    'overdue_fees', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          tf.id,
          tf.total_amount,
          tf.paid_amount,
          tf.month,
          s.full_name AS student_name,
          c.name AS class_name
        FROM tuition_fees tf
        JOIN students s ON s.id = tf.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE tf.status = 'overdue'
        ORDER BY tf.due_date ASC
        LIMIT 5
      ) t
    ),

    -- 5. Weekly attendance (Mon-Fri) as array of {date, present, total}
    'weekly_attendance', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.att_date), '[]'::json)
      FROM (
        SELECT
          a.date AS att_date,
          COUNT(*) FILTER (WHERE a.status IN ('present', 'late')) AS present_count,
          COUNT(*) AS total_count
        FROM attendance a
        WHERE a.date BETWEEN v_week_start AND v_week_end
        GROUP BY a.date
      ) t
    ),

    -- 6. Birthday students today
    'birthday_students', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          s.id,
          s.full_name,
          s.date_of_birth,
          c.name AS class_name
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.status = 'active'
          AND to_char(s.date_of_birth, 'MM-DD') = v_today_md
      ) t
    ),

    -- 7. Medical alerts (students with medical_notes)
    'medical_alerts', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          s.id,
          s.full_name,
          s.medical_notes,
          c.name AS class_name
        FROM students s
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.status = 'active'
          AND s.medical_notes IS NOT NULL
          AND s.medical_notes <> ''
        LIMIT 20
      ) t
    ),

    -- 8. Unmarked classes today
    'unmarked_classes', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT c.id, c.name
        FROM classes c
        WHERE c.is_active = TRUE
          AND c.id NOT IN (
            SELECT DISTINCT a.class_id FROM attendance a WHERE a.date = p_date
          )
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.dashboard_stats(DATE) TO authenticated;
