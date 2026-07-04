import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';

/** Full-screen 500 fallback rendered by the ErrorBoundary (Task 22). */
export function ErrorPage({ onReset }: { onReset?: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <Logo className="text-3xl text-foreground" />
        <p className="mt-8 font-display text-7xl font-bold text-accent">500</p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">حدث خطأ غير متوقع</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          نعتذر عن ذلك. حدث خلل ما — يمكنك إعادة المحاولة أو العودة للرئيسية.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="gold" onClick={onReset ?? (() => window.location.reload())}>
            إعادة المحاولة
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}
