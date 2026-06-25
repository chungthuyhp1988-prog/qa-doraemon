-- ============================================================================
-- Migration: 012_auto_overdue_trigger.sql
-- Purpose: Automatically mark tuition fees as 'overdue' when past due_date
--
-- Two mechanisms:
--   1. A callable function mark_overdue_fees() for manual/cron invocation
--   2. A trigger on tuition_fees that checks on any UPDATE (e.g. when
--      the dashboard or finance page queries and touches the row)
-- ============================================================================

-- ── 1. Batch update function ──
-- Call via: SELECT public.mark_overdue_fees();
-- Or schedule with pg_cron: SELECT cron.schedule('mark-overdue', '0 7 * * *', $$SELECT public.mark_overdue_fees()$$);

CREATE OR REPLACE FUNCTION public.mark_overdue_fees()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE tuition_fees
  SET status = 'overdue',
      updated_at = NOW()
  WHERE due_date < CURRENT_DATE
    AND status IN ('pending', 'partial')
    AND paid_amount < total_amount;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_overdue_fees() TO authenticated;

-- ── 2. Trigger: auto-check on INSERT/UPDATE ──
-- When a fee row is inserted or updated, check if it should be overdue.

CREATE OR REPLACE FUNCTION public.check_fee_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.due_date < CURRENT_DATE
     AND NEW.status IN ('pending', 'partial')
     AND NEW.paid_amount < NEW.total_amount
  THEN
    NEW.status := 'overdue';
  END IF;

  -- Also auto-set 'paid' if paid_amount >= total_amount
  IF NEW.paid_amount >= NEW.total_amount AND NEW.status <> 'paid' THEN
    NEW.status := 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date := CURRENT_DATE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tuition_fees_check_overdue
  BEFORE INSERT OR UPDATE ON tuition_fees
  FOR EACH ROW EXECUTE FUNCTION public.check_fee_overdue();

-- ── 3. pg_cron schedule (requires pg_cron extension) ──
-- Uncomment the lines below if pg_cron is enabled on your Supabase project:
--
-- SELECT cron.schedule(
--   'mark-overdue-fees-daily',
--   '0 7 * * *',  -- Every day at 7:00 AM UTC
--   $$SELECT public.mark_overdue_fees()$$
-- );
