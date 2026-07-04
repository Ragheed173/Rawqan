import { Logo } from './Logo';

/** Full-viewport branded loader used as Suspense fallback for lazy routes. */
export function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo className="animate-pulse text-4xl text-foreground" />
        <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-[shimmer_1.2s_infinite] bg-accent" />
        </div>
      </div>
    </div>
  );
}
