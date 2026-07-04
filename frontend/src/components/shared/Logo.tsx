import { cn } from '@/lib/utils';

interface LogoProps {
  name?: string;
  logoUrl?: string | null;
  className?: string;
  imgClassName?: string;
}

/** Restaurant logo — image when available, else the elegant Arabic wordmark. */
export function Logo({ name = 'روقان', logoUrl, className, imgClassName }: LogoProps) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} className={cn('h-12 w-auto object-contain', imgClassName)} />;
  }
  return (
    <span className={cn('font-display text-2xl font-bold tracking-tight', className)}>
      {name}
    </span>
  );
}
