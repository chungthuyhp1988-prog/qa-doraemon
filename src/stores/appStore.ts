import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedAcademicYearId: string | null;
  selectedClassId: string | null;
  theme: 'light' | 'dark' | 'system';
  
  setSelectedAcademicYearId: (id: string | null) => void;
  setSelectedClassId: (id: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedAcademicYearId: null,
      selectedClassId: null,
      theme: 'system',

      setSelectedAcademicYearId: (selectedAcademicYearId) => set({ selectedAcademicYearId }),
      setSelectedClassId: (selectedClassId) => set({ selectedClassId }),
      setTheme: (theme) => {
        set({ theme });
        // Handle class updates on html element if theme is changed
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        
        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          root.classList.add(systemTheme);
        } else {
          root.classList.add(theme);
        }
      },
    }),
    {
      name: 'doraemon-app-prefs',
      partialize: (state) => ({
        selectedAcademicYearId: state.selectedAcademicYearId,
        selectedClassId: state.selectedClassId,
        theme: state.theme,
      }),
    }
  )
);
