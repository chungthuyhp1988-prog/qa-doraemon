import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const filePath = path.join(__dirname, '../DRM- DANH SÁCH HỌC SINH TRƯỜNG MẦM NON DORAEMON .xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets['DANH SACH NAM 26-27'];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const targetNames = ['Bùi Bảo Minh Ngọc', 'Lê Gia Hân', 'Lê Hải Đăng'];

  console.log('=== TRA CỨU HỌC SINH TRONG EXCEL ===');
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const name = String(row[1] || '').trim();
    if (targetNames.includes(name)) {
      console.log(`Học sinh: ${name}`);
      console.log(`- Lớp (ước lượng từ nhóm): ${findClassName(data, i)}`);
      console.log(`- Cột M (Đang học - index 12): ${row[12]}`);
      console.log(`- Cột N (Đã ghi danh - index 13): ${row[13]}`);
      console.log(`- Toàn bộ dòng:`, row);
      console.log('------------------------------------------------');
    }
  }
}

function findClassName(data: any[][], rowIndex: number): string {
  for (let i = rowIndex; i >= 0; i--) {
    const cell = String(data[i][0] || '').trim();
    if (cell && isNaN(Number(cell)) && 
        !cell.includes('STT') && !cell.includes('DANH SÁCH') && 
        cell.match(/^(Dorami|Nobita|Doraemon|Shizuka)/i)) {
      return cell;
    }
  }
  return 'Không rõ';
}

main();
