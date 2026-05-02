"use client";

type TimerArcProps = {
  value: number;
  total?: number;
  label?: string;
};

export default function TimerArc({ value, total = 10, label = "seconds left" }: TimerArcProps) {
  const normalized = Math.max(0, Math.min(total, value));
  const circumference = 2 * Math.PI * 42;
  const progress = (normalized / total) * circumference;

  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="42" stroke="rgba(34,20,14,0.08)" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r="42"
          stroke="url(#timerGradient)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
        <defs>
          <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d25a40" />
            <stop offset="100%" stopColor="#8f3422" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold text-[var(--foreground)]">{normalized}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{label}</span>
      </div>
    </div>
  );
}
