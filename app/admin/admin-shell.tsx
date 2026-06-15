"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Layers3,
  PlayCircle,
  Settings2,
  Sparkles,
  TimerReset,
  Users
} from "lucide-react";

type AdminShellProps = {
  children: React.ReactNode;
};

const groups = [
  {
    label: "Batch",
    items: [
      { icon: Layers3, text: "Active Batch", view: "active-batch" },
      { icon: Users, text: "Participants", view: "participants" },
      { icon: TimerReset, text: "Timeline", view: "timeline" }
    ]
  },
  {
    label: "Controls",
    items: [
      { icon: Settings2, text: "Operations", view: "operations" },
      { icon: Gauge, text: "Dashboard", view: "dashboard" }
    ]
  },
  {
    label: "Matching",
    items: [
      { icon: Activity, text: "Run Matching", view: "run-matching" },
      { icon: PlayCircle, text: "Reveal", view: "reveal" },
      { icon: Sparkles, text: "Results", view: "results" }
    ]
  }
];

export default function AdminShell({ children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") ?? "active-batch";

  return (
    <div className="min-h-screen bg-[#FEF7F0] text-[#292524]">
      <aside
        className="fixed inset-y-0 left-0 z-20 border-r border-[#FDE5D4] bg-white transition-all duration-200 ease-in-out"
        style={{ width: collapsed ? 56 : 220 }}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="flex items-center justify-between">
            <div className={`overflow-hidden transition-all duration-200 ${collapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
              <p className="text-[13px] font-semibold text-[#292524]">ThoughtMatch</p>
              <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Admin</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#FDE5D4] bg-[#FEF7F0] text-[#78716C] transition-all duration-200 ease-in-out hover:border-[#C2410C] hover:text-[#C2410C]"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <div className="mt-6 flex-1 space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <p
                  className={`mb-2 text-[10px] uppercase tracking-[0.08em] text-[#A8A29E] transition-all duration-200 ${collapsed ? "opacity-0" : "opacity-100"}`}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.view;
                    return (
                      <Link
                        key={item.text}
                        href={`/admin?view=${item.view}`}
                        className={`flex h-9 items-center gap-3 rounded-md px-2 transition-all duration-200 ease-in-out ${
                          isActive
                            ? "bg-[#FFF7ED] text-[#C2410C]"
                            : "text-[#78716C] hover:bg-[#FEF7F0] hover:text-[#C2410C]"
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span
                          className={`whitespace-nowrap text-[13px] transition-all duration-200 ${collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100"}`}
                        >
                          {item.text}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main
        className="min-h-screen transition-all duration-200 ease-in-out"
        style={{ marginLeft: collapsed ? 56 : 220 }}
      >
        <div className="min-h-screen p-4">
          <div className="rounded-xl border border-[#FDE5D4] bg-[#FEF7F0]">{children}</div>
        </div>
      </main>
    </div>
  );
}
