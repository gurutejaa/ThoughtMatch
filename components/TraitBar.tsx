import { formatCategoryName } from "@/lib/matching";

type TraitBarProps = {
  label: string;
  value: number;
};

export default function TraitBar({ label, value }: TraitBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted)]">{formatCategoryName(label)}</span>
        <span className="font-medium text-[var(--foreground)]">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[rgba(34,20,14,0.08)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-soft))]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
