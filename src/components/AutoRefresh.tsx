"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the page on an interval while it waits on background work. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
