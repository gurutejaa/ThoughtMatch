"use server";

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_COOKIE = "thoughtmatch-admin";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    redirect("/admin?error=invalid-password");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  redirect("/admin");
}

export async function runMatching() {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(ADMIN_COOKIE)?.value === "1";

  if (!isAuthed) {
    redirect("/admin?error=invalid-password");
  }

  const supabase = getSupabaseAdmin();
  const { data: batch } = await supabase
    .from("batches")
    .select("id")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch?.id) {
    redirect("/admin?error=no-active-batch");
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!projectUrl || !serviceRoleKey) {
    redirect("/admin?error=missing-env");
  }

  const response = await fetch(`${projectUrl}/functions/v1/run-matching`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey
    },
    body: JSON.stringify({ batch_id: batch.id }),
    cache: "no-store"
  });

  const result = (await response.json().catch(() => null)) as { matched?: number; error?: string } | null;

  if (!response.ok) {
    const message = encodeURIComponent(result?.error ?? "matching-failed");
    redirect(`/admin?error=${message}`);
  }

  redirect(`/admin?matched=${result?.matched ?? 0}`);
}
