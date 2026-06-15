import { buildCategoryReasons, buildInsights, buildMatchSummary, CategoryScores, formatCategoryName, topCategories, weakestCategory } from "@/lib/matching";

type MatchRevealProps = {
  score: number;
  matchUser: {
    name?: string | null;
    instagram_handle?: string | null;
    zodiac?: string | null;
  } | null;
  categoryScores: CategoryScores;
  summary?: string | null;
  reasons?: string[];
  sharedAnswerCount?: number | null;
  partnerOffer?: {
    partner_name?: string | null;
    offer_title?: string | null;
    offer_description?: string | null;
  } | null;
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
  partnerOffer,
  revealed,
  onReveal,
  onCopy
}: MatchRevealProps) {
  const strongest = topCategories(categoryScores, 3);
  const weakest = weakestCategory(categoryScores);
  const insights = reasons.length > 0 ? reasons : [...buildCategoryReasons(categoryScores, 3), ...buildInsights(categoryScores)].slice(0, 3);
  const summaryText = summary ?? buildMatchSummary(categoryScores, sharedAnswerCount ?? undefined);
  const affirmingSentence = insights[0] ?? summaryText;
  const challengeSentence = weakest
    ? `One honest difference may show up around ${formatCategoryName(weakest[0]).toLowerCase()}, where you could challenge each other to grow.`
    : "One honest difference may still show up in pace or style, which can make the connection more real if handled with care.";

  return (
    <div className="min-h-screen bg-[#FEF7F0] px-6 py-12 text-[#292524]">
      <div className="mx-auto max-w-[680px]">
        <div className="space-y-4 rounded-[24px] border border-[#FDE5D4] bg-white px-6 py-8 shadow-[0_12px_32px_rgba(0,0,0,0.04)]">
          <div
            className="text-center opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
            style={{ animationDelay: "0ms" }}
          >
            <p className="text-sm text-[#78716C]">You matched with</p>
            <div
              className="mt-3 text-[2.5rem] font-medium leading-none text-[#292524] sm:text-[3rem]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {matchUser?.name ?? "Pending reveal"}
            </div>
            <p className="mt-3 text-sm text-[#78716C]">{matchUser?.zodiac ?? "Zodiac sign on file"}</p>
          </div>

          <div
            className="text-center opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
            style={{ animationDelay: "300ms" }}
          >
            <div className="text-[3rem] font-bold leading-none text-[#C2410C]">{score}%</div>
            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[#78716C]">Compatibility</p>
          </div>

          <div
            className="space-y-2 text-center opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
            style={{ animationDelay: "600ms" }}
          >
            <p className="text-sm italic leading-6 text-[#78716C]">{affirmingSentence}</p>
            <p className="text-sm italic leading-6 text-[#78716C]">{challengeSentence}</p>
          </div>

          <section
            className="rounded-2xl border border-[#FDE5D4] bg-[#FFFCF8] p-5 opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
            style={{ animationDelay: "900ms" }}
          >
            <p className="text-[13px] font-semibold text-[#292524]">Top alignment</p>
            <div className="mt-4 space-y-4">
              {strongest.map(([category, value]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[#292524]">{formatCategoryName(category)}</span>
                    <span className="text-[#78716C]">{value}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#FDE5D4]">
                    <div
                      className="h-full rounded-full bg-[#C2410C] transition-all duration-700 ease-out"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {partnerOffer?.partner_name && partnerOffer.offer_title ? (
            <section
              className="rounded-2xl border border-[#FDE5D4] bg-white p-5 opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
              style={{ animationDelay: "1200ms" }}
            >
              <p className="text-[13px] font-semibold text-[#292524]">{partnerOffer.partner_name}</p>
              <p className="mt-2 text-sm font-medium text-[#292524]">{partnerOffer.offer_title}</p>
              {partnerOffer.offer_description ? (
                <p className="mt-2 text-sm leading-6 text-[#78716C]">{partnerOffer.offer_description}</p>
              ) : null}
            </section>
          ) : null}

          <section
            className="rounded-2xl border border-[#FDE5D4] bg-white p-5 opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
            style={{ animationDelay: partnerOffer?.partner_name && partnerOffer.offer_title ? "1500ms" : "1200ms" }}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-[#78716C]">Contact</p>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#FDE5D4] bg-[#FFFCF8] px-4 py-3">
              <span className={revealed ? "text-sm font-medium text-[#292524]" : "select-none text-sm font-medium text-[#292524] blur-sm"}>
                @{matchUser?.instagram_handle ?? "thoughtmatch"}
              </span>
              {revealed ? (
                <button
                  type="button"
                  onClick={onCopy}
                  className="rounded-full border border-[#FDE5D4] px-3 py-1.5 text-xs font-medium text-[#292524] transition-all duration-200 ease-in-out hover:border-[#C2410C] hover:text-[#C2410C]"
                >
                  Copy
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onReveal}
                  className="rounded-full bg-[#C2410C] px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 ease-in-out hover:bg-[#9A3412]"
                >
                  Tap to reveal
                </button>
              )}
            </div>
          </section>

          <div
            className="pt-2 text-center text-xs text-[#78716C] opacity-0 [animation:fadeReveal_600ms_ease_forwards]"
            style={{ animationDelay: partnerOffer?.partner_name && partnerOffer.offer_title ? "1800ms" : "1500ms" }}
          >
            Phone verified · Completed all questions · Based on 8 responses
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeReveal {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
