"use client";

import { useEffect, useState } from "react";
import MatchReveal from "@/components/MatchReveal";
import { CategoryScores } from "@/lib/matching";
import { getRouteForUser } from "@/lib/routing";
import { usePreviewMode } from "@/lib/preview";
import { supabase } from "@/lib/supabase";

type MatchRecord = {
  user_a: string;
  user_b: string;
  total_score: number;
  category_scores: CategoryScores;
  match_summary?: string | null;
  match_reasons?: string[] | null;
  shared_answer_count?: number | null;
};

type BatchOffer = {
  partner_name?: string | null;
  offer_title?: string | null;
  offer_description?: string | null;
};

export default function Reveal() {
  const previewMode = usePreviewMode();
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [matchUser, setMatchUser] = useState<{ name?: string | null; instagram_handle?: string | null } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [animScore, setAnimScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [partnerOffer, setPartnerOffer] = useState<BatchOffer | null>(null);

  useEffect(() => {
    async function load() {
      if (previewMode) {
        setMatch({
          user_a: "preview-a",
          user_b: "preview-b",
          total_score: 88,
          match_summary: "Your strongest alignment shows up in mindset and relationship outlook, with enough consistency across the rest of your answers to make the pairing feel intentional.",
          match_reasons: [
            "You tend to think through choices in a similar way, which creates a more natural mental rhythm.",
            "You seem to want similar things from trust, closeness, and connection.",
            "Your daily energy and way of moving through life line up more naturally than not."
          ],
          shared_answer_count: 8,
          category_scores: {
            mindset: 92,
            emotional: 86,
            lifestyle: 83,
            relationship: 90
          }
        });
        setScore(88);
        setMatchUser({
          name: "Alex",
          instagram_handle: "alex.preview"
        });
        setPartnerOffer({
          partner_name: "Northside Cafe",
          offer_title: "Matched Pair Coffee Date",
          offer_description: "Bring your reveal and enjoy a free pastry with any two coffee orders."
        });
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        setStatusMessage("Sign in to view your reveal.");
        return;
      }

      const { data: activeBatch } = await supabase
        .from("batches")
        .select("id, status, registration_closes_at, question_closes_at, reveal_ready, domain:domains(partner_name, offer_title, offer_description)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeBatch?.id) {
        setStatusMessage("There is no active batch right now.");
        return;
      }
      setPartnerOffer((activeBatch as { domain?: BatchOffer | null } | null)?.domain ?? null);

      const route = await getRouteForUser(user.id, activeBatch);

      if (route !== "reveal") {
        if (activeBatch.reveal_ready) {
          setStatusMessage("You were not matched this round.");
        } else {
          setStatusMessage("Results are being prepared.");
        }
        return;
      }

      const { data: topMatch } = await supabase
        .from("matches")
        .select("*")
        .eq("batch_id", activeBatch.id)
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("total_score", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!topMatch) {
        setStatusMessage("You were not matched this round.");
        return;
      }

      const typedMatch = topMatch as MatchRecord;
      setMatch(typedMatch);
      setScore(typedMatch.total_score);

      const otherId = typedMatch.user_a === user.id ? typedMatch.user_b : typedMatch.user_a;
      const { data: other, error: otherError } = await supabase
        .from("users")
        .select("name, instagram_handle")
        .eq("id", otherId)
        .maybeSingle();

      if (otherError) {
        setStatusMessage("We found your match, but the reveal details are still loading.");
        return;
      }

      setMatchUser(other);
    }

    void load();
  }, [previewMode]);

  useEffect(() => {
    if (score === 0) return;

    const duration = 2000;
    const start = performance.now();
    let frameId = 0;

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      setAnimScore(Math.round(score * progress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(frameId);
  }, [score]);

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="tm-whisper text-lg text-[var(--accent-deep)]">
          {statusMessage || "We are preparing your strongest match result."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <MatchReveal
        score={animScore}
        matchUser={matchUser}
        categoryScores={match.category_scores ?? {}}
        summary={match.match_summary ?? null}
        reasons={match.match_reasons ?? []}
        sharedAnswerCount={match.shared_answer_count ?? null}
        partnerOffer={partnerOffer}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onCopy={() => navigator.clipboard.writeText(matchUser?.instagram_handle ?? "")}
      />
    </main>
  );
}
