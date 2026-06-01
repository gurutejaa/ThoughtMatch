import { cookies } from "next/headers";
import { loginAdmin, runMatching } from "@/app/admin/actions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_COOKIE = "thoughtmatch-admin";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  total_score: number | null;
};

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage(props: { searchParams?: SearchParams }) {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(ADMIN_COOKIE)?.value === "1";
  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = readParam(searchParams.error);
  const matched = readParam(searchParams.matched);

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-black">
        <form action={loginAdmin} className="w-full max-w-sm rounded-[2rem] border border-black/10 bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">ThoughtMatch Access</h1>
          <p className="mt-3 text-sm leading-6 text-black/62">Enter the admin password to open the batch dashboard.</p>

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="mt-6 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none placeholder:text-black/35"
          />

          {error === "invalid-password" ? (
            <p className="mt-3 text-sm text-red-600">Incorrect password.</p>
          ) : null}

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: activeBatch } = await supabase
    .from("batches")
    .select("id, registration_closes_at, status")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let totalRegistered = 0;
  let completedAllQuestions = 0;
  let matches: Array<{ id: string; userA: string; userB: string; score: number }> = [];

  if (activeBatch?.id) {
    const [{ count: registrationCount }, { count: questionCount }, { data: registrations }, { data: matchRows }] =
      await Promise.all([
        supabase
          .from("batch_registrations")
          .select("*", { count: "exact", head: true })
          .eq("batch_id", activeBatch.id),
        supabase.from("questions").select("*", { count: "exact", head: true }),
        supabase.from("batch_registrations").select("user_id").eq("batch_id", activeBatch.id),
        supabase
          .from("matches")
          .select("id, user_a, user_b, total_score")
          .eq("batch_id", activeBatch.id)
          .order("total_score", { ascending: false })
      ]);

    totalRegistered = registrationCount ?? 0;
    const requiredAnswers = questionCount ?? 0;
    const userIds = (registrations ?? []).map((registration) => registration.user_id);

    if (userIds.length > 0) {
      const { data: answers } = await supabase
        .from("answers")
        .select("user_id")
        .eq("batch_id", activeBatch.id)
        .in("user_id", userIds);

      const answerCounts = new Map<string, number>();
      for (const answer of answers ?? []) {
        answerCounts.set(answer.user_id, (answerCounts.get(answer.user_id) ?? 0) + 1);
      }

      completedAllQuestions = userIds.filter((userId) => (answerCounts.get(userId) ?? 0) >= requiredAnswers).length;
    }

    const typedMatches = (matchRows ?? []) as MatchRow[];
    const matchUserIds = Array.from(
      new Set(typedMatches.flatMap((match) => [match.user_a, match.user_b]).filter(Boolean))
    );

    let userNames = new Map<string, string>();
    if (matchUserIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, name").in("id", matchUserIds);
      userNames = new Map((users ?? []).map((user) => [user.id, user.name ?? "Unknown"]));
    }

    matches = typedMatches.map((match) => ({
      id: match.id,
      userA: userNames.get(match.user_a) ?? "Unknown",
      userB: userNames.get(match.user_b) ?? "Unknown",
      score: Math.round(match.total_score ?? 0)
    }));
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45">Admin</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">ThoughtMatch Dashboard</h1>
          <p className="mt-3 text-sm leading-6 text-black/62">
            Monitor the active batch, run matching, and review generated pairs.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error === "no-active-batch"
              ? "There is no active batch right now."
              : error === "missing-env"
                ? "Missing required admin environment variables."
                : `Matching failed: ${decodeURIComponent(error)}`}
          </div>
        ) : null}

        {matched ? (
          <div className="mb-6 rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm text-white">
            Matching ran successfully. Created {matched} matches.
          </div>
        ) : null}

        {!activeBatch?.id ? (
          <section className="rounded-[2rem] border border-black/10 bg-white p-6">
            <p className="text-lg font-medium">No active batch found.</p>
            <p className="mt-2 text-sm text-black/62">Create or activate a batch in Supabase, then refresh this page.</p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Active batch</p>
                <p className="mt-3 text-lg font-medium">{activeBatch.id}</p>
              </div>
              <div className="rounded-[2rem] border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Registered</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{totalRegistered}</p>
              </div>
              <div className="rounded-[2rem] border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Completed all 8</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{completedAllQuestions}</p>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-black/10 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-medium">Matching Control</p>
                  <p className="mt-2 text-sm text-black/62">
                    Use this when the active batch is ready to be paired.
                  </p>
                </div>

                <form action={runMatching}>
                  <button
                    type="submit"
                    className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  >
                    Run Matching
                  </button>
                </form>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-black/10 bg-white p-5">
              <div className="mb-4">
                <p className="text-lg font-medium">Matches</p>
                <p className="mt-2 text-sm text-black/62">User A, User B, and compatibility score for the active batch.</p>
              </div>

              {matches.length === 0 ? (
                <p className="text-sm text-black/55">No matches created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/45">
                        <th className="pb-3 font-medium">User A</th>
                        <th className="pb-3 font-medium">User B</th>
                        <th className="pb-3 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => (
                        <tr key={match.id} className="border-b border-black/5 last:border-b-0">
                          <td className="py-4">{match.userA}</td>
                          <td className="py-4">{match.userB}</td>
                          <td className="py-4 text-right font-medium">{match.score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
