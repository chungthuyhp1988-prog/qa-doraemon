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
