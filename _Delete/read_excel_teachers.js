import XLSX from 'xlsx';

const filePath = './DSGVNV DORAEMON.xlsx';

function run() {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  // Tìm dòng chứa header (dòng có chữ 'Họ tên' và 'Lớp')
  let headerIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row.includes('Họ tên') && row.includes('Lớp')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    console.log("Could not find header row");
    return;
  }
  
  const headers = rawData[headerIndex];
  const nameIdx = headers.indexOf('Họ tên');
  const emailIdx = headers.indexOf('Email');
  const classIdx = headers.indexOf('Lớp');
  
  const cleanRows = [];
  for (let i = headerIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;
    
    const name = row[nameIdx];
    const className = row[classIdx];
    const email = emailIdx !== -1 ? row[emailIdx] : null;
    
    if (name && className) {
      cleanRows.push({
        name: String(name).trim(),
        email: email ? String(email).trim() : null,
        className: String(className).trim()
      });
    }
  }
  
  console.log(JSON.stringify(cleanRows));
}

run();
