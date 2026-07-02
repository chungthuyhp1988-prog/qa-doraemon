import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, ViewSkeleton } from './components/ui';
import { useAppStore } from './stores/appStore';
import { SlidePanelProvider } from './context/SlidePanelContext';

// Lazy load views for optimal bundle size
const Login = lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const Students = lazy(() => import('./views/Students').then(m => ({ default: m.Students })));
const Teachers = lazy(() => import('./views/Teachers').then(m => ({ default: m.Teachers })));
const Attendance = lazy(() => import('./views/Attendance').then(m => ({ default: m.Attendance })));
const Finance = lazy(() => import('./views/Finance').then(m => ({ default: m.Finance })));
const Classes = lazy(() => import('./views/Classes').then(m => ({ default: m.Classes })));
const Nutrition = lazy(() => import('./views/Nutrition').then(m => ({ default: m.Nutrition })));
const Health = lazy(() => import('./views/Health').then(m => ({ default: m.Health })));
const Evaluations = lazy(() => import('./views/Evaluations').then(m => ({ default: m.Evaluations })));
const Notifications = lazy(() => import('./views/Notifications').then(m => ({ default: m.Notifications })));
const Settings = lazy(() => import('./views/Settings').then(m => ({ default: m.Settings })));
const AuditLog = lazy(() => import('./views/AuditLog').then(m => ({ default: m.AuditLog })));
const Reports = lazy(() => import('./views/Reports').then(m => ({ default: m.Reports })));
const GuardianPortal = lazy(() => import('./views/GuardianPortal').then(m => ({ default: m.GuardianPortal })));

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
            <Suspense fallback={<ViewSkeleton />}>
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
            </Suspense>
          </BrowserRouter>
        </SlidePanelProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

