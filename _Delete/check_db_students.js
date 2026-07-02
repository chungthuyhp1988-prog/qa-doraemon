import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hvoycgsrqfzkselhbcwx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2b3ljZ3NycWZ6a3NlbGhiY3d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzA3MDcsImV4cCI6MjA5NTQ0NjcwN30.8UKZVQAD3DkcbUYT3eW0O4LO3mUVifMhcVvFgGmDXMM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== LẤY 10 HỌC SINH ĐẦU TIÊN ===');
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, status, class_id')
    .limit(10);
    
  if (error) {
    console.error('Lỗi:', error);
    return;
  }
  
  console.log('Kết quả:', JSON.stringify(data, null, 2));
}

main();
