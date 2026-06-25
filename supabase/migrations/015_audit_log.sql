-- ============================================================================
-- Migration: 015_audit_log.sql
-- Purpose: Audit log table + trigger to track admin/user actions
-- ============================================================================

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  table_name  TEXT NOT NULL,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "audit_log_insert_authenticated"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ── Generic audit trigger function ──

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ── Attach audit triggers to key tables ──

CREATE TRIGGER trg_audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_tuition_fees
  AFTER INSERT OR UPDATE OR DELETE ON tuition_fees
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_classes
  AFTER INSERT OR UPDATE OR DELETE ON classes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON attendance
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- ── RPC to query audit log with pagination ──

CREATE OR REPLACE FUNCTION public.get_audit_log(
  p_table_name TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
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
    RAISE EXCEPTION 'Only admins can view audit logs';
  END IF;

  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          al.id,
          al.action,
          al.table_name,
          al.record_id,
          al.old_data,
          al.new_data,
          al.created_at,
          u.full_name AS user_name,
          u.email AS user_email
        FROM audit_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE (p_table_name IS NULL OR al.table_name = p_table_name)
          AND (p_user_id IS NULL OR al.user_id = p_user_id)
        ORDER BY al.created_at DESC
        LIMIT p_limit OFFSET p_offset
      ) t
    ), '[]'::json),
    'total', (
      SELECT COUNT(*)
      FROM audit_log al
      WHERE (p_table_name IS NULL OR al.table_name = p_table_name)
        AND (p_user_id IS NULL OR al.user_id = p_user_id)
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_log(TEXT, UUID, INT, INT) TO authenticated;
