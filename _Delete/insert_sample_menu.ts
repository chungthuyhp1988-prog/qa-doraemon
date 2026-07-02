import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env từ file .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Không tìm thấy cấu hình kết nối Supabase trong file .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    // Đăng nhập tài khoản admin để lấy quyền bypass RLS
    console.log('Đang đăng nhập bằng tài khoản admin...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@doraemon.edu.vn',
      password: '123456'
    });

    if (authError || !authData.session) {
      console.error('Đăng nhập admin thất bại:', authError?.message || 'Không có session');
      process.exit(1);
    }
    console.log('Đăng nhập thành công!');

    // Trường Mầm Non Doraemon có ID cố định trong schema ban đầu
    const schoolId = '00000000-0000-0000-0000-000000000001';
    console.log('Đang sử dụng School ID:', schoolId);

    // Dữ liệu thực đơn mẫu theo ảnh của trường
    const menuData = [
      // Thứ 2: 29/06/2026
      { date: '2026-06-29', meal_type: 'breakfast_7h30', menu_items: 'Phở gà/\nCháo gà bí đỏ' },
      { date: '2026-06-29', meal_type: 'breakfast_9h40', menu_items: 'Sữa chua uống TH' },
      { date: '2026-06-29', meal_type: 'lunch_10h25', menu_items: 'Cơm mềm\nThịt chưng mắm tép\nSu hào cà rốt xào\nCanh chua thịt bò\nThanh long đỏ' },
      { date: '2026-06-29', meal_type: 'lunch_chao', menu_items: 'Cháo thịt nạc cải bó xôi' },
      { date: '2026-06-29', meal_type: 'snack_14h15', menu_items: 'Sữa đậu phộng cacao' },
      { date: '2026-06-29', meal_type: 'snack_15h25', menu_items: 'Cháo cá bớp đậu đỏ' },

      // Thứ 3: 30/06/2026
      { date: '2026-06-30', meal_type: 'breakfast_7h30', menu_items: 'Bánh canh tôm thịt/\nCháo tôm mồng tơi' },
      { date: '2026-06-30', meal_type: 'breakfast_9h40', menu_items: 'Sữa chua uống Yakult' },
      { date: '2026-06-30', meal_type: 'lunch_10h25', menu_items: 'Cơm mềm\nTrứng gà đúc thịt\nCủ quả luộc chấm muối vừng\nCanh mồng tơi tôm\nDưa lưới' },
      { date: '2026-06-30', meal_type: 'lunch_chao', menu_items: 'Cháo thịt bò cà rốt' },
      { date: '2026-06-30', meal_type: 'snack_14h15', menu_items: 'Sữa ngô nếp' },
      { date: '2026-06-30', meal_type: 'snack_15h25', menu_items: 'Mỳ rau củ thịt gà/\nCháo gà khoai lang' },

      // Thứ 4: 01/07/2026
      { date: '2026-07-01', meal_type: 'breakfast_7h30', menu_items: 'Miến gạo lứt thịt bò/\nCháo thịt bò rau ngót' },
      { date: '2026-07-01', meal_type: 'breakfast_9h40', menu_items: 'Sữa chua uống TH' },
      { date: '2026-07-01', meal_type: 'lunch_10h25', menu_items: 'Cơm mềm\nChả gà rau củ\nBí xanh xào\nCanh xương gà rong biển\nDưa hấu không hạt' },
      { date: '2026-07-01', meal_type: 'lunch_chao', menu_items: 'Cháo gà đậu Hà Lan' },
      { date: '2026-07-01', meal_type: 'snack_14h15', menu_items: 'Sữa gạo lứt huyết rồng hạnh nhân' },
      { date: '2026-07-01', meal_type: 'snack_15h25', menu_items: 'Cháo cá hồi Nauy\ncải bó xôi' },

      // Thứ 5: 02/07/2026
      { date: '2026-07-02', meal_type: 'breakfast_7h30', menu_items: 'Hủ tiếu tôm thịt/\nCháo thịt nạc cà rốt' },
      { date: '2026-07-02', meal_type: 'breakfast_9h40', menu_items: 'Sữa chua uống Yakult' },
      { date: '2026-07-02', meal_type: 'lunch_10h25', menu_items: 'Cơm mềm\nBò viên sốt cà chua\nCủ cải cà rốt xào\nCanh rau cải thịt nạc\nTáo Mỹ' },
      { date: '2026-07-02', meal_type: 'lunch_chao', menu_items: 'Cháo bò khoai lang' },
      { date: '2026-07-02', meal_type: 'snack_14h15', menu_items: 'Sữa đậu xanh cốt dừa' },
      { date: '2026-07-02', meal_type: 'snack_15h25', menu_items: 'Xôi mường+trứng rán/\nCháo gà rau ngót' },

      // Thứ 6: 03/07/2026
      { date: '2026-07-03', meal_type: 'breakfast_7h30', menu_items: 'Phở bò/\nCháo bò mồng tơi' },
      { date: '2026-07-03', meal_type: 'breakfast_9h40', menu_items: 'Sữa chua uống TH' },
      { date: '2026-07-03', meal_type: 'lunch_10h25', menu_items: 'Cơm mềm\nRuốc bông cá thu\nSu hào cà rốt xào\nCanh đậu hũ cà chua\nThanh long đỏ' },
      { date: '2026-07-03', meal_type: 'lunch_chao', menu_items: 'Cháo cá thu bí đỏ' },
      { date: '2026-07-03', meal_type: 'snack_14h15', menu_items: 'Sữa bí đỏ macca' },
      { date: '2026-07-03', meal_type: 'snack_15h25', menu_items: 'Miến gạo tôm trứng cút/\nCháo tôm củ dền' },

      // Thứ 7: 04/07/2026
      { date: '2026-07-04', meal_type: 'breakfast_7h30', menu_items: 'Cháo sườn đậu đỏ' },
      { date: '2026-07-04', meal_type: 'breakfast_9h40', menu_items: 'Sữa chua uống Yakult' },
      { date: '2026-07-04', meal_type: 'lunch_10h25', menu_items: 'Cơm mềm\nTôm thịt nạc hầm\nSu su cà rốt xào\nCanh mướp hương tôm\nDưa hấu không hạt' },
      { date: '2026-07-04', meal_type: 'lunch_chao', menu_items: 'Cháo thịt nạc cà rốt' },
      { date: '2026-07-04', meal_type: 'snack_14h15', menu_items: 'Sữa ngô nếp' },
      { date: '2026-07-04', meal_type: 'snack_15h25', menu_items: 'Soup gà + bánh mỳ mềm/\nCháo gà đậu xanh' }
    ];

    // Xóa thực đơn chung cũ trong tuần này để tránh trùng lặp
    console.log('Đang dọn dẹp thực đơn chung cũ của tuần 29/06/2026 - 04/07/2026...');
    const { error: deleteError } = await supabase
      .from('meal_plans')
      .delete()
      .eq('school_id', schoolId)
      .is('class_id', null)
      .gte('date', '2026-06-29')
      .lte('date', '2026-07-04');

    if (deleteError) {
      console.error('Lỗi khi xóa thực đơn cũ:', deleteError);
    }

    // Chuẩn bị dữ liệu chèn
    const payloads = menuData.map(item => ({
      school_id: schoolId,
      class_id: null, // Thực đơn chung toàn trường
      date: item.date,
      meal_type: item.meal_type,
      menu_items: item.menu_items,
      calories: 350,
      notes: ''
    }));

    console.log('Đang chèn dữ liệu thực đơn mẫu vào database...');
    const { data: insertedData, error: insertError } = await supabase
      .from('meal_plans')
      .insert(payloads)
      .select();

    if (insertError) {
      throw insertError;
    }

    console.log(`Thành công! Đã chèn ${insertedData?.length} mục thực đơn mẫu.`);
  } catch (err: any) {
    console.error('Đã xảy ra lỗi:', err.message || err);
  }
}

run();
