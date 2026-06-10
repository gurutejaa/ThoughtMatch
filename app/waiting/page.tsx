"use client";

import { useEffect, useState } from "react";
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
          setMessage("You were not matched this round.");
        } else if (registrationClosesAt && serverNow < registrationClosesAt) {
          setMessage("Registration is open. You are in the batch.");
        } else if (questionClosesAt && serverNow < questionClosesAt) {
          setMessage("Questions are live right now.");
        } else {
          setMessage("Results are being prepared.");
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

  return (
    <main className="flex min-h-screen items-center px-6 py-10">
      <div className="tm-shell">
        {message ? <p className="mb-4 text-sm text-[var(--muted)]">{message}</p> : null}
        <p className="mb-3 text-xs text-[var(--muted)]">Checking for updates...</p>
        <section
          className="rounded-[2rem] p-6 text-white shadow-[var(--shadow)]"
          style={{ backgroundImage: "linear-gradient(155deg,var(--hero-start),var(--hero-end))" }}
        >
          <p className="tm-kicker text-sm text-white/60">Waiting Room</p>
          <h1 className="mt-3 text-4xl font-semibold">You're in the batch.</h1>
          <p className="tm-whisper mt-2 text-lg text-white/80">We wait until the full batch is locked before matching begins.</p>
          <p className="mt-4 text-sm leading-6 text-white/72">
            {state.name ? `${state.name}, ` : ""}
            registration is complete. Once the batch locks, daily questions will begin and your match will start forming.
          </p>

          <div
            className="mt-8 rounded-[1.5rem] p-4"
            style={{ border: "1px solid var(--hero-border)", background: "var(--hero-overlay)" }}
          >
            <p className="tm-kicker text-xs text-white/50">Current batch status</p>
            <p className="mt-2 text-2xl font-medium capitalize">{state.status ?? "Pending"}</p>
            <p className="mt-3 text-sm text-white/68">
              Registration closes at: {state.closesAt ? new Date(state.closesAt).toLocaleString() : "Waiting for schedule"}
            </p>
            <p className="mt-2 text-sm text-white/68">
              Question window closes at: {state.questionClosesAt ? new Date(state.questionClosesAt).toLocaleString() : "Waiting for schedule"}
            </p>
            {state.closesAt && new Date(state.closesAt).getTime() > now ? (
              <p className="mt-2 text-xs text-white/58">
                Questions open automatically when this timer ends.
              </p>
            ) : null}
            {state.closesAt && new Date(state.closesAt).getTime() <= now && !state.revealReady ? (
              <p className="mt-2 text-xs text-white/58">
                Once everyone finishes, the admin will run matching and reveal the results.
              </p>
            ) : null}
            {state.revealReady && !state.hasActiveMatch ? (
              <p className="mt-2 text-xs text-white/58">
                Results are being prepared.
              </p>
            ) : null}
            {isCheckingUpdates ? (
              <p className="mt-2 text-xs text-white/58">
                Checking for updates...
              </p>
            ) : null}
          </div>
        </section>

        <section className="tm-panel mt-5 rounded-[2rem] p-5">
          <p className="text-sm font-medium text-[var(--foreground)]">What happens next</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <p>1. The active batch locks after the registration window ends.</p>
            <p>2. You receive a small set of behavior-based questions each day.</p>
            <p>3. Your final reveal explains not only who matched with you, but why.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
