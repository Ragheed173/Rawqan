import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/shared/Seo';

export default function NotFoundPage() {
  return (
    <>
      <Seo title="الصفحة غير موجودة" />
      <div className="grid min-h-[70vh] place-items-center px-4 pt-20">
        <div className="text-center">
          <p className="font-display text-8xl font-bold text-accent-ink">404</p>
          <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
            الصفحة غير موجودة
          </h1>
          <p className="mt-2 text-muted-foreground">عذراً، لم نتمكن من العثور على ما تبحث عنه.</p>
          <Button asChild variant="gold" className="mt-8">
            <Link to="/">العودة للرئيسية</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
