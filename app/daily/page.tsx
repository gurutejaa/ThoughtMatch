"use client";

import { useEffect, useState } from "react";
import QuestionCard, { QuestionType } from "@/components/QuestionCard";
import { getRouteForUser } from "@/lib/routing";
import { usePreviewMode } from "@/lib/preview";
import { supabase } from "@/lib/supabase";

type Question = {
  id: string;
  text: string;
  question_type?: QuestionType | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type AnswerValue = number | string | null;

type BatchStatusResponse = {
  id?: string | null;
  status?: string | null;
  registration_closes_at?: string | null;
  question_closes_at?: string | null;
  reveal_ready?: boolean;
  current_time?: string;
};

export default function Daily() {
  const previewMode = usePreviewMode();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [responseValue, setResponseValue] = useState<AnswerValue>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackPercent, setFeedbackPercent] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [questionsClosed, setQuestionsClosed] = useState(false);
  const [completedAllQuestions, setCompletedAllQuestions] = useState(false);

  useEffect(() => {
    async function init() {
      if (previewMode) {
        setUserId("preview-user");
        setQuestions([
          {
            id: "preview-1",
            question_type: "slider",
            text: "When making decisions, you tend to...",
            option_a: "Fully instinct",
            option_b: "Fully logical",
            option_c: "",
            option_d: ""
          },
          {
            id: "preview-2",
            question_type: "options",
            text: "When it comes to daily habits and routines, you...",
            option_a: "I follow the same routine every day — structure keeps me grounded",
            option_b: "I have a loose routine but adjust it based on how I feel",
            option_c: "I change things up often — repetition drains me",
            option_d: "I have no real routine — I just go with whatever the day brings"
          },
          {
            id: "preview-3",
            question_type: "binary",
            text: "Which feels more meaningful to you?",
            option_a: "Loving someone deeply",
            option_b: "Being loved by someone",
            option_c: "",
            option_d: ""
          },
          {
            id: "preview-4",
            question_type: "short_text",
            text: "The advice you would give to someone you love most is...",
            option_a: "Type your answer — up to 100 characters",
            option_b: "",
            option_c: "",
            option_d: ""
          },
          {
            id: "preview-5",
            question_type: "fill_blank",
            text: "For an adventure, you would pick someone who is ___",
            option_a: "Type a short word or phrase",
            option_b: "",
            option_c: "",
            option_d: ""
          }
        ]);
        setStatusMessage(null);
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        setStatusMessage("Sign in to answer questions.");
        return;
      }

      setUserId(user.id);

      const { data: activeBatch } = await supabase
        .from("batches")
        .select("id, status, registration_closes_at, question_closes_at, reveal_ready")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const route = await getRouteForUser(user.id, activeBatch);

      if (!activeBatch?.id) {
        setStatusMessage("There is no active batch right now.");
        return;
      }

      setBatchId(activeBatch.id);

      if (route === "register") {
        setStatusMessage("You are not in the active batch.");
        return;
      }

      if (route !== "daily") {
        const now = Date.now();
        const questionClosesAt = activeBatch.question_closes_at ? new Date(activeBatch.question_closes_at).getTime() : null;

        if (activeBatch.reveal_ready) {
          setStatusMessage("Your reveal is live. Reopen the app home to continue.");
        } else if (questionClosesAt && now >= questionClosesAt) {
          setQuestionsClosed(true);
          setStatusMessage("Questions are closed. Results are being prepared.");
        } else {
          setStatusMessage("Questions have not opened yet.");
        }
        return;
      }

      const { data: qs } = await supabase.from("questions").select("*").order("day_number").order("order_in_day");
      const { data: answered } = await supabase
        .from("answers")
        .select("question_id")
        .eq("user_id", user.id)
        .eq("batch_id", activeBatch.id);

      const answeredIds = new Set((answered ?? []).map((answer: { question_id: string }) => answer.question_id));
      const remaining = (qs ?? []).filter((question: Question) => !answeredIds.has(question.id));

      if (remaining.length === 0) {
        setCompletedAllQuestions(true);
        setQuestions([]);
        setStatusMessage("You completed all questions. Results are being prepared.");
        return;
      }

      setQuestions(remaining);
      setCurrent(0);
      setResponseValue(null);
      setIsSubmitting(false);
      setFeedbackPercent(null);
      setCompletedAllQuestions(false);
      setQuestionsClosed(false);
      setStatusMessage(null);
    }

    void init();
  }, [previewMode]);

  useEffect(() => {
    if (previewMode || !batchId) return;

    async function pollBatchStatus() {
      try {
        const response = await fetch("/api/batch-status", { cache: "no-store" });
        const payload = (await response.json()) as BatchStatusResponse;

        if (!response.ok) {
          return;
        }

        const serverNow = payload.current_time ? new Date(payload.current_time).getTime() : Date.now();
        const questionClosesAt = payload.question_closes_at ? new Date(payload.question_closes_at).getTime() : null;

        if (
          payload.id === batchId &&
          questionClosesAt !== null &&
          !Number.isNaN(questionClosesAt) &&
          serverNow >= questionClosesAt
        ) {
          setQuestionsClosed(true);
          setStatusMessage("Questions are closed. Results are being prepared.");
        }
      } catch {
        // keep the current question flow if polling fails
      }
    }

    const interval = window.setInterval(() => {
      void pollBatchStatus();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [batchId, previewMode]);

  function advanceToNextQuestion(delayMs: number) {
    window.setTimeout(() => {
      setResponseValue(null);
      setFeedbackPercent(null);
      setIsSubmitting(false);

      if (current + 1 >= questions.length) {
        setCompletedAllQuestions(true);
        setQuestions([]);
        setStatusMessage("You completed all questions. Results are being prepared.");
        return;
      }

      setCurrent((value) => value + 1);
    }, delayMs);
  }

  async function handleSubmitAnswer(value: number | string) {
    if (isSubmitting || (!userId && !previewMode) || (!batchId && !previewMode) || questions.length === 0) return;

    const activeQuestion = questions[current];
    const normalizedType = (activeQuestion.question_type ?? "multiple_choice") as QuestionType;
    const isTextAnswer = normalizedType === "short_text" || normalizedType === "fill_blank";
    const isBinaryOrOptions =
      normalizedType === "binary" || normalizedType === "options" || normalizedType === "multiple_choice";
    const trimmedText = typeof value === "string" ? value.trim() : "";

    if (isTextAnswer && trimmedText.length === 0) return;

    setIsSubmitting(true);
    setResponseValue(value);
    setFeedbackPercent(isBinaryOrOptions ? Math.floor(Math.random() * 44) + 18 : null);

    if (!previewMode) {
      try {
        const { error } = await supabase.from("answers").insert({
          user_id: userId,
          batch_id: batchId,
          question_id: activeQuestion.id,
          answer_index: typeof value === "number" ? value : null,
          answer_text: typeof value === "string" ? trimmedText : null
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

    advanceToNextQuestion(isBinaryOrOptions ? 1800 : 600);
  }

  const currentQuestion = questions[current];

  if (statusMessage && (questionsClosed || completedAllQuestions || !currentQuestion)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-[var(--muted)]">{statusMessage}</p>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-[var(--muted)]">{statusMessage ?? "Loading today's questions..."}</p>
      </main>
    );
  }

  const questionType = (currentQuestion?.question_type ?? "multiple_choice") as QuestionType;
  const options = currentQuestion
    ? [currentQuestion.option_a, currentQuestion.option_b, currentQuestion.option_c, currentQuestion.option_d].filter(
        (option) => Boolean(option && option.trim())
      )
    : [];

  return (
    <main className="flex min-h-screen justify-center bg-white px-6 pt-6">
      <div className="w-full max-w-[420px]">
        <QuestionCard
          question={currentQuestion.text}
          questionType={questionType}
          options={options}
          value={responseValue}
          disabled={isSubmitting}
          onChange={(value) => setResponseValue(value)}
          onSubmit={handleSubmitAnswer}
        />

        {feedbackPercent !== null ? (
          <p className="mt-6 text-center text-[13px] text-black">{feedbackPercent}% of people chose this</p>
        ) : null}

        <div className="mt-8 flex items-center justify-center text-[13px] text-black">
          <span>
            {current + 1} of {questions.length}
          </span>
        </div>
      </div>
    </main>
  );
}
