import clsx from "clsx";

export type QuestionType = "multiple_choice" | "options" | "binary" | "slider" | "short_text" | "fill_blank";

type QuestionCardProps = {
  question: string;
  questionType: QuestionType;
  options: string[];
  value: number | string | null;
  disabled?: boolean;
  onChange: (value: number | string) => void;
  onSubmit: (value: number | string) => void;
};

function renderInlineBlank(
  question: string,
  value: string,
  disabled: boolean,
  onChange: (value: string) => void
) {
  if (!question.includes("___")) {
    return (
      <input
        type="text"
        maxLength={50}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type your answer"
        className="mt-12 w-full rounded-2xl border border-black/10 bg-white px-4 py-4 text-[15px] text-black outline-none placeholder:text-black/40"
      />
    );
  }

  const [before, after] = question.split("___");

  return (
    <div className="mt-12 text-center text-[25px] font-extrabold leading-[1.35] text-black sm:text-[28px]">
      <span>{before}</span>
      <input
        type="text"
        maxLength={50}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mx-2 inline-block min-w-[140px] border-b border-black bg-transparent px-2 py-1 text-center text-[18px] outline-none"
      />
      <span>{after}</span>
    </div>
  );
}

export default function QuestionCard({
  question,
  questionType,
  options,
  value,
  disabled = false,
  onChange,
  onSubmit
}: QuestionCardProps) {
  const normalizedType = questionType === "multiple_choice" ? "options" : questionType;
  const textValue = typeof value === "string" ? value : "";
  const sliderValue = typeof value === "number" ? value : 50;
  const choiceValue = typeof value === "number" ? value : null;
  const leftLabel = options[0] ?? "Low";
  const rightLabel = options[1] ?? "High";
  const shortTextMax = normalizedType === "fill_blank" ? 50 : 100;
  const isRedBlueQuestion =
    normalizedType === "binary" &&
    options.length >= 2 &&
    options[0].toLowerCase().includes("red pill") &&
    options[1].toLowerCase().includes("blue pill");

  return (
    <section className="mt-12">
      <div className="mx-auto max-w-[340px] text-center text-[25px] font-extrabold leading-[1.35] text-black sm:text-[28px]">
        {normalizedType === "fill_blank" && question.includes("___") ? null : question}
      </div>

      {normalizedType === "options" ? (
        <div className="mt-12 space-y-3">
          {options.map((option, index) => {
            const isSelected = choiceValue === index;
            const isDimmed = choiceValue !== null && !isSelected;

            return (
              <button
                key={`${option}-${index}`}
                type="button"
                onClick={() => onSubmit(index)}
                disabled={disabled}
                className={clsx(
                  "w-full rounded-2xl border px-5 py-[18px] text-left text-[15px] font-normal transition",
                  isSelected
                    ? "border-black bg-black text-white"
                    : "border-[#e5e5e5] bg-white text-black hover:border-black hover:bg-black hover:text-white",
                  isDimmed ? "cursor-default opacity-50" : "",
                  disabled ? "cursor-default" : ""
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}

      {normalizedType === "binary" ? (
        <div className="mt-12 grid grid-cols-2 gap-3">
          {options.slice(0, 2).map((option, index) => {
            const isSelected = choiceValue === index;
            const isRedOption = isRedBlueQuestion && index === 0;
            const isBlueOption = isRedBlueQuestion && index === 1;

            return (
              <button
                key={`${option}-${index}`}
                type="button"
                onClick={() => onSubmit(index)}
                disabled={disabled}
                className={clsx(
                  "rounded-2xl border px-4 py-6 text-center text-[15px] font-normal transition",
                  isSelected
                    ? isRedOption
                      ? "border-red-600 bg-red-600 text-white"
                      : isBlueOption
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-black bg-black text-white"
                    : isRedOption
                      ? "border-red-200 bg-white text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white"
                      : isBlueOption
                        ? "border-blue-200 bg-white text-black hover:border-blue-600 hover:bg-blue-600 hover:text-white"
                        : "border-[#e5e5e5] bg-white text-black hover:border-black hover:bg-black hover:text-white",
                  disabled ? "cursor-default" : ""
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}

      {normalizedType === "slider" ? (
        <div className="mt-12">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            value={sliderValue}
            onChange={(event) => onChange(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10"
          />
          <div className="mt-4 flex items-start justify-between gap-4 text-[13px] text-black/70">
            <span className="max-w-[120px] text-left">{leftLabel}</span>
            <span className="text-center font-medium text-black">{sliderValue}</span>
            <span className="max-w-[120px] text-right">{rightLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => onSubmit(sliderValue)}
            disabled={disabled}
            className="mt-8 w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}

      {normalizedType === "short_text" ? (
        <div className="mt-12">
          <textarea
            maxLength={shortTextMax}
            disabled={disabled}
            value={textValue}
            onChange={(event) => onChange(event.target.value)}
            placeholder={options[0] || "Type your answer"}
            className="min-h-[120px] w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-4 text-[15px] text-black outline-none placeholder:text-black/40"
          />
          <div className="mt-3 text-right text-[12px] text-black/50">{textValue.length}/{shortTextMax}</div>
          <button
            type="button"
            onClick={() => onSubmit(textValue)}
            disabled={disabled || textValue.trim().length === 0}
            className="mt-6 w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}

      {normalizedType === "fill_blank" ? (
        <div>
          {renderInlineBlank(question, textValue, disabled, (nextValue) => onChange(nextValue))}
          {!question.includes("___") ? (
            <div className="mt-3 text-right text-[12px] text-black/50">{textValue.length}/50</div>
          ) : null}
          <button
            type="button"
            onClick={() => onSubmit(textValue)}
            disabled={disabled || textValue.trim().length === 0}
            className="mt-8 w-full rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}
    </section>
  );
}
