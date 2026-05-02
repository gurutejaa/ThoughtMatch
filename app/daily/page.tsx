"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Silhouette from "@/components/Silhouette";
import { usePreviewMode, withPreview } from "@/lib/preview";
import { supabase } from "@/lib/supabase";

type Question = {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

export default function Daily() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedbackPercent, setFeedbackPercent] = useState<number | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [phase, setPhase] = useState<"questions" | "post">("questions");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (previewMode) {
        setUserId("preview-user");
        setDayNumber(1);
        setQuestions([
          {
            id: "preview-1",
            text: "When life suddenly goes off plan, what do you usually do first?",
            option_a: "Pause, think clearly, and make a plan.",
            option_b: "Call someone you trust.",
            option_c: "Act fast and solve it immediately.",
            option_d: "Step away for a moment and reset."
          },
          {
            id: "preview-2",
            text: "What usually matters most when you make a big decision?",
            option_a: "Logic and long-term clarity.",
            option_b: "How it feels emotionally.",
            option_c: "Advice from the right people.",
            option_d: "Momentum in the moment."
          }
        ]);
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/register");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase.from("users").select("batch_id").eq("id", user.id).single();
      if (!profile?.batch_id) {
        router.push("/waiting");
        return;
      }

      const { data: batch } = await supabase
        .from("batches")
        .select("start_date")
        .eq("id", profile.batch_id)
        .single();

      if (!batch?.start_date) {
        router.push("/waiting");
        return;
      }

      const start = new Date(batch.start_date + "T00:00:00Z");
      const nowUTC = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
      const diff = Math.floor((nowUTC.getTime() - start.getTime()) / 86400000);
      const day = Math.min(3, Math.max(1, diff + 1));

      setDayNumber(day);

      const { data: qs } = await supabase.from("questions").select("*").eq("day_number", day).order("order_in_day");
      const { data: answered } = await supabase.from("answers").select("question_id").eq("user_id", user.id);

      const answeredIds = new Set((answered ?? []).map((answer: { question_id: string }) => answer.question_id));
      const remaining = (qs ?? []).filter((question: Question) => !answeredIds.has(question.id));

      if (remaining.length === 0) {
        setPhase("post");
        return;
      }

      setQuestions(remaining);
    }

    init();
  }, [previewMode, router]);

  async function handleAnswer(index: number) {
    if (selected !== null || (!userId && !previewMode) || questions.length === 0) return;

    setSelected(index);
    setFeedbackPercent(Math.floor(Math.random() * 44) + 18);

    if (!previewMode) {
      try {
        const { error } = await supabase.from("answers").insert({
          user_id: userId,
          question_id: questions[current].id,
          answer_index: index
        });

        if (error && error.code !== "23505") {
          throw error;
        }
      } catch (insertError) {
        const maybeError = insertError as { code?: string } | null;
        if (maybeError?.code !== "23505") {
          throw insertError;
        }
      }
    }

    window.setTimeout(() => {
      setSelected(null);
      setFeedbackPercent(null);

      if (current + 1 >= questions.length) {
        if (dayNumber === 3 || previewMode) {
          router.push(withPreview("/reveal", previewMode));
          return;
        }

        setPhase("post");
      } else {
        setCurrent((value) => value + 1);
      }
    }, 1800);
  }

  const currentQuestion = questions[current];
  const options = currentQuestion
    ? [currentQuestion.option_a, currentQuestion.option_b, currentQuestion.option_c, currentQuestion.option_d]
    : [];

  const blurAmount = dayNumber === 1 ? "xl" : dayNumber === 2 ? "md" : "sm";
  const progressText = dayNumber === 1 ? "~35%" : dayNumber === 2 ? "~65%" : "~90%";
  const footerText =
    dayNumber === 1 ? "Come back tomorrow. It gets clearer." : dayNumber === 2 ? "Final reveal tomorrow." : "";

  if (phase === "post") {
    return (
      <main className="flex min-h-screen items-center px-6 py-10">
        <div className="tm-shell text-center">
          <p className="tm-kicker text-sm text-[var(--muted)]">Day {dayNumber} of 3</p>
          <div className="mt-8">
            <Silhouette blur={blurAmount} />
          </div>
          <h1 className="mt-8 text-3xl font-semibold text-[var(--foreground)]">
            Match forming... {progressText}
          </h1>
          <p className="tm-whisper mt-2 text-lg text-[var(--accent-deep)]">Each answer improves how your compatibility is measured.</p>
          {dayNumber === 2 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Strong alignment detected in mindset and emotional style.</p>
          ) : null}
          <p className="mt-5 text-sm text-[var(--muted)]">{footerText}</p>
        </div>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-[var(--muted)]">Loading today's questions...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center bg-white px-6 pt-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center justify-between text-[13px] text-black">
          <span>Day {dayNumber} of 3</span>
          <span>{current + 1} of {questions.length}</span>
        </div>

        <div className="mx-auto mt-12 max-w-[340px] text-center text-[22px] leading-[1.4] font-medium text-black sm:text-2xl">
          {currentQuestion.text}
        </div>

        <div className="mt-12 space-y-3">
          {options.map((option, index) => {
            const isSelected = selected === index;
            const isDimmed = selected !== null && !isSelected;

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleAnswer(index)}
                disabled={selected !== null}
                className={[
                  "w-full rounded-2xl border px-5 py-[18px] text-left text-[15px] font-normal transition",
                  isSelected ? "border-black bg-black text-white" : "border-[#e5e5e5] bg-white text-black hover:border-black hover:bg-black hover:text-white",
                  isDimmed ? "cursor-default opacity-50" : "",
                  isSelected ? "opacity-100" : ""
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>

        {feedbackPercent !== null ? (
          <p className="mt-6 text-center text-[13px] text-black">{feedbackPercent}% of people chose this</p>
        ) : null}
      </div>
    </main>
  );
}
