"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, seconds * 1000);

    return () => window.clearInterval(interval);
  }, [router, seconds, startTransition]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() =>
          startTransition(() => {
            router.refresh();
          })
        }
        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#222222] bg-[#0f0f0f] px-2.5 text-[0.75rem] font-medium text-white/72 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
      >
        <span aria-hidden="true">↻</span>
        <span>{isPending ? "Refreshing..." : "Refresh Data"}</span>
      </button>

      <label className="flex items-center gap-2 text-[0.75rem] text-white/48">
        <span>Auto-refresh every</span>
        <input
          type="number"
          min="1"
          value={seconds}
          onChange={(event) => setSeconds(Math.max(1, Number(event.target.value) || 10))}
          className="h-8 w-14 rounded-md border border-[#222222] bg-[#0f0f0f] px-2 text-center text-[0.75rem] text-white outline-none"
        />
        <span>sec</span>
      </label>
    </div>
  );
}
