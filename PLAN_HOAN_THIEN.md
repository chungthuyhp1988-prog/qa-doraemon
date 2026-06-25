# Kế hoạch hoàn thiện — Doraemon Kindergarten Management

> Ngày lập: 2026-06-25 | Phần mềm quản lý Trường Mầm Non Doraemon — Hà Tĩnh

---

## 1. Tổng quan kiến trúc

| Lớp | Công nghệ | Trạng thái |
|---|---|---|
| Frontend | React 19, Vite 6, TypeScript 5.8, Tailwind 4, Motion | ~85–90% UI/UX |
| State/Data | TanStack Query 5, Zustand 5 | Ổn định |
| Backend | Supabase (Postgres + Auth + RLS) | Schema 12 bảng, RLS cho admin/teacher/guardian |
| Tích hợp | Zalo OA (ZNS), Excel (xlsx), Google Gemini AI | Zalo còn mock/stub |

---

## 2. Tình trạng từng module

| Module | UI/UX | Frontend | Backend | Ghi chú |
|---|---|---|---|---|
| Dashboard | 90% | 80% | 60% | Biểu đồ có giá trị fallback hardcode; aggregate client-side |
| Học sinh | 95% | 90% | 85% | Đầy đủ form/detail/Excel import |
| Đăng ký | 90% | 85% | 80% | Mới nâng cấp (migration 009) |
| Giáo viên/CB | 95% | 90% | 85% | View lớn nhất, có work_status |
| Lớp học | 90% | 85% | 80% | DetailPanel rất chi tiết |
| Điểm danh | 90% | 85% | 75% | Chưa auto-gửi Zalo thật |
| Tài chính | 90% | 85% | 65% | Thiếu auto-overdue, biên lai backend |
| Dinh dưỡng | 85% | 80% | 80% | OK |
| Sức khỏe | 85% | 80% | 80% | OK |
| Đánh giá | 85% | 80% | 80% | OK |
| Thông báo | 80% | 75% | 60% | Badge hardcode "3"; gửi Zalo mock |
| Cài đặt | 85% | 80% | 70% | Lưu token Zalo phía client (rủi ro bảo mật) |

---

## 3. Các vấn đề trọng yếu

### 3.1 Bảo mật
- **Zalo ZNS là mock** — access token để lộ client-side (`src/lib/zalo.ts`). Cần Edge Function proxy.
- **Vai trò `staff` thiếu RLS** — enum tồn tại nhưng không có policy → staff bị chặn đọc hầu hết dữ liệu.
- Không lọc menu theo vai trò ở Sidebar; `ProtectedRoute` hỗ trợ `allowedRoles` nhưng chưa dùng.

### 3.2 Frontend
- **Lạm dụng `any`** — Dashboard và nhiều view mất type-safety.
- **Không có test** — không có test runner trong `package.json`.
- **Aggregate nặng phía client** — Dashboard kéo 1000–5000 bản ghi.
- Badge thông báo hardcode `3` trong `Sidebar.tsx`.
- Thiếu Error Boundary toàn cục.
- Chưa audit accessibility và responsive bảng dữ liệu.

### 3.3 Backend
- Không có RPC/View tổng hợp cho Dashboard & báo cáo.
- Học phí quá hạn không tự cập nhật (`status='overdue'`).
- Chưa cấu hình Storage bucket cho upload ảnh.
- Cổng phụ huynh chưa có (schema hỗ trợ nhưng chưa có UI).

---

## 4. Kế hoạch theo giai đoạn

### GĐ 1 — Bảo mật & Nền tảng (1–1.5 tuần)

- [x] **1.1** Lọc menu Sidebar theo `user.role` (admin/teacher/staff) — `Sidebar.tsx`
- [x] **1.2** Truyền `allowedRoles` vào `ProtectedRoute` cho các route nhạy cảm — `App.tsx`
- [x] **1.3** Fix badge thông báo hardcode → query đếm unread thật — `Sidebar.tsx`
- [x] **1.4** Thêm Error Boundary toàn cục — `ErrorBoundary.tsx` + `App.tsx`
- [x] **1.5** Bổ sung RLS policy cho role `staff` — `010_staff_rls_policies.sql`
- [ ] **1.6** Viết Supabase Edge Function `zalo-zns` làm proxy; chuyển token ra env server

### GĐ 2 — Backend đúng đắn & Dữ liệu thật (1.5–2 tuần)

- [x] **2.1** Tạo RPC `dashboard_stats()` + `finance_monthly_summary()` → 1 query thay 8 query, xóa fallback hardcode — `011_dashboard_rpc.sql`, `Dashboard.tsx`, `Finance.tsx`
- [x] **2.2** Trigger `check_fee_overdue` + batch function `mark_overdue_fees()` — `012_auto_overdue_trigger.sql`
- [x] **2.3** Storage buckets (avatars, student-photos, documents) + RLS — `013_storage_buckets.sql`
- [x] **2.4** RPC `generate_receipt()` + frontend helper `receipt.ts` — `014_receipt_rpc.sql`, `receipt.ts`

### GĐ 3 — Chất lượng & UX (1–1.5 tuần)

- [x] **3.1** Loading skeleton — tạo `ViewSkeleton` component dùng chung; Dashboard đã có full skeleton — `ViewSkeleton.tsx`
- [ ] **3.2** Dọn `any` (188 occurrences) → dùng type từ `database.ts`; thống nhất dùng `queryKeys.ts` — *tiến hành dần qua các PR tiếp*
- [x] **3.3** Accessibility — Modal focus trap + auto-focus; Table `role="table"` + `aria-sort` + `scope="col"` — `Modal.tsx`, `Table.tsx`
- [x] **3.4** Thiết lập Vitest + Testing Library — 19 tests pass (formatters, receipt) — `vitest.config.ts`, `formatters.test.ts`, `receipt.test.ts`

### GĐ 4 — Mở rộng (tùy chọn, 2+ tuần)

- [x] **4.1** Cổng phụ huynh — `GuardianPortal.tsx` (4 tab: tổng quan, điểm danh, học phí, sức khoẻ) + route `/guardian` + role guardian trong RBAC
- [x] **4.2** Audit log — `015_audit_log.sql` (bảng + trigger 5 bảng + RPC `get_audit_log`) + `AuditLog.tsx` (filter, expand, pagination)
- [x] **4.3** Báo cáo nâng cao — `016_advanced_reports_rpc.sql` (3 RPC: attendance/finance/students_summary) + `Reports.tsx` (3 tab + xuất Excel)
- [x] **4.4** PWA — `manifest.json` + `sw.js` + service worker registration + meta tags

---

## 5. Ưu tiên

> **GĐ 1 > GĐ 2 > GĐ 3 > GĐ 4**
>
> GĐ 1 là ưu tiên tuyệt đối vì liên quan bảo mật (Zalo token lộ, RLS thiếu cho staff, RBAC không enforce).

---

*Tài liệu này được tạo tự động bởi Claude Code. Cập nhật lần cuối: 2026-06-25.*
