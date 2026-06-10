import { cookies } from "next/headers";
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
  if (stage === "registration") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (stage === "questions") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (stage === "reveal") return "border-white/25 bg-white text-black";
  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function timelineTone(active: boolean, complete: boolean) {
  if (active) return "border-white bg-white text-black";
  if (complete) return "border-white/20 bg-white/5 text-white";
  return "border-[#222222] bg-[#0f0f0f] text-white";
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
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 py-10 text-white">
        <form action={loginAdmin} className="w-full max-w-sm rounded-lg border border-[#222222] bg-[#0f0f0f] p-5">
          <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/45">Admin</p>
          <h1 className="mt-2 text-[1.9rem] font-semibold tracking-[-0.05em]">ThoughtMatch Access</h1>
          <p className="mt-2 text-[0.85rem] leading-6 text-white/60">Enter the admin password to open the dashboard.</p>

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="mt-5 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2.5 text-[0.85rem] text-white outline-none placeholder:text-white/30"
          />

          {error === "invalid-password" ? <p className="mt-2 text-[0.85rem] text-red-400">Incorrect password.</p> : null}

          <button
            type="submit"
            className="mt-4 w-full rounded-md border border-white bg-white px-3 py-2.5 text-[0.85rem] font-medium text-black"
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
  const activeDomain = (activeBatch as ActiveBatch | null)?.domain?.[0] ?? null;

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
    const matchUserIds = Array.from(new Set(typedMatches.flatMap((match) => [match.user_a, match.user_b]).filter(Boolean)));

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
    const registrationClosesAt = activeBatch.registration_closes_at ? new Date(activeBatch.registration_closes_at).getTime() : null;
    const questionClosesAt = activeBatch.question_closes_at ? new Date(activeBatch.question_closes_at).getTime() : null;

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
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-5 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Admin</p>
          <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.05em]">ThoughtMatch Dashboard</h1>
          <p className="mt-2 max-w-2xl text-[0.85rem] leading-6 text-white/58">
            Control the active batch, monitor progress, run matching, and reveal results when you are ready.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[0.85rem] text-red-300">
            {error === "no-active-batch"
              ? "There is no active batch right now."
              : error === "missing-env"
                ? "Missing required admin environment variables."
                : `Matching failed: ${decodeURIComponent(error)}`}
          </div>
        ) : null}

        {matched ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white px-3 py-2 text-[0.85rem] text-black">
            Matching ran successfully. Created {matched} matches.
          </div>
        ) : null}

        {registrationOpened ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white px-3 py-2 text-[0.85rem] text-black">
            {batchCreated === "true"
              ? `New batch created. Registration is open for ${registrationOpened} minute${registrationOpened === "1" ? "" : "s"}.`
              : `Registration is open now for ${registrationOpened} minute${registrationOpened === "1" ? "" : "s"}.`}
          </div>
        ) : null}

        {registrationClosed === "true" ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white px-3 py-2 text-[0.85rem] text-black">
            Registration is now closed for this batch.
          </div>
        ) : null}

        {questionsSet ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white px-3 py-2 text-[0.85rem] text-black">
            Question window set for {questionsSet} minute{questionsSet === "1" ? "" : "s"} from now.
          </div>
        ) : null}

        {revealed === "true" ? (
          <div className="mb-4 rounded-lg border border-white/10 bg-white px-3 py-2 text-[0.85rem] text-black">
            Reveal is now live for this batch.
          </div>
        ) : null}

        {!activeBatch?.id ? (
          <section className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
            <p className="text-[0.95rem] font-medium">No active batch found.</p>
            <p className="mt-1 text-[0.85rem] text-white/58">Create or activate a batch in Supabase, then refresh this page.</p>
          </section>
        ) : (
          <div className="space-y-5">
            <section className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Create New Batch</p>
                  <p className="mt-1 text-[0.85rem] text-white/58">
                    Close the current active batch and start a new one immediately.
                  </p>
                </div>
              </div>
              <form action={createNewBatch} className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="grid gap-2">
                  <label className="text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
                    <span className="mb-1 block">Domain</span>
                    <select
                      name="domain_id"
                      defaultValue={(domains?.[0] as DomainRow | undefined)?.id ?? ""}
                      className="w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-[0.85rem] text-white outline-none"
                    >
                      {(domains as DomainRow[] | null)?.map((domain) => (
                        <option key={domain.id} value={domain.id}>
                          {domain.name} · {domain.partner_name}
                        </option>
                      )) ?? []}
                    </select>
                  </label>
                  {!domains || domains.length === 0 ? (
                    <p className="text-[0.7rem] text-white/40">No domains found yet. Add domains first before creating a partner batch.</p>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
                    <span className="mb-1 block">Registration</span>
                    <input
                      type="number"
                      name="registration_minutes"
                      min="1"
                      defaultValue="30"
                      className="w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-[0.85rem] text-white outline-none"
                    />
                  </label>
                  <label className="text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
                    <span className="mb-1 block">Questions</span>
                    <input
                      type="number"
                      name="question_minutes"
                      min="1"
                      defaultValue="60"
                      className="w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-3 py-2 text-[0.85rem] text-white outline-none"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={!domains || domains.length === 0}
                      className="w-full rounded-md border border-white bg-white px-3 py-2 text-[0.85rem] font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Create New Batch
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <section className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Batch Status</p>
                  <p className="mt-2 max-w-xl text-[0.85rem] leading-6 text-white/58">{statusNote}</p>
                  <p className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-white/35">Batch ID</p>
                  <p className="mt-1 text-[0.85rem] text-white/70">{activeBatch.id}</p>
                  {activeDomain ? (
                    <>
                      <p className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-white/35">Domain</p>
                      <p className="mt-1 text-[0.85rem] text-white/70">
                        {activeDomain.name} <span className="text-white/35">· {activeDomain.partner_name}</span>
                      </p>
                    </>
                  ) : null}
                </div>

                <div className="text-right">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-[0.75rem] font-medium ${statusTone(currentStage)}`}>
                    {statusLabel}
                  </div>
                  <p className="mt-3 text-[0.7rem] uppercase tracking-[0.18em] text-white/35">Current countdown</p>
                  <p className="mt-1 text-[2rem] font-semibold tracking-[-0.06em]">{statusCountdown ?? "--"}</p>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-2 text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Numbers</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
                  <p className="text-[2rem] font-semibold leading-none tracking-[-0.05em]">{totalRegistered}</p>
                  <p className="mt-2 text-[0.7rem] uppercase tracking-[0.18em] text-white/40">Registered</p>
                </div>
                <div className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
                  <p className="text-[2rem] font-semibold leading-none tracking-[-0.05em]">{completedAllQuestions}</p>
                  <p className="mt-2 text-[0.7rem] uppercase tracking-[0.18em] text-white/40">Completed Questions</p>
                </div>
                <div className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
                  <p className="text-[2rem] font-semibold leading-none tracking-[-0.05em]">{matches.length}</p>
                  <p className="mt-2 text-[0.7rem] uppercase tracking-[0.18em] text-white/40">Matches Created</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Timeline</p>
              <div className="mt-4 grid gap-2 lg:grid-cols-4">
                {timelineSteps.map((step, index) => {
                  const active = step.active;
                  const complete = step.complete;

                  return (
                    <div key={step.key} className={`rounded-md border px-3 py-3 ${timelineTone(active, complete)}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${active ? "bg-black" : complete ? "bg-white" : "bg-white/25"}`} />
                        {index < timelineSteps.length - 1 ? <span className={`h-px flex-1 ${active ? "bg-black/30" : complete ? "bg-white/25" : "bg-[#222222]"}`} /> : null}
                      </div>
                      <p className={`text-[0.7rem] uppercase tracking-[0.18em] ${active ? "text-black/60" : "text-white/35"}`}>Step {index + 1}</p>
                      <p className="mt-1 text-[0.95rem] font-medium">{step.title}</p>
                      <p className={`mt-2 text-[0.8rem] leading-5 ${active ? "text-black/75" : "text-white/55"}`}>{step.time}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
              <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Controls</p>
              <div className="mt-4 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4">
                  <p className="text-[0.85rem] font-medium">Current action</p>

                  {showCloseRegistration ? (
                    <>
                      <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                        Registration is open. Close it when you are ready to move everyone into questions.
                      </p>
                      <form action={closeRegistrationNow} className="mt-3">
                        <button type="submit" className="rounded-md border border-white bg-white px-3 py-2 text-[0.85rem] font-medium text-black">
                          Close Registration Now
                        </button>
                      </form>
                      <p className="mt-2 text-[0.7rem] text-white/38">This immediately stops new people from joining this batch.</p>
                    </>
                  ) : null}

                  {showQuestionsLiveNote ? (
                    <>
                      <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                        Questions are live right now. No admin action is needed until the question window closes.
                      </p>
                      <div className="mt-3 rounded-md border border-[#222222] px-3 py-2 text-[0.85rem] text-white/72">Questions are live</div>
                    </>
                  ) : null}

                  {showRunMatching ? (
                    <>
                      <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                        The question window is closed. Run matching now to generate the batch pairs.
                      </p>
                      <form action={runMatching} className="mt-3">
                        <button type="submit" className="rounded-md border border-white bg-white px-3 py-2 text-[0.85rem] font-medium text-black">
                          Run Matching
                        </button>
                      </form>
                      <p className="mt-2 text-[0.7rem] text-white/38">Run this only when you are ready to lock in the current matching result.</p>
                    </>
                  ) : null}

                  {showDoReveal ? (
                    <>
                      <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                        Matches are ready. Review the table below, then reveal when you want users to see their result.
                      </p>
                      <form action={doReveal} className="mt-3">
                        <button type="submit" className="rounded-md border border-white bg-white px-3 py-2 text-[0.85rem] font-medium text-black">
                          Do Reveal
                        </button>
                      </form>
                      <p className="mt-2 text-[0.7rem] text-white/38">Once revealed, users in this batch will be able to open their match result.</p>
                    </>
                  ) : null}

                  {currentStage === "reveal" ? (
                    <>
                      <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                        Reveal is live now. Users should be able to access their match screen.
                      </p>
                      <div className="mt-3 rounded-md border border-[#222222] px-3 py-2 text-[0.85rem] text-white/72">Reveal is live</div>
                    </>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <form action={openRegistrationNow} className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4">
                    <p className="text-[0.85rem] font-medium">Open Registration</p>
                    <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                      Manual override. Use any minute value you want, like 2, 6, 7, 30, or 60.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <label className="text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
                        <span className="mb-1 block">Registration</span>
                        <input
                          type="number"
                          name="registration_minutes"
                          min="1"
                          defaultValue="30"
                          className="w-full rounded-md border border-[#222222] bg-[#0f0f0f] px-3 py-2 text-[0.85rem] text-white outline-none"
                        />
                      </label>
                      <label className="text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
                        <span className="mb-1 block">Questions</span>
                        <input
                          type="number"
                          name="question_minutes"
                          min="1"
                          defaultValue="60"
                          className="w-full rounded-md border border-[#222222] bg-[#0f0f0f] px-3 py-2 text-[0.85rem] text-white outline-none"
                        />
                      </label>
                    </div>
                    <button type="submit" className="mt-3 rounded-md border border-[#222222] px-3 py-2 text-[0.85rem] font-medium text-white">
                      Open Registration Now
                    </button>
                    <p className="mt-2 text-[0.7rem] text-white/38">This overrides the current registration timing for the active batch.</p>
                  </form>

                  <form action={setQuestionWindow} className="rounded-md border border-[#222222] bg-[#0a0a0a] p-4">
                    <p className="text-[0.85rem] font-medium">Set Question Window</p>
                    <p className="mt-2 text-[0.85rem] leading-6 text-white/58">
                      Adjust only the question window without reopening registration.
                    </p>
                    <label className="mt-3 block text-[0.7rem] uppercase tracking-[0.18em] text-white/40">
                      <span className="mb-1 block">Question minutes</span>
                      <input
                        type="number"
                        name="question_minutes"
                        min="1"
                        defaultValue="60"
                        className="w-full rounded-md border border-[#222222] bg-[#0f0f0f] px-3 py-2 text-[0.85rem] text-white outline-none"
                      />
                    </label>
                    <button type="submit" className="mt-3 rounded-md border border-[#222222] px-3 py-2 text-[0.85rem] font-medium text-white">
                      Set Question Window
                    </button>
                    <p className="mt-2 text-[0.7rem] text-white/38">Use this carefully if users are already inside the question flow.</p>
                  </form>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#222222] bg-[#0f0f0f] p-4">
              <div className="mb-3">
                <p className="text-[0.7rem] uppercase tracking-[0.24em] text-white/40">Matches Table</p>
                <p className="mt-1 text-[0.85rem] leading-6 text-white/58">
                  Review the final pairs and compatibility scores after matching is run.
                </p>
              </div>

              {!showMatchesTable ? (
                <p className="text-[0.85rem] text-white/55">No matches created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[0.85rem]">
                    <thead>
                      <tr className="border-b border-[#222222] text-white/40">
                        <th className="pb-3 font-medium">User A name</th>
                        <th className="pb-3 font-medium">User B name</th>
                        <th className="pb-3 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => (
                        <tr key={match.id} className="border-b border-[#222222] last:border-b-0">
                          <td className="py-3">{match.userA}</td>
                          <td className="py-3">{match.userB}</td>
                          <td className="py-3 text-right font-medium">{match.score}%</td>
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
