import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { Students } from './views/Students';
import { Teachers } from './views/Teachers';
import { Attendance } from './views/Attendance';
import { Finance } from './views/Finance';
import { Classes } from './views/Classes';
import { Nutrition } from './views/Nutrition';
import { Health } from './views/Health';
import { Evaluations } from './views/Evaluations';
import { Notifications } from './views/Notifications';
import { Settings } from './views/Settings';
import { AuditLog } from './views/AuditLog';
import { Reports } from './views/Reports';
import { GuardianPortal } from './views/GuardianPortal';
import { ToastContainer } from './components/ui';
import { useAppStore } from './stores/appStore';
import { SlidePanelProvider } from './context/SlidePanelContext';

// TanStack Query client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SlidePanelProvider>
          <ToastContainer />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />

              {/* Protected routes with layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="students" element={<Students />} />
                <Route path="classes" element={<Classes />} />
                <Route path="nutrition" element={<Nutrition />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>

              {/* Admin-only routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="teachers" element={<Teachers />} />
                <Route path="finance" element={<Finance />} />
                <Route path="reports" element={<Reports />} />
                <Route path="audit-log" element={<AuditLog />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Admin + Teacher routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['admin', 'teacher']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="attendance" element={<Attendance />} />
                <Route path="health" element={<Health />} />
                <Route path="evaluations" element={<Evaluations />} />
              </Route>

              {/* Guardian-only routes */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['guardian']}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="guardian" element={<GuardianPortal />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SlidePanelProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

