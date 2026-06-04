import { cookies } from "next/headers";
import { closeRegistrationNow, doReveal, loginAdmin, openRegistrationNow, runMatching, setQuestionWindow } from "@/app/admin/actions";
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

function formatTimeRemaining(target: string | null) {
  if (!target) return null;

  const diff = new Date(target).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return "0m 00s";

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export default async function AdminPage(props: { searchParams?: SearchParams }) {
  const cookieStore = await cookies();
  const isAuthed = cookieStore.get(ADMIN_COOKIE)?.value === "1";
  const searchParams = props.searchParams ? await props.searchParams : {};
  const error = readParam(searchParams.error);
  const matched = readParam(searchParams.matched);
  const revealed = readParam(searchParams.revealed);
  const registrationOpened = readParam(searchParams.registrationOpened);
  const registrationClosed = readParam(searchParams.registrationClosed);
  const questionsSet = readParam(searchParams.questionsSet);

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
    .select("id, registration_closes_at, question_closes_at, reveal_ready, status")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let totalRegistered = 0;
  let completedAllQuestions = 0;
  let matches: Array<{ id: string; userA: string; userB: string; score: number }> = [];
  let liveState = {
    label: "No active batch",
    tone: "border-black/10 bg-black/[0.03] text-black",
    countdown: null as string | null,
    note: "Create or activate a batch to begin."
  };

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

    const now = Date.now();
    const registrationClosesAt = activeBatch.registration_closes_at
      ? new Date(activeBatch.registration_closes_at).getTime()
      : null;
    const questionClosesAt = activeBatch.question_closes_at
      ? new Date(activeBatch.question_closes_at).getTime()
      : null;

    if (activeBatch.reveal_ready) {
      liveState = {
        label: "Reveal Live",
        tone: "border-black bg-black text-white",
        countdown: null,
        note: "Users can now open their reveal."
      };
    } else if (registrationClosesAt && now < registrationClosesAt) {
      liveState = {
        label: "Registration Live",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
        countdown: formatTimeRemaining(activeBatch.registration_closes_at),
        note: "New users can still join this batch."
      };
    } else if (questionClosesAt && now < questionClosesAt) {
      liveState = {
        label: "Questions Live",
        tone: "border-amber-200 bg-amber-50 text-amber-700",
        countdown: formatTimeRemaining(activeBatch.question_closes_at),
        note: "Registration is closed. Users should be answering questions now."
      };
    } else {
      liveState = {
        label: "Waiting For Matching",
        tone: "border-red-200 bg-red-50 text-red-700",
        countdown: null,
        note: "Questions are closed. Run matching when you are ready."
      };
    }
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

        {registrationOpened ? (
          <div className="mb-6 rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm text-white">
            Registration is open now for {registrationOpened} minute{registrationOpened === "1" ? "" : "s"}.
          </div>
        ) : null}

        {registrationClosed === "true" ? (
          <div className="mb-6 rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm text-white">
            Registration is now closed for this batch.
          </div>
        ) : null}

        {questionsSet ? (
          <div className="mb-6 rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm text-white">
            Question window set for {questionsSet} minute{questionsSet === "1" ? "" : "s"} from now.
          </div>
        ) : null}

        {revealed === "true" ? (
          <div className="mb-6 rounded-2xl border border-black/10 bg-black px-4 py-3 text-sm text-white">
            Reveal is now live for this batch.
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
              <div className={`rounded-[2rem] border p-5 ${liveState.tone}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">Live status</p>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">{liveState.label}</p>
                {liveState.countdown ? (
                  <p className="mt-2 text-lg font-medium">{liveState.countdown}</p>
                ) : null}
                <p className="mt-3 text-sm opacity-80">{liveState.note}</p>
              </div>
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

            <section className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-[2rem] border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Registration closes</p>
                <p className="mt-3 text-sm font-medium">
                  {activeBatch.registration_closes_at
                    ? new Date(activeBatch.registration_closes_at).toLocaleString()
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-[2rem] border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Question window closes</p>
                <p className="mt-3 text-sm font-medium">
                  {activeBatch.question_closes_at
                    ? new Date(activeBatch.question_closes_at).toLocaleString()
                    : "Not set"}
                </p>
              </div>
              <div className="rounded-[2rem] border border-black/10 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45">Reveal status</p>
                <p className="mt-3 text-sm font-medium">{activeBatch.reveal_ready ? "Live" : "Hidden"}</p>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-black/10 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-lg font-medium">Registration Control</p>
                  <p className="mt-2 text-sm text-black/62">
                    Open registration for any number of minutes you want, or close it immediately.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <form action={openRegistrationNow} className="rounded-[1.5rem] border border-black/10 p-4">
                  <p className="text-sm font-medium text-black">Open registration now</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-black/62">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                        Registration minutes
                      </span>
                      <input
                        type="number"
                        name="registration_minutes"
                        min="1"
                        defaultValue="30"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <label className="text-sm text-black/62">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                        Question window minutes
                      </span>
                      <input
                        type="number"
                        name="question_minutes"
                        min="1"
                        defaultValue="60"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="mt-4 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  >
                    Open Registration Now
                  </button>
                </form>

                <div className="grid gap-4">
                  <form action={setQuestionWindow} className="rounded-[1.5rem] border border-black/10 p-4">
                    <p className="text-sm font-medium text-black">Set question window only</p>
                    <label className="mt-4 block text-sm text-black/62">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                        Question minutes
                      </span>
                      <input
                        type="number"
                        name="question_minutes"
                        min="1"
                        defaultValue="60"
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-4 rounded-2xl border border-black px-5 py-3 text-sm font-semibold text-black"
                    >
                      Set Question Window
                    </button>
                  </form>

                  <form action={closeRegistrationNow} className="rounded-[1.5rem] border border-black/10 p-4">
                    <p className="text-sm font-medium text-black">Close registration now</p>
                    <p className="mt-2 text-sm text-black/62">
                      Use this when you want to stop new people from joining immediately.
                    </p>
                    <button
                      type="submit"
                      className="mt-4 rounded-2xl border border-black px-5 py-3 text-sm font-semibold text-black"
                    >
                      Close Registration Now
                    </button>
                  </form>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[2rem] border border-black/10 bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-medium">Matching Control</p>
                  <p className="mt-2 text-sm text-black/62">
                    Questions open automatically after registration closes. Once the question window closes, you can run matching here and reveal only when you are ready.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <form action={runMatching}>
                    <button
                      type="submit"
                      className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                    >
                      Run Matching
                    </button>
                  </form>

                  <form action={doReveal}>
                    <button
                      type="submit"
                      disabled={matches.length === 0}
                      className="rounded-2xl border border-black px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Do Reveal
                    </button>
                  </form>
                </div>
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
