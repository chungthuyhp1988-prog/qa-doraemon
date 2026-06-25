-- Add work_status column to users table
ALTER TABLE users ADD COLUMN work_status text DEFAULT 'active';

-- Add check constraint to ensure only valid statuses are inserted/updated
ALTER TABLE users ADD CONSTRAINT users_work_status_check CHECK (work_status IN ('active', 'maternity_leave', 'inactive', 'on_leave'));

-- Sync initial work_status from is_active
UPDATE users SET work_status = 'inactive' WHERE is_active = false;
UPDATE users SET work_status = 'active' WHERE is_active = true;
