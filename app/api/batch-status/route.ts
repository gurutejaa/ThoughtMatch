import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: batch, error } = await supabase
      .from("batches")
      .select("id, status, registration_closes_at, question_closes_at, reveal_ready")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        id: batch?.id ?? null,
        status: batch?.status ?? null,
        registration_closes_at: batch?.registration_closes_at ?? null,
        question_closes_at: batch?.question_closes_at ?? null,
        reveal_ready: batch?.reveal_ready ?? false,
        current_time: new Date().toISOString()
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
