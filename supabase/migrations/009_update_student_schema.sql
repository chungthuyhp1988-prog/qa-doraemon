-- 1. Thêm giá trị mới vào ENUM student_status
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'registered';
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'waiting';

-- 2. Thêm cột citizen_id vào bảng guardians
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS citizen_id text;

-- 3. Thêm các cột phục vụ danh sách chờ và đăng ký tương lai vào bảng students
ALTER TABLE students ADD COLUMN IF NOT EXISTS priority_status text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_date timestamp with time zone;
ALTER TABLE students ADD COLUMN IF NOT EXISTS target_school_year text;
