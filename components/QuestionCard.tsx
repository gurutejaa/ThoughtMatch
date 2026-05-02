import clsx from "clsx";

type QuestionCardProps = {
  question: string;
  options: string[];
  selected: number | null;
  disabled?: boolean;
  onAnswer: (index: number) => void;
};

export default function QuestionCard({
  question,
  options,
  selected,
  disabled = false,
  onAnswer
}: QuestionCardProps) {
  return (
    <section className="tm-panel rounded-[2rem] p-6">
      <p className="mb-8 text-2xl font-semibold leading-snug text-[var(--foreground)]">{question}</p>
      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(index)}
            className={clsx(
              "w-full rounded-3xl border px-5 py-4 text-left text-sm transition",
              selected === index
                ? "border-[var(--accent-deep)] bg-[linear-gradient(135deg,var(--accent),var(--accent-deep))] text-white"
                : "border-[var(--line)] bg-[var(--background-strong)] text-[var(--foreground)] hover:border-[var(--accent)]"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}
