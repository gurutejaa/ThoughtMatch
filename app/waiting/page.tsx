"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewMode } from "@/lib/preview";
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

export default function Waiting() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [state, setState] = useState<WaitingState>({});
  const [message, setMessage] = useState<string | null>(null);
  const [noMatchYet, setNoMatchYet] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMessage(params.get("message"));
    setNoMatchYet(params.get("nomatch") === "true");
  }, []);

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

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/register");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("name, batch_id")
        .eq("id", user.id)
        .maybeSingle();

      const { data: activeBatch } = await supabase
        .from("batches")
        .select("id, registration_closes_at, question_closes_at, reveal_ready, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBatchId = activeBatch?.id ?? null;

      if (!currentBatchId) {
        setState({ name: profile?.name });
        return;
      }

      let hasActiveMatch = false;
      if (activeBatch?.reveal_ready) {
        const { data: match } = await supabase
          .from("matches")
          .select("id")
          .eq("batch_id", currentBatchId)
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .limit(1)
          .maybeSingle();

        hasActiveMatch = Boolean(match?.id);
      }

      setState({
        name: profile?.name,
        batchId: currentBatchId,
        closesAt: activeBatch?.registration_closes_at,
        questionClosesAt: activeBatch?.question_closes_at,
        revealReady: activeBatch?.reveal_ready,
        status: activeBatch?.status,
        hasActiveMatch
      });
    }

    load();
  }, [previewMode, router]);

  useEffect(() => {
    if (!previewMode && state.revealReady && state.hasActiveMatch && !noMatchYet) {
      router.push("/reveal");
    }
  }, [noMatchYet, previewMode, router, state.hasActiveMatch, state.revealReady]);

  useEffect(() => {
    if (previewMode) return;
    if (!state.closesAt || !state.batchId || state.status !== "active" || state.revealReady) return;

    const closesAt = new Date(state.closesAt).getTime();
    if (Number.isNaN(closesAt) || now < closesAt) return;

    async function routeAfterClose() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return;

      const [{ count: totalQuestions }, { count: answeredQuestions }] = await Promise.all([
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase
          .from("answers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("batch_id", state.batchId)
      ]);

      if ((answeredQuestions ?? 0) < (totalQuestions ?? 0)) {
        router.push("/daily");
      }
    }

    void routeAfterClose();
  }, [now, previewMode, router, state.batchId, state.closesAt, state.status]);

  return (
    <main className="flex min-h-screen items-center px-6 py-10">
      <div className="tm-shell">
        {message || noMatchYet ? (
          <p className="mb-4 text-sm text-[var(--muted)]">
            {message ?? "Your match is being prepared."}
          </p>
        ) : null}
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
