import { useEffect, useRef } from 'react';

/**
 * Fades `.reveal` descendants in as they scroll into view. Content stays visible
 * when IntersectionObserver is unavailable, because hiding only starts once this runs.
 */
export function useReveal<T extends HTMLElement>() {
  const root = useRef<T>(null);
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const targets = node.querySelectorAll<HTMLElement>('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    targets.forEach((target) => observer.observe(target));
    node.classList.add('reveal-ready');
    return () => observer.disconnect();
  }, []);
  return root;
}
