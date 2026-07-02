# Kế hoạch tối ưu hóa và hoàn thiện hệ thống quản lý Trường Mầm Non Doraemon

Tài liệu này đánh giá tổng thể dự án và đề xuất các bước tối ưu hóa, sửa lỗi, nâng cao bảo mật để hệ thống hoạt động ổn định và sẵn sàng cho môi trường sản xuất (production).

---

## 1. Đánh giá hiện trạng hệ thống

### 1.1 Điểm mạnh
* **Giao diện & Trải nghiệm (UI/UX)**: Sử dụng React 19 + Vite 6 + Tailwind 4 và Framer Motion. UI hiện đại, mượt mà, có hỗ trợ Responsive và Dark Mode tốt.
* **Cơ sở dữ liệu (Database)**: Supabase Postgres đã có cấu trúc rất hoàn thiện (16 bản migration), hỗ trợ đầy đủ phân quyền RLS (Row Level Security) cho các vai trò: `admin`, `teacher`, `staff`, `guardian`.
* **Cơ chế kiểm thử (Testing)**: Đã cấu hình Vitest + Testing Library với 19 test case chạy thành công cho các phần quan trọng như định dạng dữ liệu (formatters) và tạo biên lai (receipt).

### 1.2 Các điểm cần tối ưu hóa và khắc phục
* **TypeScript Compiler (Lỗi Build)**: Lệnh `npm run lint` (`tsc --noEmit`) hiện đang bị lỗi do quét qua các file nháp trong thư mục `scratch/` (thiếu thư viện `pg` và lỗi khai báo biến).
* **Bảo mật tích hợp Zalo**: Access Token của Zalo OA đang được lưu trong bảng `schools` và gọi trực tiếp từ Client. Điều này dễ làm lộ token qua trình duyệt và bị giới hạn CORS.
* **Độ an toàn kiểu dữ liệu (Type Safety)**: Có khoảng 188 vị trí sử dụng kiểu `any` (đặc biệt là trong các View chính như `Dashboard.tsx`, `Settings.tsx`, `Students.tsx`).
* **Tính năng tự động**: Các tính năng gửi thông báo qua Zalo (điểm danh, học phí) vẫn đang ở dạng Mock/Stub.

---

## 2. Kế hoạch tối ưu hóa chi tiết

### Giai đoạn 1: Sửa lỗi Build & Tối ưu TypeScript (Thực hiện ngay)
* **Mục tiêu**: Đảm bảo dự án không còn lỗi TypeScript khi chạy lệnh kiểm tra chất lượng.
* **Hành động**:
  * Cấu hình lại [tsconfig.json](file:///d:/01_Projects/qa-doraemon/tsconfig.json) để loại bỏ thư mục `scratch/`, `dist/` khỏi quá trình biên dịch của `tsc`.
  * Thay thế dần các kiểu `any` trong `src/views/Dashboard.tsx` và các API helper bằng các kiểu dữ liệu chuẩn từ [database.ts](file:///d:/01_Projects/qa-doraemon/src/types/database.ts).

### Giai đoạn 2: Nâng cao bảo mật Zalo OA bằng Supabase Edge Function
* **Mục tiêu**: Chuyển các thao tác gọi API Zalo nhạy cảm ra phía Server.
* **Hành động**:
  * Tạo một Supabase Edge Function tên là `zalo-zns` đóng vai trò làm Proxy.
  * Cấu hình lưu trữ Zalo Access Token và Refresh Token an toàn trên Supabase.
  * Cập nhật [zalo.ts](file:///d:/01_Projects/qa-doraemon/src/lib/zalo.ts) ở Frontend để gọi qua Edge Function thay vì gọi trực tiếp.

### Giai đoạn 3: Kiểm tra & Tinh chỉnh các Module chức năng
* **Mục tiêu**: Đảm bảo các tính năng cốt lõi hoạt động ổn định 100%.
* **Hành động**:
  * **Điểm danh (Attendance)**: Kiểm tra luồng điểm danh và tự động cập nhật trạng thái của học sinh theo ngày học.
  * **Tài chính (Finance)**: Kiểm tra tính năng tự động chuyển trạng thái học phí quá hạn (`status='overdue'`) thông qua trigger Postgres đã viết trong migration `012`.
  * **Báo cáo (Reports)**: Đảm bảo xuất file Excel hoạt động đúng định dạng và không bị lỗi font Tiếng Việt.

---

## 3. Các thay đổi đề xuất trong mã nguồn

### [Component] Cấu hình dự án & TypeScript
#### [MODIFY] [tsconfig.json](file:///d:/01_Projects/qa-doraemon/tsconfig.json)
* Thêm cấu hình `"include": ["src"]` và `"exclude": ["node_modules", "dist", "scratch"]` để tách biệt các script chạy thử nghiệm khỏi mã nguồn ứng dụng.

### [Component] Tích hợp Zalo & Bảo mật
#### [NEW] [supabase/functions/zalo-zns/index.ts](file:///d:/01_Projects/qa-doraemon/supabase/functions/zalo-zns/index.ts)
* Tạo Edge Function xử lý gửi tin nhắn Zalo OA, bảo mật token và tránh lộ khóa học.
#### [MODIFY] [zalo.ts](file:///d:/01_Projects/qa-doraemon/src/lib/zalo.ts)
* Cập nhật helper để gọi qua API Edge Function mới tạo.

### [Component] Tối ưu hóa Kiểu dữ liệu (Type Safety)
#### [MODIFY] [Dashboard.tsx](file:///d:/01_Projects/qa-doraemon/src/views/Dashboard.tsx)
* Loại bỏ các ép kiểu `as any` tại các vị trí gọi RPC `dashboard_stats`.

---

## 4. Kế hoạch xác minh (Verification Plan)

### Kiểm thử tự động (Automated Tests)
* Chạy lệnh lint để đảm bảo không còn lỗi TypeScript:
  ```powershell
  npm run lint
  ```
* Chạy bộ test hiện tại để đảm bảo không bị ảnh hưởng:
  ```powershell
  npm run test
  ```

### Xác minh thủ công (Manual Verification)
* Chạy ứng dụng ở môi trường Local (`npm run dev`), đăng nhập dưới các vai trò khác nhau (`admin`, `teacher`, `guardian`) để kiểm tra quyền truy cập menu ở Sidebar và các tính năng tương ứng.
