# Page Design Specifications: Core Screens

Đặc tả chi tiết giao diện và các tùy biến thiết kế tối ưu hóa (overrides) cho 5 phân hệ cốt lõi của phần mềm Quản lý Mầm non Doraemon.

---

## 1. Dashboard chính (Bảng điều khiển)

### Layout & Bento Grid
- Thiết kế theo mô hình **Bento Grid** hiện đại giúp gom cụm thông tin thống kê trực quan.
- **Hàng 1 (Stats Row)**: Gồm 4 thẻ chỉ số nhanh (Sĩ số đi học, Vắng mặt, Học phí dự thu, Thực thu). Mỗi thẻ tích hợp nền gradient mờ ẩn ở góc trên bên phải để tạo điểm nhấn thị giác.
- **Hàng 2 (Main Insights Grid)**: 
  - **Cột Trái (8 phần)**: Chứa Biểu đồ Tỷ lệ Chuyên cần dạng cột tùy chỉnh.
  - **Cột Phải (4 phần)**: Hộp cảnh báo chú ý hôm nay (Sinh nhật bé, Y tế siro ho, Lớp chưa điểm danh) và thẻ danh sách Chưa đóng học phí.

### Biểu đồ Tỷ lệ Chuyên cần (Tuần này)
- **Visual**: Các cột điểm danh có bo góc tròn mềm mại ở đỉnh (`rounded-t-2xl`). Sử dụng gradient từ màu Primary (`sky-400`) xuống Sky Blue đậm làm màu nền.
- **Hover interaction**: Khi hover vào mỗi cột, mở rộng hiệu ứng phát sáng mờ (`hover:shadow-primary/30`), đồng thời hiển thị Tooltip kính mờ cao cấp mô tả chi tiết tỷ lệ % chuyên cần.

---

## 2. Trang Quản lý Học sinh & Lớp học

### Quản lý Học sinh (Students View)
- **Bento Split Layout**:
  - **Khung danh sách (2/3 chiều rộng)**: Thiết kế dạng bảng tối giản có phân trang mượt mà. Dòng học sinh được chọn sẽ có đường viền đứng màu xanh dương bên trái làm điểm nhấn định vị trực quan.
  - **Khung chi tiết học sinh (1/3 chiều rộng)**: Thiết kế dạng thẻ kính mờ cố định vị trí (sticky) ở góc phải. Phân chia 3 tab chi tiết (Hồ sơ, Y tế, Tài chính) mượt mà có hiệu ứng underline di chuyển khi đổi tab.
- **Visual Avatar**: Tự động sinh avatar bằng ký tự chữ cái đầu tiên của học sinh kết hợp dải màu ngẫu nhiên dịu nhẹ trong trường hợp trẻ chưa cập nhật ảnh chân dung.

### Sơ đồ lớp học (Classes View)
- **Visual Class Cards**: Thiết kế dạng Grid 3 cột. Các thẻ lớp có bo góc mềm mại `rounded-2xl`, hiển thị đầy đủ tổng sĩ số hiện tại so với sức chứa tối đa.
- **Chương trình sinh hoạt**: Phân chia màu sắc hoạt động (Học tập - xanh dương, Ăn uống - vàng, Ngủ trưa - tím nhạt, Vui chơi - xanh lá) giúp giáo viên dễ dàng theo dõi thời khóa biểu trong ngày của trẻ.

---

## 3. Trang Quản lý Học phí (Finance)

### Thẻ doanh thu tổng quan
- Thẻ dự thu, thực thu, còn nợ được đổ bóng mở rộng, bo góc tối đa `rounded-[32px]`.
- Thẻ nợ học phí có nền nhạt tông màu đỏ hồng cam (`bg-red-50/50`) với viền đỏ nhạt, tạo tính cảnh báo cao nhưng không gây cảm giác khó chịu.

### Biểu đồ Xu hướng Doanh thu (Recharts Area Chart)
- **Visual**: Đồ thị diện tích tích hợp 2 đường vẽ màu xanh dương (Dự thu) và xanh lá cây (Thực thu) có dải chuyển màu mờ dần xuống trục hoành hoành tráng.
- **Custom Tooltip**: Thiết kế dạng kính mờ (`backdrop-blur-md` kết hợp `bg-white/90`) bo tròn góc để hiển thị chi tiết số liệu khi di chuyển chuột.

---

## 4. Trang Thực đơn & Dinh dưỡng (Nutrition)

### Bảng lưới biểu tuần học
- Bảng thực đơn từ Thứ Hai đến Thứ Sáu có phân chia 3 bữa ăn rõ rệt (Bữa Sáng, Bữa Trưa, Bữa Phụ) bằng các biểu đồ icon vector đáng yêu (Coffee, Utensils, Apple).
- Giáo viên có thể click vào các nút thêm/sửa/xóa thực đơn nhanh hiển thị mượt mà trên từng ô của lưới khi di chuyển chuột vào.

### In ấn (Print Stylesheet)
- Tự động ẩn các thanh điều hướng dọc (Sidebar), thanh công cụ đầu trang (Topbar) và các nút bấm hành động khi bật chế độ in thực đơn của trình duyệt (`@media print`).
- Tự động căn chỉnh bảng biểu dinh dưỡng toàn màn hình cân đối trên khổ giấy A4 để gửi về phụ huynh dán tủ lạnh.

---

## 5. Trang cài đặt & Hồ sơ cá nhân (Settings)

### Tabs điều hướng dọc
- Thiết kế thanh tab bên trái gọn gàng theo phong cách Notion. Tab đang chọn có nền màu Primary nổi bật, các tab khác có màu chữ dịu nhẹ có hiệu ứng đổi màu khi hover.

### Hồ sơ & Tải ảnh đại diện
- Khung hình ảnh đại diện bo tròn mượt mà, viền ngoài sáng nhẹ.
- Tích hợp nút "Thay ảnh đại diện" dưới dạng input file ẩn, nhãn nút hover đổi màu mượt mà. 
- Form nhập thông tin cá nhân giáo viên thiết kế các hộp nhập liệu focus ring glow sang trọng, chống giật giao diện.
