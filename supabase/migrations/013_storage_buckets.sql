-- ============================================================================
-- Migration: 013_storage_buckets.sql
-- Purpose: Create storage buckets for file uploads (avatars, student photos)
-- ============================================================================

-- ── 1. Create buckets ──

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('student-photos', 'student-photos', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO NOTHING;

-- ── 2. RLS policies for avatars bucket ──

CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

-- ── 3. RLS policies for student-photos bucket ──

CREATE POLICY "student_photos_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'student-photos');

CREATE POLICY "student_photos_insert_admin_teacher"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND public.get_user_role() IN ('admin', 'teacher')
  );

CREATE POLICY "student_photos_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND public.is_admin()
  );

-- ── 4. RLS policies for documents bucket (private) ──

CREATE POLICY "documents_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_insert_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_admin()
  );

CREATE POLICY "documents_delete_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_admin()
  );
