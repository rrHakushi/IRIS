"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Tracks the user's active application in a cookie (`iris_last_app`).
 * Used when visiting root (`/`) to redirect the user back to their last used application.
 */
export function LastAppTracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/") return;

    // Do not record authentication flows as last used apps
    if (pathname.includes("/auth/")) return;

    // Detect if we are inside a known app (e.g. /IRIS-list, /IRIS-account, etc.)
    if (pathname.startsWith("/IRIS-") || pathname.startsWith("/list")) {
      document.cookie = `iris_last_app=${encodeURIComponent(
        pathname
      )}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    }
  }, [pathname]);

  return null;
}
