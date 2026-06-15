"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewMode } from "@/lib/preview";
import { getRouteForUser } from "@/lib/routing";
import { supabase } from "@/lib/supabase";

type WaitingState = {
  closesAt?: string | null;
  questionClosesAt?: string | null;
  status?: string | null;
  name?: string | null;
  batchId?: string | null;
  revealReady?: boolean | null;
  hasActiveMatch?: boolean | null;
};

type BatchStatusResponse = {
  id?: string | null;
  status?: string | null;
  registration_closes_at?: string | null;
  question_closes_at?: string | null;
  reveal_ready?: boolean;
  current_time?: string;
};

export default function Waiting() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [state, setState] = useState<WaitingState>({});
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    async function load() {
      if (previewMode) {
        setState({
          name: "Preview User",
          status: "active",
          closesAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
          questionClosesAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          revealReady: false,
          hasActiveMatch: false
        });
        return;
      }

      setIsCheckingUpdates(true);

      try {
        const {
          data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
          setState({});
          setMessage("Open registration to join the current batch.");
          return;
        }

        const { data: profile } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();

        const response = await fetch("/api/batch-status", { cache: "no-store" });
        const batchPayload = (await response.json()) as BatchStatusResponse;
        const currentBatchId = batchPayload.id ?? null;

        if (!currentBatchId) {
          setState({ name: profile?.name });
          setMessage("There is no active batch right now.");
          return;
        }

        let hasActiveMatch = false;
        if (batchPayload.reveal_ready) {
          const { data: match } = await supabase
            .from("matches")
            .select("id")
            .eq("batch_id", currentBatchId)
            .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
            .limit(1)
            .maybeSingle();

          hasActiveMatch = Boolean(match?.id);
        }

        const route = await getRouteForUser(user.id, {
          id: currentBatchId,
          status: batchPayload.status ?? null,
          registration_closes_at: batchPayload.registration_closes_at ?? null,
          question_closes_at: batchPayload.question_closes_at ?? null,
          reveal_ready: batchPayload.reveal_ready ?? false
        });

        setState({
          name: profile?.name,
          batchId: currentBatchId,
          closesAt: batchPayload.registration_closes_at ?? null,
          questionClosesAt: batchPayload.question_closes_at ?? null,
          revealReady: batchPayload.reveal_ready ?? false,
          status: batchPayload.status ?? null,
          hasActiveMatch
        });

        const registrationClosesAt = batchPayload.registration_closes_at
          ? new Date(batchPayload.registration_closes_at).getTime()
          : null;
        const questionClosesAt = batchPayload.question_closes_at
          ? new Date(batchPayload.question_closes_at).getTime()
          : null;
        const serverNow = batchPayload.current_time ? new Date(batchPayload.current_time).getTime() : Date.now();

        if (!Number.isNaN(serverNow)) {
          setNow(serverNow);
        }

        if (route === "register") {
          setMessage("You are not in the current active batch.");
        } else if (batchPayload.reveal_ready && !hasActiveMatch) {
          setMessage("You weren't matched this round. You're automatically in the next batch.");
        } else if (registrationClosesAt && serverNow < registrationClosesAt) {
          setMessage("Registration is open. Your spot is confirmed.");
        } else if (questionClosesAt && serverNow < questionClosesAt) {
          setMessage("Questions are live. Head to your questions now.");
        } else {
          setMessage("Your answers are in. Results are being prepared.");
        }
      } finally {
        setIsCheckingUpdates(false);
      }
    }

    void load();

    if (previewMode) return;

    const interval = window.setInterval(() => {
      void load();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [previewMode]);

  const registrationOpen = state.closesAt ? new Date(state.closesAt).getTime() > now : false;
  const questionsOpen =
    !registrationOpen &&
    state.questionClosesAt
      ? new Date(state.questionClosesAt).getTime() > now
      : false;
  const noMatchThisRound = Boolean(state.revealReady && state.hasActiveMatch === false);
  const batchStatusLabel = questionsOpen
    ? "Questions live"
    : registrationOpen
      ? "Registration open"
      : state.revealReady
        ? "Reveal phase"
        : "Waiting for results";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FEF7F0] px-6 py-10 text-[#292524]">
      <div className="tm-shell">
        <section className="rounded-[24px] border border-[#FDE5D4] bg-white px-6 py-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="text-center">
            <h1
              className="text-[2.5rem] font-medium leading-none text-[#292524]"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {state.name ?? "ThoughtMatch"}
            </h1>
            <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[#A8A29E]">{batchStatusLabel}</p>
          </div>

          {message ? <p className="mt-6 text-center text-[15px] leading-7 text-[#292524]">{message}</p> : null}

          <div className="mt-6 space-y-2 text-center text-[13px] text-[#78716C]">
            <p>
              Registration closes at:{" "}
              {state.closesAt ? new Date(state.closesAt).toLocaleString() : "Waiting for schedule"}
            </p>
            {questionsOpen ? (
              <p>
                Question window closes at:{" "}
                {state.questionClosesAt ? new Date(state.questionClosesAt).toLocaleString() : "Waiting for schedule"}
              </p>
            ) : null}
          </div>

          {questionsOpen ? (
            <button
              type="button"
              onClick={() => router.push("/daily")}
              className="mt-6 h-11 w-full rounded-lg bg-[#C2410C] px-4 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:bg-[#9A3412]"
            >
              Answer Questions
            </button>
          ) : null}

          {!questionsOpen && !registrationOpen && !noMatchThisRound && !state.revealReady ? (
            <p className="mt-6 text-center text-[13px] text-[#78716C]">Checking for updates...</p>
          ) : null}
          {isCheckingUpdates ? <p className="mt-4 text-center text-[12px] text-[#A8A29E]">Checking for updates...</p> : null}
        </section>
      </div>
    </main>
  );
}
