"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MatchReveal from "@/components/MatchReveal";
import { CategoryScores } from "@/lib/matching";
import { usePreviewMode } from "@/lib/preview";
import { supabase } from "@/lib/supabase";

type MatchRecord = {
  user_a: string;
  user_b: string;
  total_score: number;
  category_scores: CategoryScores;
};

export default function Reveal() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [match, setMatch] = useState<MatchRecord | null>(null);
  const [matchUser, setMatchUser] = useState<{ name?: string | null; instagram_handle?: string | null } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [animScore, setAnimScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (previewMode) {
        setMatch({
          user_a: "preview-a",
          user_b: "preview-b",
          total_score: 88,
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
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/register");
        return;
      }

      const { data: topMatch } = await supabase
        .from("matches")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("total_score", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!topMatch) {
        router.push("/waiting?message=Your%20match%20isn%27t%20ready%20yet.");
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
        setStatusMessage("Your match isn't ready yet.");
        router.push("/waiting?message=Your%20match%20isn%27t%20ready%20yet.");
        return;
      }

      setMatchUser(other);
    }

    load();
  }, [previewMode, router]);

  useEffect(() => {
    if (score === 0) return;

    let current = 0;
    const timer = window.setInterval(() => {
      current += 2;

      if (current >= score) {
        setAnimScore(score);
        window.clearInterval(timer);
        return;
      }

      setAnimScore(current);
    }, 20);

    return () => window.clearInterval(timer);
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
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onCopy={() => navigator.clipboard.writeText(matchUser?.instagram_handle ?? "")}
      />
    </main>
  );
}
