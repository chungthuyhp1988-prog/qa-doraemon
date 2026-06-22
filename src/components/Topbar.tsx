import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Bell,
  ChevronRight,
  Menu,
  LogOut,
  Settings,
  User,
  X,
  Sun,
  Moon,
  Calendar
} from "lucide-react";
import { cn } from "../lib/utils";
import { Avatar } from "./ui/Avatar";
import { useAppStore } from "../stores/appStore";
import { useAuthStore } from "../stores/authStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { subscribeToTable } from "../lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

/* ── Types ─────────────────────────────────────────── */

export interface TopbarProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
  onToggleSidebar: () => void;
  user?: { name: string; role: string; avatar?: string };
  onLogout?: () => void;
}

/* ── Route title map ───────────────────────────────── */

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/students": "Học Sinh",
  "/teachers": "Giáo Viên",
  "/classes": "Lớp Học",
  "/attendance": "Điểm Danh",
  "/finance": "Tài Chính",
  "/nutrition": "Dinh Dưỡng",
  "/health": "Sức Khỏe",
  "/evaluations": "Đánh Giá Phát Triển",
  "/notifications": "Thông Báo",
  "/settings": "Cài Đặt",
};

/* ── Helpers ───────────────────────────────────────── */

const timeAgo = (dateStr: string) => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: vi });
  } catch {
    return "Vừa xong";
  }
};

/* ── useDebounce hook ──────────────────────────────── */

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/* ── Topbar Component ──────────────────────────────── */

export function Topbar({
  sidebarCollapsed,
  onMenuClick,
  onToggleSidebar,
  user,
  onLogout,
}: TopbarProps) {
  const location = useLocation();
  const [searchValue, setSearchValue] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const selectedAcademicYearId = useAppStore((state) => state.selectedAcademicYearId);
  const setSelectedAcademicYearId = useAppStore((state) => state.setSelectedAcademicYearId);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  // Fetch topbar notifications
  const { data: notificationsResponse } = useQuery({
    queryKey: ['topbar-notifications', currentUser?.school_id],
    queryFn: () => {
      if (!currentUser?.school_id) return { data: { data: [], count: 0 }, error: null, count: 0 };
      return api.getAll<any>(
        'notifications',
        { page: 1, pageSize: 10, sortBy: 'sent_at', sortOrder: 'desc' },
        { filters: { school_id: currentUser.school_id } }
      );
    },
    enabled: !!currentUser?.school_id
  });
  
  const notificationsList = notificationsResponse?.data?.data || [];
  
  // Realtime subscription
  useEffect(() => {
    if (!currentUser?.school_id) return;

    const channel = subscribeToTable('notifications', () => {
      queryClient.invalidateQueries({ queryKey: ['topbar-notifications', currentUser.school_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    });

    return () => {
      channel.unsubscribe();
    };
  }, [currentUser?.school_id, queryClient]);

  // Mark notification as read
  const handleMarkAsRead = async (id: string) => {
    try {
      await api.update('notifications', id, { is_read: true, updated_at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ['topbar-notifications', currentUser?.school_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch academic years
  const { data: yearsResponse } = useQuery({
    queryKey: ['academic-years-topbar'],
    queryFn: () => api.getAll<any>('academic_years', { page: 1, pageSize: 100, sortBy: 'name', sortOrder: 'desc' }),
  });
  const yearsList = yearsResponse?.data?.data || [];

  // Auto select active year if not selected yet
  useEffect(() => {
    if (!selectedAcademicYearId && yearsList.length > 0) {
      const currentYear = yearsList.find((y: any) => y.is_current) || yearsList[0];
      if (currentYear) {
        setSelectedAcademicYearId(currentYear.id);
      }
    }
  }, [yearsList, selectedAcademicYearId, setSelectedAcademicYearId]);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchValue, 300);

  // Page title from route
  const pageTitle = routeTitles[location.pathname] || "Trang chủ";
  const breadcrumbParts = location.pathname.split("/").filter(Boolean);

  // Close dropdowns on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
      setShowNotifications(false);
    }
    if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
      setShowUserMenu(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  // Close on route change
  useEffect(() => {
    setShowNotifications(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  const unreadCount = notificationsList.filter((n: any) => !n.is_read).length;

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex items-center justify-between gap-4",
        "h-[72px] px-4 md:px-6 lg:px-8",
        "bg-surface-container-lowest/80 border-b border-outline-variant backdrop-blur-md",
        // Offset for sidebar
        "left-0 md:left-16",
        !sidebarCollapsed && "md:left-[280px]"
      )}
      style={{
        transition: "left 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
    >
      {/* ── Left section ────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb + Title */}
        <div className="hidden sm:flex flex-col min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[12px] text-on-surface-variant">
            <span className="hover:text-on-surface transition-colors cursor-pointer">
              Trang chủ
            </span>
            {breadcrumbParts.map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                <span
                  className={cn(
                    i === breadcrumbParts.length - 1
                      ? "text-on-surface font-medium"
                      : "hover:text-on-surface transition-colors cursor-pointer"
                  )}
                >
                  {routeTitles[`/${breadcrumbParts.slice(0, i + 1).join("/")}`] || part}
                </span>
              </span>
            ))}
          </div>

          {/* Page title */}
          <h2 className="text-[18px] font-bold font-playfair text-on-surface leading-snug truncate">
            {pageTitle}
          </h2>
        </div>

        {/* Mobile page title */}
        <h2 className="sm:hidden text-[16px] font-bold font-playfair text-on-surface truncate">
          {pageTitle}
        </h2>
      </div>

      {/* ── Right section ───────────────── */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Academic Year Selector */}
        <div className="flex items-center gap-1.5 bg-surface-container border border-outline-variant/60 rounded-full px-3 py-1.5 h-10 select-none">
          <Calendar className="w-4 h-4 text-primary shrink-0" />
          <select
            value={selectedAcademicYearId || ""}
            onChange={(e) => setSelectedAcademicYearId(e.target.value || null)}
            className="bg-transparent border-none text-xs font-bold text-on-surface focus:outline-none pr-1 max-w-[140px] truncate cursor-pointer"
          >
            {selectedAcademicYearId === null && (
              <option value="" disabled className="text-on-surface-variant bg-surface-container-low font-medium">Chọn năm học</option>
            )}
            {yearsList.map((y: any) => (
              <option key={y.id} value={y.id} className="text-on-surface bg-surface-container-lowest font-semibold">
                Năm học {y.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative hidden md:block">
          <div
            className={cn(
              "flex items-center h-10 rounded-full bg-surface-container",
              "border border-transparent transition-all duration-200",
              "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
              "w-48 lg:w-64 xl:w-80"
            )}
          >
            <Search className="absolute left-3 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full h-full bg-transparent border-none focus:outline-none pl-10 pr-4 text-[13px] text-on-surface placeholder:text-on-surface-variant/60 rounded-full"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue("")}
                className="absolute right-3 p-0.5 rounded-full text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile search button */}
        <button className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors">
          <Search className="w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
          aria-label="Đổi giao diện"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* ── Notifications ─────────────── */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className={cn(
              "relative w-10 h-10 rounded-full flex items-center justify-center",
              "text-on-surface-variant transition-all",
              showNotifications
                ? "bg-primary-container text-on-primary-container"
                : "hover:bg-surface-container-high hover:text-on-surface"
            )}
            aria-label="Thông báo"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
            )}
          </button>

          {/* Notification dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-surface rounded-2xl shadow-xl border border-outline-variant/60 overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/40">
                  <h3 className="text-[14px] font-bold text-on-surface">
                    Thông báo
                  </h3>
                  {unreadCount > 0 && (
                    <span className="text-[11px] font-semibold text-primary bg-primary-container px-2 py-0.5 rounded-full">
                      {unreadCount} mới
                    </span>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notificationsList.length === 0 ? (
                    <div className="text-center py-8 text-on-surface-variant/70 italic text-xs font-semibold">
                      📭 Hộp thư trống
                    </div>
                  ) : (
                    notificationsList.map((notif: any) => (
                      <button
                        key={notif.id}
                        onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-surface-container/60 transition-colors border-b border-outline-variant/20 last:border-0 cursor-pointer",
                          !notif.is_read && "bg-primary-container/20"
                        )}
                      >
                        <div className="flex gap-3">
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          )}
                          <div className={cn("min-w-0", notif.is_read && "ml-5")}>
                            <p className="text-[13px] font-semibold text-on-surface truncate">
                              {notif.title}
                            </p>
                            <p className="text-[12px] text-on-surface-variant mt-0.5 line-clamp-2">
                              {notif.content}
                            </p>
                            <p className="text-[11px] text-on-surface-variant/70 mt-1">
                              {timeAgo(notif.sent_at || notif.created_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-outline-variant/40">
                  <button
                    onClick={() => navigate("/notifications")}
                    className="w-full text-center text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors py-1 cursor-pointer"
                  >
                    Xem tất cả thông báo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── User menu ─────────────────── */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className={cn(
              "flex items-center gap-2 p-1 pr-1 md:pr-3 rounded-full transition-all",
              showUserMenu
                ? "bg-surface-container-high"
                : "hover:bg-surface-container"
            )}
            aria-label="Menu người dùng"
          >
            <Avatar
              src={user?.avatar}
              name={user?.name || "U"}
              size="sm"
              className="ring-2 ring-primary/30"
            />
            {user && (
              <span className="hidden md:block text-[13px] font-semibold text-on-surface max-w-[100px] truncate">
                {user.name}
              </span>
            )}
          </button>

          {/* User dropdown */}
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-surface rounded-2xl shadow-xl border border-outline-variant/60 overflow-hidden z-50"
              >
                {/* User info header */}
                {user && (
                  <div className="px-4 py-3 border-b border-outline-variant/40">
                    <p className="text-[14px] font-semibold text-on-surface truncate">
                      {user.name}
                    </p>
                    <p className="text-[12px] text-on-surface-variant truncate">
                      {user.role}
                    </p>
                  </div>
                )}

                <div className="py-1.5">
                  {[
                    { icon: User, label: "Hồ sơ", action: () => {} },
                    { icon: Settings, label: "Cài đặt", action: () => {} },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-on-surface-variant" />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-outline-variant/40 py-1.5">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-error hover:bg-error-container/40 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
