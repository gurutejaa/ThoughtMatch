"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRouteForUser } from "@/lib/routing";
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

      const { data: activeBatch } = await supabase
        .from("batches")
        .select("id, status, registration_closes_at, question_closes_at, reveal_ready")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeBatch?.id) {
        const { data: batchRegistration } = await supabase
          .from("batch_registrations")
          .select("user_id")
          .eq("batch_id", activeBatch.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!batchRegistration?.user_id) {
          await supabase.auth.signOut();
          router.push("/register");
          return;
        }
      }

      const route = await getRouteForUser(user.id, activeBatch);
      router.push(`/${route === "register" ? "register" : route}`);
    }

    void routeUser();
  }, [previewMode, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <p className="text-sm text-[var(--muted)]">Loading ThoughtMatch...</p>
    </main>
  );
}
