import * as XLSX from 'xlsx';

/**
 * Xuất dữ liệu JSON ra file Excel (.xlsx)
 * @param data Mảng đối tượng JSON cần xuất
 * @param columns Cấu hình các cột (key trong JSON và label hiển thị trên Excel)
 * @param fileName Tên file xuất ra (không cần đuôi .xlsx)
 * @param sheetName Tên sheet trong Excel
 */
export function exportToExcel(
  data: any[],
  columns: { key: string; label: string }[],
  fileName: string,
  sheetName: string = 'Sheet1'
) {
  // Chuyển đổi dữ liệu JSON thành định dạng phẳng với header là các label tiếng Việt
  const formattedData = data.map((row) => {
    const formattedRow: Record<string, any> = {};
    columns.forEach((col) => {
      let value = row[col.key];
      // Xử lý hiển thị đặc biệt cho boolean hoặc ngày tháng
      if (typeof value === 'boolean') {
        value = value ? 'Có/Hoạt động' : 'Không/Tạm nghỉ';
      }
      formattedRow[col.label] = value ?? '';
    });
    return formattedRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  // Tạo file và tải về
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Đọc file Excel từ File object và parse thành JSON
 * @param file File tải lên từ input
 * @returns Promise chứa mảng đối tượng JSON
 */
export function readExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse sheet thành JSON (dạng mảng các object với key là header dòng đầu tiên)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
}

/**
 * Tải xuống tệp Excel mẫu dựa trên phân loại
 * @param type 'students' | 'teachers' | 'registrations'
 */
export function downloadExcelTemplate(type: 'students' | 'teachers' | 'registrations') {
  let headers: string[] = [];
  let sampleRows: any[] = [];
  let fileName = '';

  if (type === 'students') {
    headers = [
      'Mã học sinh', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Địa chỉ', 
      'Ngày nhập học', 'Lớp', 'Họ tên bố', 'SĐT bố', 'Họ tên mẹ', 'SĐT mẹ'
    ];
    sampleRows = [
      {
        'Mã học sinh': 'HS0001',
        'Họ tên': 'Nguyễn Văn An',
        'Ngày sinh': '15/05/2021',
        'Giới tính': 'Nam',
        'Địa chỉ': 'Phường Trần Phú, TP Hà Tĩnh',
        'Ngày nhập học': '01/09/2024',
        'Lớp': 'Doraemon 1',
        'Họ tên bố': 'Nguyễn Văn Bình',
        'SĐT bố': '0912345678',
        'Họ tên mẹ': 'Trần Thị Mai',
        'SĐT mẹ': '0987654321'
      }
    ];
    fileName = 'Mau_Danh_Sach_Hoc_Sinh';
  } else if (type === 'teachers') {
    headers = [
      'Họ tên', 'Email', 'Số điện thoại', 'Vai trò', 'Chức vụ', 
      'Ngày sinh', 'Địa chỉ', 'Trạng thái hoạt động'
    ];
    sampleRows = [
      {
        'Họ tên': 'Trần Thị Thuỷ',
        'Email': 'thuy.tran@doraemon.edu.vn',
        'Số điện thoại': '0912223334',
        'Vai trò': 'teacher', // admin, teacher, staff
        'Chức vụ': 'Giáo viên chủ nhiệm',
        'Ngày sinh': '20/10/1995',
        'Địa chỉ': 'Thạch Trung, TP Hà Tĩnh',
        'Trạng thái hoạt động': 'Hoạt động'
      },
      {
        'Họ tên': 'Phạm Văn Nam',
        'Email': 'nam.pham@doraemon.edu.vn',
        'Số điện thoại': '0988777666',
        'Vai trò': 'staff',
        'Chức vụ': 'Bảo vệ',
        'Ngày sinh': '05/12/1988',
        'Địa chỉ': 'Bắc Hà, TP Hà Tĩnh',
        'Trạng thái hoạt động': 'Hoạt động'
      }
    ];
    fileName = 'Mau_Danh_Sach_Giao_Vien';
  } else if (type === 'registrations') {
    headers = [
      'Họ tên', 'Ngày sinh', 'Giới tính', 'Địa chỉ', 'Ngày đăng ký',
      'Họ tên bố', 'SĐT bố', 'Họ tên mẹ', 'SĐT mẹ'
    ];
    sampleRows = [
      {
        'Họ tên': 'Lê Minh Khôi',
        'Ngày sinh': '10/08/2022',
        'Giới tính': 'Nam',
        'Địa chỉ': 'Xã Thạch Hạ, TP Hà Tĩnh',
        'Ngày đăng ký': '22/06/2026',
        'Họ tên bố': 'Lê Minh Tuấn',
        'SĐT bố': '0933444555',
        'Họ tên mẹ': 'Nguyễn Thuỳ Lâm',
        'SĐT mẹ': '0977888999'
      }
    ];
    fileName = 'Mau_Dang_Ky_Tuyen_Sinh';
  }

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  
  // Định dạng độ rộng cột tự động
  const colWidths = headers.map(h => ({ wch: Math.max(h.length + 4, 15) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Chuẩn hóa chuỗi ngày tháng từ Excel/CSV thành chuỗi YYYY-MM-DD
 */
export function parseExcelDate(dateVal: any): string {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  
  // Nếu là đối tượng Date (SheetJS đọc ra)
  if (dateVal instanceof Date) {
    // Tránh lệch múi giờ khi chuyển sang ISO String
    const userTimezoneOffset = dateVal.getTimezoneOffset() * 60000;
    const localDate = new Date(dateVal.getTime() - userTimezoneOffset);
    return localDate.toISOString().split('T')[0];
  }

  // Nếu là string dạng DD/MM/YYYY hoặc YYYY-MM-DD
  if (typeof dateVal === 'string') {
    const str = dateVal.trim();
    
    // Khớp DD/MM/YYYY
    const dmyPattern = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
    const dmyMatch = str.match(dmyPattern);
    if (dmyMatch) {
      const [_, day, month, year] = dmyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Khớp YYYY-MM-DD
    const ymdPattern = /^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/;
    const ymdMatch = str.match(ymdPattern);
    if (ymdMatch) {
      const [_, year, month, day] = ymdMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // Trường hợp Excel lưu dạng số (serial number)
  if (typeof dateVal === 'number') {
    const date = XLSX.SSF.parse_date_code(dateVal);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Chuẩn hóa giới tính từ tiếng Việt sang enum Supabase ('male' | 'female')
 */
export function parseGender(genderStr: any): 'male' | 'female' {
  if (!genderStr) return 'male';
  const val = String(genderStr).toLowerCase().trim();
  if (val === 'nữ' || val === 'nu' || val === 'female' || val === 'f') {
    return 'female';
  }
  return 'male';
}
