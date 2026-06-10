"use server";

import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_COOKIE = "thoughtmatch-admin";

async function requireAdmin() {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(ADMIN_COOKIE)?.value === "1";

  if (!isAuthed) {
    redirect("/admin?error=invalid-password");
  }

  return getSupabaseAdmin();
}

async function requireAdminAndBatch() {
  const supabase = await requireAdmin();
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

  return { supabase, batchId: batch.id };
}

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
  const { batchId } = await requireAdminAndBatch();

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
    body: JSON.stringify({ batch_id: batchId }),
    cache: "no-store"
  });

  const result = (await response.json().catch(() => null)) as { matched?: number; error?: string } | null;

  if (!response.ok) {
    const message = encodeURIComponent(result?.error ?? "matching-failed");
    redirect(`/admin?error=${message}`);
  }

  redirect(`/admin?matched=${result?.matched ?? 0}`);
}

export async function doReveal() {
  const { supabase, batchId } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({ reveal_ready: true })
    .eq("id", batchId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?revealed=true");
}

function parseMinutes(value: FormDataEntryValue | null, fallback: number) {
  const raw = String(value ?? "").trim();
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.round(parsed), 24 * 60);
}

export async function openRegistrationNow(formData: FormData) {
  const { supabase, batchId } = await requireAdminAndBatch();
  const registrationMinutes = parseMinutes(formData.get("registration_minutes"), 30);
  const questionMinutes = parseMinutes(formData.get("question_minutes"), 60);
  const now = Date.now();
  const registrationClosesAt = new Date(now + registrationMinutes * 60 * 1000).toISOString();
  const questionClosesAt = new Date(now + questionMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("batches")
    .update({
      status: "active",
      registration_closes_at: registrationClosesAt,
      question_closes_at: questionClosesAt,
      reveal_ready: false
    })
    .eq("id", batchId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin?registrationOpened=${registrationMinutes}&questionsSet=${questionMinutes}`);
}

export async function closeRegistrationNow() {
  const { supabase, batchId } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({
      registration_closes_at: new Date(Date.now() - 60 * 1000).toISOString(),
      reveal_ready: false
    })
    .eq("id", batchId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?registrationClosed=true");
}

export async function setQuestionWindow(formData: FormData) {
  const { supabase, batchId } = await requireAdminAndBatch();
  const questionMinutes = parseMinutes(formData.get("question_minutes"), 60);
  const questionClosesAt = new Date(Date.now() + questionMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("batches")
    .update({
      question_closes_at: questionClosesAt,
      reveal_ready: false
    })
    .eq("id", batchId);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin?questionsSet=${questionMinutes}`);
}

export async function createNewBatch(formData: FormData) {
  const supabase = await requireAdmin();
  const registrationMinutes = parseMinutes(formData.get("registration_minutes"), 30);
  const questionMinutes = parseMinutes(formData.get("question_minutes"), 60);
  const domainIdRaw = String(formData.get("domain_id") ?? "").trim();
  const domainId = domainIdRaw || null;
  const now = Date.now();
  const registrationClosesAt = new Date(now + registrationMinutes * 60 * 1000);
  const questionClosesAt = new Date(registrationClosesAt.getTime() + questionMinutes * 60 * 1000);
  const startDate = new Date(now).toISOString().slice(0, 10);

  const { error: completeError } = await supabase
    .from("batches")
    .update({ status: "complete" })
    .eq("status", "active");

  if (completeError) {
    redirect(`/admin?error=${encodeURIComponent(completeError.message)}`);
  }

  const { error: insertError } = await supabase
    .from("batches")
    .insert({
      status: "active",
      start_date: startDate,
      registration_closes_at: registrationClosesAt.toISOString(),
      question_closes_at: questionClosesAt.toISOString(),
      reveal_ready: false,
      domain_id: domainId
    });

  if (insertError) {
    redirect(`/admin?error=${encodeURIComponent(insertError.message)}`);
  }

  redirect(`/admin?batchCreated=true&registrationOpened=${registrationMinutes}&questionsSet=${questionMinutes}`);
}
