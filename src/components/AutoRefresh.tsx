"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the page on an interval while it waits on background work. */
export function AutoRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
