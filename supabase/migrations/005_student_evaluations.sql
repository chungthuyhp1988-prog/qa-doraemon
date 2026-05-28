-- ============================================================================
-- Doraemon Kindergarten Management System – Evaluations Schema
-- Migration: 005_student_evaluations.sql
-- Created:   2026-05-28
--
-- Bảng đánh giá năng lực phát triển định kỳ của học sinh theo 5 khía cạnh.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_evaluations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  evaluator_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  evaluation_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  period           TEXT NOT NULL, -- e.g. 'Tháng 10', 'Học kỳ I', 'Học kỳ II'
  
  -- 5 lĩnh vực phát triển của trẻ (Thang điểm 1-5)
  physical_score   INT CHECK (physical_score BETWEEN 1 AND 5),
  physical_note    TEXT,
  cognitive_score  INT CHECK (cognitive_score BETWEEN 1 AND 5),
  cognitive_note   TEXT,
  language_score   INT CHECK (language_score BETWEEN 1 AND 5),
  language_note    TEXT,
  social_score     INT CHECK (social_score BETWEEN 1 AND 5),
  social_note      TEXT,
  aesthetic_score  INT CHECK (aesthetic_score BETWEEN 1 AND 5),
  aesthetic_note   TEXT,
  
  overall_comment  TEXT,
  recommendation   TEXT,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bật Row Level Security (RLS)
ALTER TABLE public.student_evaluations ENABLE ROW LEVEL SECURITY;

-- Tạo RLS Policies
DROP POLICY IF EXISTS "evaluations_select_authenticated" ON public.student_evaluations;
CREATE POLICY "evaluations_select_authenticated"
  ON public.student_evaluations FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "evaluations_insert_teacher" ON public.student_evaluations;
CREATE POLICY "evaluations_insert_teacher"
  ON public.student_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'teacher'));

DROP POLICY IF EXISTS "evaluations_update_teacher" ON public.student_evaluations;
CREATE POLICY "evaluations_update_teacher"
  ON public.student_evaluations FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid() OR public.is_admin());
