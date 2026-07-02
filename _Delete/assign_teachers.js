import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve('./.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const filePath = './DSGVNV DORAEMON.xlsx';

async function run() {
  console.log("--- BẮT ĐẦU PHÂN CÔNG GIÁO VIÊN CHỦ NHIỆM ---");

  // 1. Lấy danh sách lớp học của năm học hiện tại (2026-2027)
  // ID năm học 2026-2027 là ca90d0c6-2ca1-4914-931d-5dc6fa761124
  const academicYearId = 'ca90d0c6-2ca1-4914-931d-5dc6fa761124';
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select('id, name')
    .eq('academic_year_id', academicYearId);

  if (classesError) {
    console.error("Lỗi lấy danh sách lớp:", classesError.message);
    return;
  }

  // Tạo map từ tên lớp (viết thường, không khoảng trắng) -> class_id
  const classMap = new Map();
  classes.forEach(c => {
    const cleanName = c.name.toLowerCase().replace(/\s+/g, '');
    classMap.set(cleanName, c.id);
    // Hỗ trợ cả trường hợp viết tắt hoặc thêm bớt chữ
    // Ví dụ: "Dorami 1" -> "dorami1"
  });
  console.log(`Đã tải ${classes.length} lớp học từ database.`);

  // 2. Lấy danh sách giáo viên hiện tại từ database
  const { data: teachers, error: teachersError } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'teacher');

  if (teachersError) {
    console.error("Lỗi lấy danh sách giáo viên:", teachersError.message);
    return;
  }

  // Tạo map từ email và họ tên -> teacher_id
  const teacherEmailMap = new Map();
  const teacherNameMap = new Map();
  teachers.forEach(t => {
    if (t.email) teacherEmailMap.set(t.email.toLowerCase().trim(), t.id);
    if (t.full_name) {
      const cleanName = t.full_name.toLowerCase().trim();
      teacherNameMap.set(cleanName, t.id);
    }
  });
  console.log(`Đã tải ${teachers.length} giáo viên từ database.`);

  // 3. Đọc file Excel giáo viên
  console.log(`Đọc file Excel: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);

  // 4. Duyệt qua từng dòng và thực hiện phân công
  const assignments = [];
  let matchedCount = 0;

  for (const row of rows) {
    const fullName = row['Họ tên'];
    const email = row['Email'];
    const className = row['Lớp'];

    if (!fullName || !className) continue;

    const cleanClassName = String(className).toLowerCase().replace(/\s+/g, '');
    const classId = classMap.get(cleanClassName);

    if (!classId) {
      console.log(`[Cảnh báo] Không tìm thấy lớp "${className}" trong hệ thống cho GV ${fullName}`);
      continue;
    }

    // Tìm ID giáo viên bằng email hoặc họ tên
    let teacherId = null;
    if (email) {
      teacherId = teacherEmailMap.get(email.toLowerCase().trim());
    }
    if (!teacherId) {
      teacherId = teacherNameMap.get(fullName.toLowerCase().trim());
    }

    if (!teacherId) {
      console.log(`[Cảnh báo] Không tìm thấy giáo viên "${fullName}" trong bảng users`);
      continue;
    }

    assignments.push({
      class_id: classId,
      teacher_id: teacherId,
      is_homeroom: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    matchedCount++;
    console.log(`Đã khớp: Giáo viên "${fullName}" -> Lớp "${className}"`);
  }

  console.log(`Tổng số phân công tìm thấy: ${matchedCount}/${rows.length}`);

  if (assignments.length === 0) {
    console.log("Không có phân công nào được thực hiện.");
    return;
  }

  // 5. Xóa các phân công cũ (nếu có) để tránh trùng lặp
  const { error: deleteError } = await supabase
    .from('class_teachers')
    .delete()
    .in('class_id', classes.map(c => c.id));

  if (deleteError) {
    console.error("Lỗi xóa phân công cũ:", deleteError.message);
    return;
  }

  // 6. Ghi phân công mới vào bảng class_teachers
  const { error: insertError } = await supabase
    .from('class_teachers')
    .insert(assignments);

  if (insertError) {
    console.error("Lỗi ghi phân công mới:", insertError.message);
  } else {
    console.log("--- PHÂN CÔNG GIÁO VIÊN CHỦ NHIỆM THÀNH CÔNG! ---");
  }
}

run().catch(console.error);
