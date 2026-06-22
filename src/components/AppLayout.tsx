import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { SlidePanelContainer } from './ui';


/**
 * Main application layout with sidebar, topbar, and content area.
 * Used as a wrapper for all authenticated routes.
 */
export function AppLayout() {
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen, toggleSidebar } =
    useUIStore();
  const { user } = useAuthStore();

  const sidebarWidth = sidebarCollapsed ? 72 : 280;

  return (
    <div className="flex bg-background min-h-screen font-inter text-on-surface">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        user={
          user
            ? {
                name: user.full_name,
                role: user.role === 'admin' ? 'Quản trị viên' : user.role === 'teacher' ? 'Giáo viên' : 'Nhân viên',
                avatar: user.avatar_url,
              }
            : undefined
        }
      />

      {/* Topbar */}
      <Topbar
        sidebarCollapsed={sidebarCollapsed}
        onMenuClick={() => setMobileSidebarOpen(true)}
        onToggleSidebar={toggleSidebar}
        user={
          user
            ? {
                name: user.full_name,
                role: user.role === 'admin' ? 'Quản trị viên' : user.role === 'teacher' ? 'Giáo viên' : 'Nhân viên',
                avatar: user.avatar_url || undefined,
              }
            : undefined
        }
        onLogout={useAuthStore.getState().logout}
      />

      {/* Main Content */}
      <main
        className="flex-1 pt-[72px] min-h-screen px-4 md:px-8 py-8 overflow-y-auto transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SlidePanel Container */}
      <SlidePanelContainer isSidebarCollapsed={sidebarCollapsed} />
    </div>
  );
}
