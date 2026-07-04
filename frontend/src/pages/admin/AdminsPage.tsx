import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Seo } from '@/components/shared/Seo';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useAdminUsers, adminKeys } from '@/hooks/admin/useAdminQueries';
import { adminUserService, type AdminInput } from '@/services/admin/admin.service';
import { getApiErrorMessage } from '@/lib/apiClient';
import { useAuthStore } from '@/store/auth';
import type { AdminUser } from '@/types';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'مدير عام' },
  { value: 'MANAGER', label: 'مدير' },
  { value: 'STAFF', label: 'موظف' },
] as const;

const schema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  email: z.string().email('بريد غير صالح'),
  password: z.string().min(8, '8 أحرف على الأقل'),
  role: z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF']),
});
type FormValues = z.infer<typeof schema>;

function roleBadge(role: string) {
  const variant = role === 'SUPER_ADMIN' ? 'gold' : role === 'MANAGER' ? 'default' : 'muted';
  const label = ROLES.find((r) => r.value === role)?.label ?? role;
  return <Badge variant={variant as 'gold'}>{label}</Badge>;
}

export default function AdminsPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.admin);
  const { data: admins, isLoading } = useAdminUsers();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'STAFF' },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: adminKeys.admins });

  const createMutation = useMutation({
    mutationFn: (data: AdminInput) => adminUserService.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('تمت إضافة المستخدم');
      setCreating(false);
      reset({ name: '', email: '', password: '', role: 'STAFF' });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: AdminUser['role']; isActive?: boolean } }) =>
      adminUserService.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('تم التحديث');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminUserService.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('تم حذف المستخدم');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <>
      <Seo title="المستخدمون" />
      <PageHeader
        title="المستخدمون والصلاحيات"
        subtitle="أدر فريقك وأدوارهم"
        action={
          <Button variant="gold" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> مستخدم جديد
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {admins?.map((a) => {
            const isSelf = a.id === me?.id;
            return (
              <Card key={a.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  {a.role === 'SUPER_ADMIN' ? <ShieldCheck className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{a.name}</span>
                    {roleBadge(a.role)}
                    {isSelf && <Badge variant="outline">أنت</Badge>}
                    {!a.isActive && <Badge variant="danger">معطّل</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground" dir="ltr">{a.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={a.role}
                    disabled={isSelf}
                    onChange={(e) => updateMutation.mutate({ id: a.id, data: { role: e.target.value as AdminUser['role'] } })}
                    className="h-9 rounded-lg border border-border bg-card px-2 text-sm disabled:opacity-50"
                    aria-label="الدور"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <Switch
                    checked={a.isActive}
                    disabled={isSelf}
                    onCheckedChange={(v) => updateMutation.mutate({ id: a.id, data: { isActive: v } })}
                    aria-label="مفعّل"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isSelf}
                    onClick={() => setDeleting(a)}
                    aria-label="حذف"
                    className="text-destructive hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>مستخدم جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-name">الاسم</Label>
              <Input id="a-name" {...register('name')} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-email">البريد الإلكتروني</Label>
              <Input id="a-email" type="email" dir="ltr" {...register('email')} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-pass">كلمة المرور</Label>
              <Input id="a-pass" type="password" {...register('password')} aria-invalid={!!errors.password} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-role">الدور</Label>
              <select id="a-role" {...register('role')} className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" variant="gold" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إضافة'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>إلغاء</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`حذف "${deleting?.name}"؟`}
        description="سيفقد هذا المستخدم صلاحية الوصول نهائياً."
        confirmLabel="حذف"
        onConfirm={async () => {
          if (deleting) await deleteMutation.mutateAsync(deleting.id);
        }}
      />
    </>
  );
}
