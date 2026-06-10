import { cookies } from "next/headers";
import Link from "next/link";
import {
  closeRegistrationNow,
  createNewBatch,
  doReveal,
  loginAdmin,
  openRegistrationNow,
  runMatching,
  setQuestionWindow
} from "@/app/admin/actions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_COOKIE = "thoughtmatch-admin";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  total_score: number | null;
};

type DomainRow = {
  id: string;
  name: string;
  slug: string;
  partner_name: string;
  offer_title: string | null;
  offer_description: string | null;
};

type ActiveBatch = {
  id: string;
  registration_closes_at: string | null;
  question_closes_at: string | null;
  reveal_ready: boolean | null;
  status: string | null;
  domain?: {
    name?: string | null;
    partner_name?: string | null;
  }[] | null;
};

type DashboardStage = "registration" | "questions" | "matching" | "reveal";

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

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function statusTone(stage: DashboardStage) {
  if (stage === "registration") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (stage === "questions") return "border-amber-200 bg-amber-50 text-amber-700";
  if (stage === "reveal") return "border-black bg-black text-white";
  return "border-red-200 bg-red-50 text-red-700";
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
  const batchCreated = readParam(searchParams.batchCreated);

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
  const { data: domains } = await supabase
    .from("domains")
    .select("id, name, slug, partner_name, offer_title, offer_description")
    .order("name");

  const { data: activeBatch } = await supabase
    .from("batches")
    .select("id, registration_closes_at, question_closes_at, reveal_ready, status, domain:domains(name, partner_name)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let totalRegistered = 0;
  let completedAllQuestions = 0;
  let matches: Array<{ id: string; userA: string; userB: string; score: number }> = [];
  const activeDomain = activeBatch?.domain?.[0] ?? null;

  let currentStage: DashboardStage = "matching";
  let statusLabel = "Waiting for Matching";
  let statusNote = "Questions are closed. Review the batch and run matching when you are ready.";
  let statusCountdown: string | null = null;

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
      currentStage = "reveal";
      statusLabel = "Reveal Live";
      statusNote = "Reveal is live. Users can now open their match result.";
    } else if (registrationClosesAt && now < registrationClosesAt) {
      currentStage = "registration";
      statusLabel = "Registration Open";
      statusNote = "Registration is live right now. New users can still join this batch.";
      statusCountdown = formatTimeRemaining(activeBatch.registration_closes_at);
    } else if (questionClosesAt && now < questionClosesAt) {
      currentStage = "questions";
      statusLabel = "Questions Live";
      statusNote = "Registration is closed. Users should be answering questions right now.";
      statusCountdown = formatTimeRemaining(activeBatch.question_closes_at);
    } else {
      currentStage = "matching";
      statusLabel = matches.length > 0 ? "Waiting for Reveal" : "Waiting for Matching";
      statusNote =
        matches.length > 0
          ? "Matches are ready. Review them below and reveal when you are ready."
          : "Questions are closed. Run matching when you are ready.";
    }
  }

  const showCloseRegistration = currentStage === "registration";
  const showQuestionsLiveNote = currentStage === "questions";
  const showRunMatching = currentStage === "matching" && matches.length === 0;
  const showDoReveal = currentStage === "matching" && matches.length > 0;
  const showMatchesTable = matches.length > 0;

  const timelineSteps = [
    {
      key: "registration" as DashboardStage,
      title: "Registration",
      time: formatDateTime(activeBatch?.registration_closes_at),
      active: currentStage === "registration",
      complete: currentStage !== "registration"
    },
    {
      key: "questions" as DashboardStage,
      title: "Questions",
      time: formatDateTime(activeBatch?.question_closes_at),
      active: currentStage === "questions",
      complete: currentStage === "matching" || currentStage === "reveal"
    },
    {
      key: "matching" as DashboardStage,
      title: "Matching",
      time: matches.length > 0 ? `${matches.length} match${matches.length === 1 ? "" : "es"} ready` : "Manual step",
      active: currentStage === "matching",
      complete: currentStage === "reveal"
    },
    {
      key: "reveal" as DashboardStage,
      title: "Reveal",
      time: activeBatch?.reveal_ready ? "Live now" : "Manual release",
      active: currentStage === "reveal",
      complete: false
    }
  ];

  return (
    <main className="min-h-screen bg-[#fafaf8] px-6 py-10 text-black">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-black/45">Admin</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">ThoughtMatch Dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/62">
            Control the active batch, monitor progress, run matching, and reveal results when you are ready.
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
            {batchCreated === "true"
              ? `New batch created. Registration is open for ${registrationOpened} minute${registrationOpened === "1" ? "" : "s"}.`
              : `Registration is open now for ${registrationOpened} minute${registrationOpened === "1" ? "" : "s"}.`}
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
          <section className="rounded-[2rem] border border-black/10 bg-white p-8">
            <p className="text-lg font-medium">No active batch found.</p>
            <p className="mt-2 text-sm text-black/62">Create or activate a batch in Supabase, then refresh this page.</p>
          </section>
        ) : (
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-black/10 bg-white p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Create New Batch</p>
              <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-lg font-medium">Start a fresh batch from here</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-black/62">
                    This will mark any current active batch as complete, then create a new active batch with your chosen registration, question, and domain settings.
                  </p>
                </div>
                <form action={createNewBatch} className="rounded-[1.5rem] border border-black/10 p-5">
                  <div className="grid gap-3">
                    <label className="text-sm text-black/62">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                        Domain
                      </span>
                      <select
                        name="domain_id"
                        defaultValue=""
                        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option value="">None</option>
                        {(domains as DomainRow[] | null)?.map((domain) => (
                          <option key={domain.id} value={domain.id}>
                            {domain.name} · {domain.partner_name}
                          </option>
                        )) ?? []}
                      </select>
                    </label>
                  </div>
                  <details className="mt-4 rounded-[1.25rem] border border-black/10 bg-[#fcfcfb] p-4">
                    <summary className="cursor-pointer text-sm font-medium text-black">Or add custom domain</summary>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm text-black/62">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                          Partner name
                        </span>
                        <input
                          type="text"
                          name="custom_partner_name"
                          placeholder="Arun's Restaurant"
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <label className="block text-sm text-black/62">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                          Offer title
                        </span>
                        <input
                          type="text"
                          name="custom_offer_title"
                          placeholder="20% off dinner"
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                      <label className="block text-sm text-black/62">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
                          Offer description
                        </span>
                        <textarea
                          name="custom_offer_description"
                          placeholder="Matched users get 20% off their first dinner together"
                          className="min-h-[96px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </label>
                    </div>
                  </details>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                  {!domains || domains.length === 0 ? (
                    <p className="mt-3 text-xs text-black/45">
                      No saved domains yet. You can still create a batch by using the custom domain option above.
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    className="mt-4 w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white"
                  >
                    Create New Batch
                  </button>
                  <p className="mt-3 text-xs text-black/45">
                    This closes the current active batch and starts a brand-new one immediately.
                  </p>
                </form>
              </div>
            </section>

            <section className="rounded-[2rem] border border-black/10 bg-white p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Batch Status</p>
              <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className={`inline-flex rounded-full border px-4 py-2 text-sm font-semibold ${statusTone(currentStage)}`}>
                    {statusLabel}
                  </div>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-black/62">{statusNote}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-black/35">Batch ID</p>
                  <p className="mt-2 text-sm text-black/62">{activeBatch.id}</p>
                  {activeDomain ? (
                    <>
                      <p className="mt-4 text-xs uppercase tracking-[0.18em] text-black/35">Domain</p>
                      <p className="mt-2 text-sm text-black/62">
                        {activeDomain.name} <span className="text-black/40">· {activeDomain.partner_name}</span>
                      </p>
                    </>
                  ) : null}
                </div>

                <div className="min-w-[220px] rounded-[1.5rem] border border-black/10 bg-[#fcfcfb] px-5 py-4 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">Current countdown</p>
                  <p className="mt-3 text-4xl font-semibold tracking-[-0.06em]">
                    {statusCountdown ?? "--"}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Numbers</p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[2rem] border border-black/10 bg-white p-6">
                  <p className="text-sm text-black/55">Registered</p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.06em]">{totalRegistered}</p>
                </div>
                <div className="rounded-[2rem] border border-black/10 bg-white p-6">
                  <p className="text-sm text-black/55">Completed Questions</p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.06em]">{completedAllQuestions}</p>
                </div>
                <div className="rounded-[2rem] border border-black/10 bg-white p-6">
                  <p className="text-sm text-black/55">Matches Created</p>
                  <p className="mt-3 text-5xl font-semibold tracking-[-0.06em]">{matches.length}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-black/10 bg-white p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Timeline</p>
              <div className="mt-6 grid gap-4 lg:grid-cols-4">
                {timelineSteps.map((step, index) => {
                  const active = step.active;
                  const complete = step.complete;

                  return (
                    <div
                      key={step.key}
                      className={`rounded-[1.5rem] border p-5 ${
                        active
                          ? "border-black bg-black text-white"
                          : complete
                            ? "border-black/10 bg-[#f7f7f5] text-black"
                            : "border-black/10 bg-white text-black"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${active ? "text-white/60" : "text-black/45"}`}>
                          Step {index + 1}
                        </p>
                        <span className={`text-xs ${active ? "text-white/70" : "text-black/35"}`}>
                          {active ? "Active" : complete ? "Done" : "Pending"}
                        </span>
                      </div>
                      <p className="mt-4 text-xl font-semibold tracking-[-0.04em]">{step.title}</p>
                      <p className={`mt-3 text-sm leading-6 ${active ? "text-white/78" : "text-black/62"}`}>{step.time}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-black/10 bg-white p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Controls</p>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-black/10 bg-[#fcfcfb] p-5">
                    <p className="text-sm font-medium">Current action</p>
                    {showCloseRegistration ? (
                      <>
                        <p className="mt-2 text-sm leading-6 text-black/62">
                          Registration is open. Close it when you are ready to move everyone into questions.
                        </p>
                        <form action={closeRegistrationNow} className="mt-4">
                          <button
                            type="submit"
                            className="w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white"
                          >
                            Close Registration Now
                          </button>
                        </form>
                        <p className="mt-3 text-xs text-black/45">This will immediately stop new people from joining this batch.</p>
                      </>
                    ) : null}

                    {showQuestionsLiveNote ? (
                      <>
                        <p className="mt-2 text-sm leading-6 text-black/62">
                          Questions are live right now. No admin action is needed until the question window closes.
                        </p>
                        <div className="mt-4 rounded-2xl border border-black/10 px-4 py-4 text-sm text-black/72">
                          Questions are live
                        </div>
                      </>
                    ) : null}

                    {showRunMatching ? (
                      <>
                        <p className="mt-2 text-sm leading-6 text-black/62">
                          The question window is closed. Run matching now to generate the batch pairs.
                        </p>
                        <form action={runMatching} className="mt-4">
                          <button
                            type="submit"
                            className="w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white"
                          >
                            Run Matching
                          </button>
                        </form>
                        <p className="mt-3 text-xs text-black/45">Run this only when you are ready to lock in the current matching result.</p>
                      </>
                    ) : null}

                    {showDoReveal ? (
                      <>
                        <p className="mt-2 text-sm leading-6 text-black/62">
                          Matches are ready. Review the table below, then reveal when you want users to see their result.
                        </p>
                        <form action={doReveal} className="mt-4">
                          <button
                            type="submit"
                            className="w-full rounded-2xl bg-black px-5 py-4 text-sm font-semibold text-white"
                          >
                            Do Reveal
                          </button>
                        </form>
                        <p className="mt-3 text-xs text-black/45">Once revealed, users in this batch will be able to open their match result.</p>
                      </>
                    ) : null}

                    {currentStage === "reveal" ? (
                      <>
                        <p className="mt-2 text-sm leading-6 text-black/62">
                          Reveal is live now. Users should be able to access their match screen.
                        </p>
                        <div className="mt-4 rounded-2xl border border-black/10 px-4 py-4 text-sm text-black/72">
                          Reveal is live
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <form action={openRegistrationNow} className="rounded-[1.5rem] border border-black/10 p-5">
                    <p className="text-sm font-medium">Open Registration</p>
                    <p className="mt-2 text-sm leading-6 text-black/62">
                      Manual override. Use any minute value you want, like 2, 6, 7, 30, or 60.
                    </p>
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
                    </div>
                    <button
                      type="submit"
                      className="mt-4 w-full rounded-2xl border border-black px-5 py-4 text-sm font-semibold text-black"
                    >
                      Open Registration Now
                    </button>
                    <p className="mt-3 text-xs text-black/45">This overrides the current registration timing for the active batch.</p>
                  </form>

                  <form action={setQuestionWindow} className="rounded-[1.5rem] border border-black/10 p-5">
                    <p className="text-sm font-medium">Set Question Window</p>
                    <p className="mt-2 text-sm leading-6 text-black/62">
                      Adjust only the question window without reopening registration.
                    </p>
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
                      className="mt-4 w-full rounded-2xl border border-black px-5 py-4 text-sm font-semibold text-black"
                    >
                      Set Question Window
                    </button>
                    <p className="mt-3 text-xs text-black/45">Use this carefully if users are already inside the question flow.</p>
                  </form>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-black/10 bg-white p-8">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Matches Table</p>
                <p className="mt-3 text-sm leading-6 text-black/62">
                  Review the final pairs and compatibility scores after matching is run.
                </p>
              </div>

              {!showMatchesTable ? (
                <p className="text-sm text-black/55">No matches created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-black/10 text-black/45">
                        <th className="pb-3 font-medium">User A name</th>
                        <th className="pb-3 font-medium">User B name</th>
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
          </div>
        )}
      </div>
    </main>
  );
}
