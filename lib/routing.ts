import { supabase } from "@/lib/supabase";

export type RouteTarget = "register" | "waiting" | "daily" | "reveal";

export type ActiveBatchRouteInput = {
  id: string;
  status?: string | null;
  registration_closes_at?: string | null;
  question_closes_at?: string | null;
  reveal_ready?: boolean | null;
} | null;

function getTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export async function getRouteForUser(userId: string | null, activeBatch: ActiveBatchRouteInput): Promise<RouteTarget> {
  if (!userId) {
    return "register";
  }

  if (!activeBatch?.id) {
    return "register";
  }

  const { data: registration } = await supabase
    .from("batch_registrations")
    .select("user_id")
    .eq("batch_id", activeBatch.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!registration?.user_id) {
    return "register";
  }

  const now = Date.now();
  const registrationClosesAt = getTime(activeBatch.registration_closes_at ?? null);
  const questionClosesAt = getTime(activeBatch.question_closes_at ?? null);

  if (registrationClosesAt && now < registrationClosesAt) {
    return "waiting";
  }

  if (activeBatch.reveal_ready) {
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("batch_id", activeBatch.id)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .limit(1)
      .maybeSingle();

    return match?.id ? "reveal" : "waiting";
  }

  if (questionClosesAt && now < questionClosesAt) {
    return "daily";
  }

  return "waiting";
}
