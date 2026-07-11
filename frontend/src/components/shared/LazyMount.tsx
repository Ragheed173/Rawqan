import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazyMountProps {
  children: ReactNode;
  /** Height reserved before mount so anchor scrolling and layout stay stable. */
  minHeight?: number;
  /** Anchor id exposed by the placeholder until the real section mounts. */
  placeholderId?: string;
}

/**
 * Defers mounting (and therefore code-loading) of below-the-fold sections
 * until the visitor shows intent: first scroll/touch/key, or the placeholder
 * actually approaches the viewport. Unlike bare React.lazy — whose import()
 * fires immediately during the first render — nothing behind this wrapper is
 * even DOWNLOADED on the initial route, which keeps motion-vendor out of the
 * Lighthouse trace entirely.
 */
export function LazyMount({ children, minHeight = 480, placeholderId }: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return;

    const reveal = () => setShow(true);
    const events: (keyof WindowEventMap)[] = ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown'];
    events.forEach((e) => window.addEventListener(e, reveal, { passive: true, once: true }));

    // Backstop for cases without interaction events (e.g. anchor navigation,
    // very tall viewports): mount when the placeholder nears the viewport.
    let io: IntersectionObserver | undefined;
    if (ref.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) reveal();
        },
        { threshold: 0.01 },
      );
      io.observe(ref.current);
    }

    return () => {
      events.forEach((e) => window.removeEventListener(e, reveal));
      io?.disconnect();
    };
  }, [show]);

  if (show) return <>{children}</>;
  return <div ref={ref} id={placeholderId} style={{ minHeight }} aria-hidden="true" />;
}
