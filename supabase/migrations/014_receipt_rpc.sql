-- ============================================================================
-- Migration: 014_receipt_rpc.sql
-- Purpose: RPC to generate structured receipt data for tuition fee payments
--
-- Returns all fields needed to render/export a receipt (biên lai thu học phí).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_receipt(p_fee_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'receipt_number', 'BL-' || to_char(tf.paid_date, 'YYYYMMDD') || '-' || LEFT(tf.id::TEXT, 8),
    'fee_id', tf.id,
    'paid_date', tf.paid_date,
    'month', tf.month,
    'year', tf.year,
    'due_date', tf.due_date,
    'status', tf.status,

    -- Amounts
    'base_amount', tf.base_amount,
    'meal_amount', tf.meal_amount,
    'extra_amount', tf.extra_amount,
    'discount', tf.discount,
    'total_amount', tf.total_amount,
    'paid_amount', tf.paid_amount,
    'remaining', tf.total_amount - tf.paid_amount,
    'note', tf.note,

    -- Student info
    'student', json_build_object(
      'id', s.id,
      'full_name', s.full_name,
      'student_code', s.student_code,
      'date_of_birth', s.date_of_birth,
      'class_name', c.name,
      'grade_level', c.grade_level
    ),

    -- Guardian info (primary)
    'guardian', (
      SELECT json_build_object(
        'full_name', g.full_name,
        'relationship', g.relationship,
        'phone', g.phone
      )
      FROM guardians g
      WHERE g.student_id = s.id
      ORDER BY g.is_primary DESC
      LIMIT 1
    ),

    -- School info
    'school', json_build_object(
      'name', sc.name,
      'address', sc.address,
      'phone', sc.phone,
      'email', sc.email,
      'principal_name', sc.principal_name
    ),

    -- Created by
    'created_by', json_build_object(
      'full_name', u.full_name,
      'email', u.email
    )
  ) INTO result
  FROM tuition_fees tf
  JOIN students s ON s.id = tf.student_id
  LEFT JOIN classes c ON c.id = s.class_id
  JOIN academic_years ay ON ay.id = tf.academic_year_id
  JOIN schools sc ON sc.id = ay.school_id
  LEFT JOIN users u ON u.id = tf.created_by
  WHERE tf.id = p_fee_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Tuition fee record not found: %', p_fee_id;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_receipt(UUID) TO authenticated;

-- ── Finance aggregate RPC ──
-- Returns monthly aggregates for the finance chart without pulling 5000 rows.

CREATE OR REPLACE FUNCTION public.finance_monthly_summary(p_academic_year_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.month), '[]'::json) INTO result
  FROM (
    SELECT
      tf.month,
      SUM(tf.total_amount) AS expected,
      SUM(tf.paid_amount) AS paid,
      COUNT(*) AS total_fees,
      COUNT(*) FILTER (WHERE tf.status = 'paid') AS paid_count,
      COUNT(*) FILTER (WHERE tf.status = 'overdue') AS overdue_count
    FROM tuition_fees tf
    WHERE tf.academic_year_id = p_academic_year_id
    GROUP BY tf.month
  ) t;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_monthly_summary(UUID) TO authenticated;
