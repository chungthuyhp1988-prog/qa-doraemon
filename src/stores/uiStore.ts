import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  /** Whether sidebar is collapsed (desktop: mini mode, mobile: hidden) */
  sidebarCollapsed: boolean;
  /** Whether mobile sidebar overlay is open */
  mobileSidebarOpen: boolean;
  /** Current page title for topbar */
  pageTitle: string;
  /** Global search query */
  searchQuery: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setPageTitle: (title: string) => void;
  setSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      pageTitle: 'Dashboard',
      searchQuery: '',

      toggleSidebar: () =>
        set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setPageTitle: (pageTitle) => set({ pageTitle }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
    }),
    {
      name: 'doraemon-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
