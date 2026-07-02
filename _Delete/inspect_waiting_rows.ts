import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const filePath = path.join(__dirname, '../DRM- DANH SÁCH HỌC SINH TRƯỜNG MẦM NON DORAEMON .xlsx');
  const workbook = XLSX.readFile(filePath);
  
  console.log('=== KHẢO SÁT SHEET: DS CHỜ NĂM 26-27 ===');
  const sheet = workbook.Sheets['DS CHỜ NĂM 26-27'];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  let validRowsCount = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const stt = Number(row[0]);
    const name = row[2];
    
    if (!isNaN(stt) && stt > 0) {
      validRowsCount++;
      if (stt === 1 || stt === 107 || validRowsCount > 100) {
        console.log(`Dòng Excel ${i + 1} -> STT: ${stt}, Tên: ${name}, Ngày Sinh: ${row[3]}`);
      }
    }
  }
  console.log(`Tổng số dòng có STT hợp lệ đọc được từ sheet: ${validRowsCount}`);
}

main();
