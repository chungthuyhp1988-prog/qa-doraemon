import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, LogIn, GraduationCap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import schoolLogo from '../assets/logo.jpg';

export function Login() {
  const navigate = useNavigate();
  const { setUser, setAccessToken, setLoading, setError, error, isLoading } =
    useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let loginEmail = email.trim();
      if (loginEmail.toLowerCase() === 'admin') {
        loginEmail = 'admin@doraemon.edu.vn';
      }

      // Sign in with Supabase Auth
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

      if (authError) {
        throw new Error(
          authError.message === 'Invalid login credentials'
            ? 'Email hoặc mật khẩu không đúng'
            : authError.message
        );
      }

      if (!authData.session || !authData.user) {
        throw new Error('Không thể đăng nhập. Vui lòng thử lại.');
      }

      // Fetch user profile from users table
      const { data: profile, error: profileError } = (await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()) as { data: any; error: any };

      if (profileError || !profile) {
        throw new Error(
          'Không tìm thấy hồ sơ người dùng. Liên hệ quản trị viên.'
        );
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error(
          'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.'
        );
      }

      // Set auth state
      setAccessToken(authData.session.access_token);
      setUser({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active,
        school_id: profile.school_id,
      });
      setLoading(false);

      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-primary/10 border border-white/50 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-sky-600 px-8 py-10 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 border border-white/30 overflow-hidden shadow-md"
            >
              {!logoError ? (
                <img
                  src={schoolLogo}
                  alt="Doraemon School Logo"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <GraduationCap className="w-10 h-10 text-white" />
                </div>
              )}
            </motion.div>
            <h1 className="text-2xl font-bold text-white font-playfair">
              Trường Mầm Non Doraemon
            </h1>
            <p className="text-white/80 text-sm mt-1">
              Hệ thống Quản lý — Đăng nhập
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="px-8 py-8 space-y-5">
            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-error-container text-on-error-container text-sm px-4 py-3 rounded-lg border border-error/20"
              >
                {error}
              </motion.div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium text-on-surface"
              >
                Tên đăng nhập hoặc Email
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin hoặc email"
                required
                autoComplete="username"
                className="w-full px-4 py-3 bg-surface-variant/50 border border-outline-variant rounded-lg
                  text-on-surface placeholder:text-on-surface-variant/50
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium text-on-surface"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-surface-variant/50 border border-outline-variant rounded-lg
                    text-on-surface placeholder:text-on-surface-variant/50
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/30"
                />
                Ghi nhớ đăng nhập
              </label>
              <button
                type="button"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-on-primary
                font-semibold rounded-lg shadow-lg shadow-primary/25
                hover:bg-primary/90 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                transition-all duration-200"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-on-surface-variant/60">
              AN TOÀN — YÊU THƯƠNG — TÔN TRỌNG
            </p>
          </div>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-on-surface-variant/50 mt-6">
          © 2026 Trường Mầm Non Doraemon — Hà Tĩnh
        </p>
      </motion.div>
    </div>
  );
}
