-- Migration: 004_add_job_title_to_users.sql
-- Add job_title column to users table for data-driven role display

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title TEXT;
