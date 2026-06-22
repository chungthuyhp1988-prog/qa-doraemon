# Master Design System Specifications: Doraemon Preschool

Hệ thống thiết kế chuẩn hóa của phần mềm **Quản lý Mầm non Doraemon** được xây dựng trên ngôn ngữ thiết kế thân thiện, tươi sáng nhưng vô cùng cao cấp (Premium Playful & Minimalist). Tài liệu này đóng vai trò là "Nguồn chân lý duy nhất" (Single Source of Truth) giúp đảm bảo sự nhất quán visual trên toàn bộ dự án.

---

## 🎨 Bảng màu (Color Palette)

| Loại màu | Mã màu (Hex) | Ý nghĩa / Cách sử dụng |
| :--- | :--- | :--- |
| **Primary (Sky)** | `#0ea5e9` | Màu đại diện chính cho bầu trời và Doraemon. Dùng cho nút chính, liên kết, icon trọng tâm. |
| **Secondary (Amber)** | `#f59e0b` | Màu phụ đại diện cho chiếc chuông vàng của Doraemon. Dùng cho cảnh báo nhẹ, sinh nhật, thông báo. |
| **Success (Emerald)** | `#10b981` | Màu xanh lá thân thiện cho điểm danh có mặt, học phí đã đóng đầy đủ. |
| **Error (Rose)** | `#ef4444` | Màu cảnh báo đỏ cho nghỉ học không phép, quá hạn đóng phí, lưu ý y tế khẩn cấp. |
| **Background (Light)** | `#f8fafc` | Nền trắng ngà slate-50 cho toàn bộ màn hình nền sáng, tạo cảm giác thư thái, dễ chịu. |
| **Background (Dark)** | `#0f172a` | Nền tối slate-900 cho chế độ Dark mode, dịu mắt cho giáo viên trực đêm. |
| **Surface (Light)** | `#ffffff` | Nền thẻ (cards), danh sách bảng biểu trong suốt có phủ lớp kính mờ. |
| **Surface (Dark)** | `#1e293b` | Nền thẻ slate-800 trong chế độ tối. |

---

## 📝 Kiểu chữ (Typography)

Sự kết hợp hoàn hảo giữa phông chữ Serif hoài niệm thanh lịch và phông chữ Sans-Serif hiện đại:
- **Tiêu đề chính (`H1`, `H2`)**: Phông chữ **Playfair Display**, kiểu nghiêng (`italic`), độ dày `font-bold` (trọng số `700`), tạo cảm giác nghệ thuật sang trọng của phong cách thiết kế tạp chí cao cấp.
- **Tiêu đề phụ (`H3`, `H4`)**: Phông chữ **Playfair Display**, kiểu bình thường hoặc nghiêng.
- **Nội dung (`Body`, `Label`, `Inputs`)**: Phông chữ **Inter** (trọng số `400` đến `600`), độ tương phản cao, dễ đọc trên mọi thiết bị di động hay máy tính để bàn.

---

## 📐 Spacing & Borders System (Độ bo góc và Khoảng cách)

- **Bo góc (Border Radius)**:
  - Thẻ widget, thẻ Bento lớn: Bo góc tối đa `rounded-[32px]` tạo cảm giác mềm mại, tròn trịa, an toàn thích hợp cho môi trường giáo dục trẻ nhỏ.
  - Hộp nhập liệu (Inputs), nút bấm (Buttons), hộp thoại con (Modals): Bo góc `rounded-xl` (`12px`) hoặc `rounded-2xl` (`16px`).
  - Ảnh đại diện, nhãn phân loại (Chips): Bo góc tròn trịa tuyệt đối `rounded-full` (`9999px`).
- **Hiệu ứng đổ bóng (Shadows)**:
  - Sử dụng bóng đổ cực nhẹ (`shadow-sm`) để các thẻ không bị nổi quá đà gây rối mắt.
  - Khi hover vào thẻ, mở rộng bóng đổ (`shadow-md` hoặc `shadow-lg` với mờ ảo primary/sky container) tạo chiều sâu tương tác sinh động.

---

## ✨ Quy tắc UI/UX chuyên nghiệp (PRO MAX Guidelines)

1. **Tuyệt đối không dùng Emoji làm Icon**: 
   - Thay thế toàn bộ các emoji như 🎨 🚀 ⚙️ bằng bộ vector SVG đồng bộ từ thư viện **Lucide-React** (đã được cấu hình thống nhất kích thước).
2. **Cảm giác Tương tác (Micro-interactions)**:
   - Tất cả các phần tử click được hoặc có thể hover vào (như các dòng trong bảng, danh sách học sinh) bắt buộc phải có thuộc tính CSS `cursor-pointer`.
   - Không được thay đổi kích thước thẻ đột ngột gây dịch chuyển layout (layout shift) khi hover, thay vào đó hãy sử dụng hiệu ứng dịch chuyển tịnh tiến nhẹ lên trên 2px (`transform: translateY(-2px)`) kết hợp viền sáng nhẹ.
3. **Contrast & Light Mode**:
   - Tránh dùng chữ xám mờ trên nền sáng. Text chính luôn dùng màu `slate-900` (`#0f172a`), các nhãn phụ dùng tối thiểu màu `slate-600` (`#475569`) để đảm bảo độ tương phản tiêu chuẩn WCAG AA.
   - Thẻ kính mờ trong Light mode phải có độ đục tối thiểu `bg-white/80` kèm viền sáng màu `border-outline-variant/40`.
