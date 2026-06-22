-- Migration 007: Add Zalo OA configuration fields to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS zalo_oa_id text,
ADD COLUMN IF NOT EXISTS zalo_access_token text,
ADD COLUMN IF NOT EXISTS zalo_refresh_token text,
ADD COLUMN IF NOT EXISTS zalo_template_fee text,
ADD COLUMN IF NOT EXISTS zalo_template_attendance text;
