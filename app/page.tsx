"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePreviewMode, withPreview } from "@/lib/preview";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const previewMode = usePreviewMode();

  useEffect(() => {
    async function routeUser() {
      if (previewMode) {
        router.push(withPreview("/register", true));
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
        .select("batch_id, verified")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.verified) {
        router.push("/register");
        return;
      }

      const { data: batch } = await supabase
        .from("batches")
        .select("status, registration_closes_at")
        .eq("id", profile.batch_id)
        .maybeSingle();

      if (!batch) {
        router.push("/waiting");
        return;
      }

      if (batch.status === "complete") {
        router.push("/reveal");
        return;
      }

      const closesAt = batch.registration_closes_at ? new Date(batch.registration_closes_at).getTime() : null;

      if (!closesAt || Date.now() < closesAt) {
        router.push("/waiting");
        return;
      }

      const [{ count: totalQuestions }, { count: answeredQuestions }] = await Promise.all([
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase
          .from("answers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("batch_id", profile.batch_id)
      ]);

      if ((answeredQuestions ?? 0) >= (totalQuestions ?? 0)) {
        router.push("/waiting");
        return;
      }

      router.push("/daily");
    }

    routeUser();
  }, [previewMode, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-[var(--muted)]">Loading ThoughtMatch...</p>
    </main>
  );
}
