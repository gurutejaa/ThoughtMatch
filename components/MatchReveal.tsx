import TraitBar from "@/components/TraitBar";
import { buildCategoryReasons, buildInsights, buildMatchSummary, CategoryScores, formatCategoryName, topCategories, weakestCategory } from "@/lib/matching";

type MatchRevealProps = {
  score: number;
  matchUser: {
    name?: string | null;
    instagram_handle?: string | null;
  } | null;
  categoryScores: CategoryScores;
  summary?: string | null;
  reasons?: string[];
  sharedAnswerCount?: number | null;
  revealed: boolean;
  onReveal: () => void;
  onCopy: () => void;
};

export default function MatchReveal({
  score,
  matchUser,
  categoryScores,
  summary,
  reasons = [],
  sharedAnswerCount,
  revealed,
  onReveal,
  onCopy
}: MatchRevealProps) {
  const strongest = topCategories(categoryScores, 3);
  const weakest = weakestCategory(categoryScores);
  const insights = reasons.length > 0 ? reasons : [...buildCategoryReasons(categoryScores, 3), ...buildInsights(categoryScores)].slice(0, 3);
  const summaryText = summary ?? buildMatchSummary(categoryScores, sharedAnswerCount ?? undefined);

  return (
    <div className="tm-shell space-y-5 px-6 py-12">
      <div className="text-center">
        <p className="tm-kicker text-sm text-[var(--muted)]">Your match</p>
        <div className="mt-3 text-7xl font-semibold tracking-[-0.06em] text-[var(--foreground)]">{score}%</div>
        <p className="tm-whisper mt-3 text-xl text-[var(--accent-deep)]">This score reflects how strongly your answers aligned across the full match set.</p>
        <p className="mt-2 text-sm text-[var(--muted)]">You were selected for each other.</p>
      </div>

      <section className="tm-panel rounded-[2rem] p-5">
        <p className="tm-kicker text-xs text-[var(--muted)]">Summary</p>
        <p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{summaryText}</p>
      </section>

      <section className="tm-panel rounded-[2rem] p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {strongest.map(([category, value]) => (
            <span
              key={category}
              className="rounded-full px-3 py-1 text-xs font-medium text-[var(--accent-deep)]"
              style={{ backgroundColor: "var(--chip-background)" }}
            >
              {formatCategoryName(category)} {value}%
            </span>
          ))}
        </div>

        {weakest ? (
          <p className="text-xs text-[var(--muted)]">You differ most in: {formatCategoryName(weakest[0])}</p>
        ) : null}

        <div className="mt-5 space-y-4">
          {strongest.map(([category, value]) => (
            <TraitBar key={category} label={category} value={value} />
          ))}
        </div>
      </section>

      <section
        className="rounded-[2rem] p-5 text-white shadow-[var(--shadow)]"
        style={{ backgroundImage: "linear-gradient(160deg,var(--hero-start),var(--hero-end))" }}
      >
        <p className="tm-kicker text-xs text-white/60">Why you matched</p>
        <div className="mt-3 space-y-2">
          {insights.slice(0, 3).map((insight) => (
            <p key={insight} className="text-sm leading-6 text-white/84">
              {insight}
            </p>
          ))}
        </div>
      </section>

      <section className="tm-panel rounded-[2rem] p-5">
        <p className="tm-kicker text-xs text-[var(--muted)]">Match</p>
        <p className="mt-2 text-lg font-medium text-[var(--foreground)]">{matchUser?.name ?? "Pending reveal"}</p>

        <div className="mt-5">
          <p className="tm-kicker text-xs text-[var(--muted)]">Instagram</p>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--background-strong)] px-4 py-3">
            <span className={revealed ? "text-sm font-medium" : "select-none text-sm font-medium blur-sm"}>
              @{matchUser?.instagram_handle ?? "thoughtmatch"}
            </span>
            {revealed ? (
              <button
                type="button"
                onClick={onCopy}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--foreground)]"
              >
                Copy
              </button>
            ) : (
              <button
                type="button"
                onClick={onReveal}
                className="rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-medium text-white"
              >
                Reveal
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-3 text-xs text-[var(--muted)]">
        <span>Phone verified</span>
        <span>Completed all questions</span>
        {sharedAnswerCount ? <span>Compared across {sharedAnswerCount} shared answers</span> : null}
        <span>Based on 8 responses</span>
      </div>
    </div>
  );
}
