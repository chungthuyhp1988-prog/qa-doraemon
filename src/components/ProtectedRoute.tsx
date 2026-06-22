import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles allowed to access this route. If empty, any authenticated user can access. */
  allowedRoles?: ('admin' | 'teacher' | 'staff')[];
}

/**
 * Wrapper component that protects routes from unauthenticated access.
 * Redirects to /login if not authenticated.
 * Optionally checks role-based access.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, setUser, setAccessToken, setLoading } =
    useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // Check current session on mount
    const checkSession = async () => {
      try {
        if (useAuthStore.getState().accessToken === 'mock-admin-token') {
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // Fetch profile if we don't have user data
          if (!user) {
            const { data: profile } = (await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single()) as { data: any; error: any };

            if (profile && profile.is_active) {
              setUser({
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                role: profile.role,
                phone: profile.phone,
                avatar_url: profile.avatar_url,
                job_title: profile.job_title,
                is_active: profile.is_active,
                school_id: profile.school_id,
              });
              setAccessToken(session.access_token);
            } else {
              // Profile not found or inactive
              await supabase.auth.signOut();
              setUser(null);
              setAccessToken(null);
            }
          }
        } else {
          setUser(null);
          setAccessToken(null);
        }
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (useAuthStore.getState().accessToken === 'mock-admin-token') {
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setAccessToken(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' && session) {
        setAccessToken(session.access_token);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setAccessToken(session.access_token);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant text-sm animate-pulse">
            Đang tải...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚫</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-2">
              Không có quyền truy cập
            </h2>
            <p className="text-on-surface-variant text-sm">
              Bạn không có quyền truy cập trang này. Vui lòng liên hệ quản trị
              viên nếu cần hỗ trợ.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
