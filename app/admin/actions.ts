"use server";

import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_COOKIE = "thoughtmatch-admin";

export type AdminActionResult = {
  ok: boolean;
  message: string;
};

function success(message: string): AdminActionResult {
  return { ok: true, message };
}

function failure(message: string): AdminActionResult {
  return { ok: false, message };
}

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
    .select("id, registration_closes_at, question_closes_at, reveal_ready")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!batch?.id) {
    redirect("/admin?error=no-active-batch");
  }

  return { supabase, batch };
}

async function getAppBaseUrl() {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

async function logAdminAction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  {
    userId,
    action,
    details
  }: {
    userId: string;
    action: string;
    details: string;
  }
) {
  await supabase.from("admin_logs").insert({
    user_id: userId,
    action,
    details
  });
}

function refreshAdminViews() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/waiting");
  revalidatePath("/register");
  revalidatePath("/verify");
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
  const { batch } = await requireAdminAndBatch();

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

export async function doReveal() {
  const { supabase, batch } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({ reveal_ready: true })
    .eq("id", batch.id);

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
  const { supabase, batch } = await requireAdminAndBatch();
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
    .eq("id", batch.id);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin?registrationOpened=${registrationMinutes}&questionsSet=${questionMinutes}`);
}

export async function closeRegistrationNow() {
  const { supabase, batch } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({
      registration_closes_at: new Date(Date.now() - 60 * 1000).toISOString(),
      reveal_ready: false
    })
    .eq("id", batch.id);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?registrationClosed=true");
}

export async function setQuestionWindow(formData: FormData) {
  const { supabase, batch } = await requireAdminAndBatch();
  const questionMinutes = parseMinutes(formData.get("question_minutes"), 60);
  const questionClosesAt = new Date(Date.now() + questionMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("batches")
    .update({
      question_closes_at: questionClosesAt,
      reveal_ready: false
    })
    .eq("id", batch.id);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin?questionsSet=${questionMinutes}`);
}

export async function closeQuestionsNow() {
  const { supabase, batch } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({
      question_closes_at: new Date().toISOString(),
      reveal_ready: false
    })
    .eq("id", batch.id);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin?questionsClosed=true");
}

export async function createNewBatch(formData: FormData) {
  const supabase = await requireAdmin();
  const registrationMinutes = parseMinutes(formData.get("registration_minutes"), 30);
  const questionMinutes = parseMinutes(formData.get("question_minutes"), 60);
  const selectedDomainId = String(formData.get("domain_id") ?? "").trim() || null;
  const customPartnerName = String(formData.get("custom_partner_name") ?? "").trim();
  const customOfferTitle = String(formData.get("custom_offer_title") ?? "").trim();
  const customOfferDescription = String(formData.get("custom_offer_description") ?? "").trim();
  const now = Date.now();
  const registrationClosesAt = new Date(now + registrationMinutes * 60 * 1000);
  const questionClosesAt = new Date(registrationClosesAt.getTime() + questionMinutes * 60 * 1000);
  const startDate = new Date(now).toISOString().slice(0, 10);
  const hasCustomDomain =
    customPartnerName.length > 0 ||
    customOfferTitle.length > 0 ||
    customOfferDescription.length > 0;
  let domainId = selectedDomainId;

  if (hasCustomDomain) {
    const nameSource = customPartnerName || customOfferTitle || "Custom Partner";
    const slugBase = nameSource
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "custom-domain";
    const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

    const { data: insertedDomain, error: domainError } = await supabase
      .from("domains")
      .insert({
        name: nameSource,
        slug,
        partner_name: customPartnerName || nameSource,
        offer_title: customOfferTitle || null,
        offer_description: customOfferDescription || null
      })
      .select("id")
      .single();

    if (domainError || !insertedDomain?.id) {
      redirect(`/admin?error=${encodeURIComponent(domainError?.message ?? "domain-create-failed")}`);
    }

    domainId = insertedDomain.id;
  }

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

export async function createIssueForUser(userId: string, description: string): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const trimmedDescription = description.trim();

  if (!trimmedDescription) {
    return failure("Add an issue description first.");
  }

  const { error } = await supabase.from("issues").insert({
    user_id: userId,
    description: trimmedDescription,
    status: "open"
  });

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "issue_created",
    details: trimmedDescription
  });

  refreshAdminViews();
  return success("Issue logged.");
}

export async function updateIssueStatus(issueId: string, status: "open" | "in-progress" | "resolved"): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const { data: issue, error: lookupError } = await supabase
    .from("issues")
    .select("id, user_id")
    .eq("id", issueId)
    .maybeSingle();

  if (lookupError || !issue) {
    return failure(lookupError?.message ?? "Issue not found.");
  }

  const { error } = await supabase
    .from("issues")
    .update({ status })
    .eq("id", issueId);

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId: issue.user_id,
    action: "issue_status_updated",
    details: `Issue ${issueId} set to ${status}.`
  });

  refreshAdminViews();
  return success(`Issue marked ${status}.`);
}

export async function resendOtpForUser(userId: string): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user?.email) {
    return failure(userError?.message ?? "User email not found.");
  }

  const baseUrl = await getAppBaseUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${baseUrl}/verify`
    }
  });

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "otp_resent",
    details: `OTP resent to ${user.email}.`
  });

  refreshAdminViews();
  return success("OTP email resent.");
}

export async function resetUserRegistration(userId: string): Promise<AdminActionResult> {
  const { supabase, batch } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batch_registrations")
    .delete()
    .eq("batch_id", batch.id)
    .eq("user_id", userId);

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "registration_reset",
    details: `Removed batch registration from active batch ${batch.id}.`
  });

  refreshAdminViews();
  return success("Registration reset. User can register again for this batch.");
}

export async function extendQuestionWindowForUser(userId: string, minutes: number): Promise<AdminActionResult> {
  const { supabase, batch } = await requireAdminAndBatch();
  const safeMinutes = Math.min(Math.max(Math.round(minutes), 1), 24 * 60);
  const currentCloseTime = batch.question_closes_at ? new Date(batch.question_closes_at).getTime() : Date.now();
  const nextCloseTime = new Date(Math.max(currentCloseTime, Date.now()) + safeMinutes * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("batches")
    .update({ question_closes_at: nextCloseTime })
    .eq("id", batch.id);

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "question_window_extended",
    details: `Extended active batch question window by ${safeMinutes} minute(s).`
  });

  refreshAdminViews();
  return success(`Question window extended by ${safeMinutes} minute(s).`);
}

export async function forceAdvanceToQuestionsForUser(userId: string): Promise<AdminActionResult> {
  const { supabase, batch } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({
      registration_closes_at: new Date().toISOString(),
      reveal_ready: false
    })
    .eq("id", batch.id);

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "force_advanced_to_questions",
    details: `Registration closed immediately for active batch ${batch.id}.`
  });

  refreshAdminViews();
  return success("Registration closed. Users can now move into questions.");
}

export async function forceAdvanceToRevealForUser(userId: string): Promise<AdminActionResult> {
  const { supabase, batch } = await requireAdminAndBatch();

  const { error } = await supabase
    .from("batches")
    .update({ reveal_ready: true })
    .eq("id", batch.id);

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "force_advanced_to_reveal",
    details: `Reveal forced live for active batch ${batch.id}.`
  });

  refreshAdminViews();
  return success("Reveal is live now.");
}

export async function sendCustomMessageToUser(userId: string, message: string): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    return failure("Add a message first.");
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    message: trimmedMessage,
    read: false
  });

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "notification_sent",
    details: trimmedMessage
  });

  refreshAdminViews();
  return success("Message sent to user.");
}

export async function clearStuckSessionForUser(userId: string): Promise<AdminActionResult> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("users")
    .update({
      verified: false,
      batch_id: null
    })
    .eq("id", userId);

  if (error) {
    return failure(error.message);
  }

  await logAdminAction(supabase, {
    userId,
    action: "session_cleared",
    details: "Marked user for fresh OTP verification on next app check."
  });

  refreshAdminViews();
  return success("User will be forced through OTP again on their next refresh.");
}
