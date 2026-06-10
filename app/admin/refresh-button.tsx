"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(() => {
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1 rounded-md border border-[#222222] bg-[#0f0f0f] px-2.5 py-1.5 text-[0.75rem] text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isPending}
    >
      <span aria-hidden="true">↻</span>
      <span>{isPending ? "Refreshing..." : "Refresh Data"}</span>
    </button>
  );
}
