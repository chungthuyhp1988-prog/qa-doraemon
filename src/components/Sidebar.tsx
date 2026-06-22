import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  UtensilsCrossed,
  HeartPulse,
  Bell,
  Settings,
  ChevronLeft,
  LogOut,
  School,
  Award,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Avatar } from "./ui/Avatar";
import schoolLogo from "../assets/logo.jpg";

/* ── Types ─────────────────────────────────────────── */

export interface SidebarUser {
  name: string;
  role: string;
  avatar?: string;
}

export interface SidebarProps {
  user: SidebarUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onLogout?: () => void;
}

/* ── Nav items ─────────────────────────────────────── */

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Học Sinh", icon: Users },
  { to: "/registrations", label: "Đăng Ký", icon: UserPlus },
  { to: "/teachers", label: "Giáo Viên", icon: GraduationCap },
  { to: "/classes", label: "Lớp Học", icon: BookOpen },
  { to: "/attendance", label: "Điểm Danh", icon: ClipboardCheck },
  { to: "/finance", label: "Tài Chính", icon: CreditCard },
  { to: "/nutrition", label: "Dinh Dưỡng", icon: UtensilsCrossed },
  { to: "/health", label: "Sức Khỏe", icon: HeartPulse },
  { to: "/evaluations", label: "Đánh Giá", icon: Award },
];

const bottomNavItems: NavItem[] = [
  { to: "/notifications", label: "Thông Báo", icon: Bell, badge: 3 },
  { to: "/settings", label: "Cài Đặt", icon: Settings },
];

/* ── SidebarNavItem ────────────────────────────────── */

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center rounded-xl transition-all duration-200",
          collapsed ? "justify-center mx-1 px-0 py-2.5" : "gap-3 mx-2 px-4 py-2.5",
          isActive
            ? "bg-primary text-on-primary shadow-sm shadow-primary/25"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "w-5 h-5 shrink-0",
              isActive ? "text-on-primary" : "text-on-surface-variant group-hover:text-on-surface"
            )}
            strokeWidth={isActive ? 2.5 : 2}
          />

          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[14px] font-semibold tracking-[0.01em] whitespace-nowrap overflow-hidden flex-1"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>

          {item.badge && (
            <span
              className={cn(
                "text-[10px] font-bold rounded-full leading-none",
                collapsed
                  ? "absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-error text-on-error"
                  : "px-2 py-0.5 bg-error text-on-error"
              )}
            >
              {item.badge}
            </span>
          )}

          {/* Tooltip for collapsed mode */}
          {collapsed && (
            <div
              className={cn(
                "absolute left-full ml-2 px-2.5 py-1.5 rounded-lg",
                "bg-on-surface text-surface text-[12px] font-medium",
                "opacity-0 group-hover:opacity-100 pointer-events-none",
                "transition-opacity duration-150 whitespace-nowrap z-[60]",
                "shadow-lg"
              )}
            >
              {item.label}
            </div>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ── SidebarContent ────────────────────────────────── */

function SidebarContent({
  user,
  collapsed,
  onToggleCollapse,
  onLogout,
}: Omit<SidebarProps, "mobileOpen" | "onMobileClose">) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header: Logo + School Name ────── */}
      <div className={cn("shrink-0 py-5", collapsed ? "px-3" : "px-5")}>
        <div
          className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "gap-3"
          )}
        >
          <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm shadow-primary/20 bg-surface-container-high border border-outline-variant/30">
            {!logoError ? (
              <img
                src={schoolLogo}
                alt="Doraemon School Logo"
                onError={() => setLogoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <School className="w-5 h-5 text-on-primary" />
              </div>
            )}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="min-w-0 overflow-hidden"
              >
                <h1 className="text-[17px] font-bold italic font-playfair leading-tight text-on-surface truncate">
                  Doraemon
                </h1>
                <p className="text-[11px] font-medium tracking-[0.04em] text-on-surface-variant truncate">
                  Trường Mầm Non
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Main navigation ───────────────── */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto overflow-x-hidden py-2">
        {mainNavItems.map((item) => (
          <SidebarNavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* ── Bottom section ────────────────── */}
      <div className="shrink-0 px-2 flex flex-col gap-0.5 py-2 border-t border-outline-variant/30 mx-3">
        {bottomNavItems.map((item) => (
          <SidebarNavItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </div>

      {/* ── User profile + Logout ─────────── */}
      <div
        className={cn(
          "shrink-0 border-t border-outline-variant/30 mx-3",
          collapsed ? "px-1 py-3" : "px-3 py-3"
        )}
      >
        <div
          className={cn(
            "flex items-center rounded-xl transition-colors",
            collapsed ? "justify-center p-2" : "gap-3 p-2"
          )}
        >
          <Avatar
            src={user.avatar}
            name={user.name}
            size="sm"
            status="online"
          />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-[13px] font-semibold text-on-surface truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {user.role}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onLogout}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/60 transition-colors shrink-0"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Collapse toggle (desktop) ─────── */}
      <div className="shrink-0 px-3 pb-3 hidden md:block">
        <button
          onClick={onToggleCollapse}
          className={cn(
            "w-full flex items-center justify-center p-2 rounded-xl",
            "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            "transition-colors duration-200"
          )}
          aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[12px] font-medium ml-2"
              >
                Thu gọn
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}

/* ── Sidebar (exported) ───────────────────────────── */

export function Sidebar({
  user,
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  onLogout,
}: SidebarProps) {
  return (
    <>
      {/* ═══ Desktop / Tablet sidebar ══════════════════ */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 280 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn(
          "fixed left-0 top-0 h-full z-40",
          "bg-surface-container border-r border-outline-variant",
          "hidden md:flex flex-col"
        )}
      >
        <SidebarContent
          user={user}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onLogout={onLogout}
        />
      </motion.aside>

      {/* ═══ Mobile overlay sidebar ════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm md:hidden"
              onClick={onMobileClose}
              aria-hidden="true"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed left-0 top-0 h-full w-[280px] z-50 bg-surface-container border-r border-outline-variant md:hidden"
            >
              <SidebarContent
                user={user}
                collapsed={false}
                onToggleCollapse={onToggleCollapse}
                onLogout={onLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
