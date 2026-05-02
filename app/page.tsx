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
        .select("status, start_date")
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

      const start = new Date(batch.start_date + "T00:00:00Z");
      const now = new Date();
      const nowUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      const dayDiff = Math.floor((nowUTC.getTime() - start.getTime()) / 86400000);

      if (dayDiff < 0) {
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
