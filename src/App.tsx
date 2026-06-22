import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
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
            <Route path="teachers" element={<Teachers />} />
            <Route path="classes" element={<Classes />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="finance" element={<Finance />} />
            <Route path="nutrition" element={<Nutrition />} />
            <Route path="health" element={<Health />} />
            <Route path="evaluations" element={<Evaluations />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </SlidePanelProvider>
    </QueryClientProvider>
  );
}

/** Temporary placeholder for routes under development */
function PlaceholderView({
  title,
  description,
  emoji,
}: {
  title: string;
  description: string;
  emoji: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in">
      <span className="text-6xl mb-4">{emoji}</span>
      <h2 className="font-playfair text-2xl font-bold text-on-surface mb-2">
        {title}
      </h2>
      <p className="text-on-surface-variant text-center max-w-md">
        {description}
      </p>
      <div className="mt-6 px-4 py-2 bg-primary-container text-on-primary-container rounded-full text-sm font-medium">
        Sắp ra mắt
      </div>
    </div>
  );
}
