import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { Seo } from '@/components/shared/Seo';
import { useAuthStore } from '@/store/auth';
import { getApiErrorMessage } from '@/lib/apiClient';
import { posDb } from '@/pos/db/schema';

const schema = z.object({
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status } = useAuthStore();
  const locationState = location.state as { from?: unknown; reason?: unknown } | null;
  const requestedPath =
    typeof locationState?.from === 'string' &&
    locationState.from.startsWith('/') &&
    !locationState.from.startsWith('//')
      ? locationState.from
      : '/admin';
  const sessionExpired = locationState?.reason === 'session-expired';
  const [offlineReady, setOfflineReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (status === 'authenticated') navigate(requestedPath, { replace: true });
  }, [status, navigate, requestedPath]);

  useEffect(() => {
    if (!window.rawaqanDesktop?.isDesktop) return;
    void posDb.offlineSession.count().then((count) => setOfflineReady(count > 0));
  }, []);

  const onSubmit = async (values: FormValues) => {
    try {
      await login(values.email, values.password);
      toast.success('مرحباً بعودتك');
      navigate(requestedPath, { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'فشل تسجيل الدخول'));
    }
  };

  return (
    <>
      <Seo title="تسجيل الدخول" />
      <div className="grid min-h-screen place-items-center bg-ink px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-secondary p-8 shadow-card"
        >
          <div className="mb-8 text-center">
            <Logo className="text-3xl text-white" />
            <p className="mt-2 text-sm text-white/50">لوحة إدارة المطعم</p>
          </div>

          {sessionExpired && (
            <div role="alert" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm leading-6 text-amber-100">
              انتهت جلسة الخادم. سجّل الدخول مجدداً؛ ستعود إلى نقطة البيع وتُستأنف مزامنة العمليات المحفوظة تلقائياً.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">
                البريد الإلكتروني
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  placeholder="admin@rawaqan.local"
                  className="border-white/10 bg-white/5 pr-10 text-white placeholder:text-white/30"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">
                كلمة المرور
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="border-white/10 bg-white/5 pr-10 text-white placeholder:text-white/30"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            </div>

            <Button type="submit" variant="gold" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'دخول'}
            </Button>
          </form>
          {offlineReady && (
            <button
              type="button"
              onClick={() => navigate('/pos', { replace: true })}
              className="mt-4 min-h-12 w-full rounded-xl border border-amber-400/50 bg-amber-400/10 font-bold text-amber-100"
            >
              فتح نقطة البيع دون إنترنت
            </button>
          )}
        </motion.div>
      </div>
    </>
  );
}
