"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

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
        className="inline-flex h-9 items-center gap-1 rounded-md border border-[#FDE5D4] bg-white px-3 text-[13px] font-medium text-[#78716C] transition-all duration-200 ease-in-out hover:border-[#C2410C] hover:bg-[#FFF7ED] hover:text-[#C2410C] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
      >
        <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
        <span>{isPending ? "Refreshing..." : "Refresh Data"}</span>
      </button>

      <label className="flex items-center gap-2 text-[13px] text-[#78716C]">
        <span>Auto-refresh every</span>
        <input
          type="number"
          min="1"
          value={seconds}
          onChange={(event) => setSeconds(Math.max(1, Number(event.target.value) || 10))}
          className="h-9 w-14 rounded-md border border-[#FDE5D4] bg-white px-2 text-center text-[13px] text-[#292524] outline-none"
        />
        <span>sec</span>
      </label>
    </div>
  );
}
