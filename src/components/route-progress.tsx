import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Thin top progress bar shown while TanStack Router is loading a new match
 * (loaders running, pending components, transitions).
 */
export function RouteProgress() {
  const isNavigating = useRouterState({
    select: (s) => s.isLoading || s.isTransitioning,
  });

  // Delay showing so instant navigations don't flash the bar.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!isNavigating) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), 120);
    return () => window.clearTimeout(t);
  }, [isNavigating]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
    >
      <div className="route-progress-bar h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_hsl(var(--primary))]" />
      <style>{`
        @keyframes route-progress-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .route-progress-bar {
          animation: route-progress-slide 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
