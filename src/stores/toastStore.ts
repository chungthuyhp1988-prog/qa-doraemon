import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  description?: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    const duration = toast.duration ?? 4000;
    
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearAll: () => set({ toasts: [] }),
}));

// Quick helpers for components to dispatch toasts without calling useToastStore
export const toast = {
  success: (message: string, description?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'success', description, duration }),
  error: (message: string, description?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'error', description, duration }),
  warning: (message: string, description?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'warning', description, duration }),
  info: (message: string, description?: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'info', description, duration }),
};
