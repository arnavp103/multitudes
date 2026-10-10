"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Poll only while work is pending; refresh reads durable state after reconnects. */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);
  return (
    <button className="secondary" onClick={() => router.refresh()}>
      Refresh
    </button>
  );
}
