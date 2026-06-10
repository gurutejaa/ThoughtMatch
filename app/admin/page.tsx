import { cookies } from "next/headers";
import {
  closeQuestionsNow,
  closeRegistrationNow,
  createNewBatch,
  doReveal,
  loginAdmin,
  openRegistrationNow,
  runMatching,
  setQuestionWindow
} from "@/app/admin/actions";
import RefreshButton from "@/app/admin/refresh-button";
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
  partner_name: string;
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
  if (!target) return "--";

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

function truncateBatchId(id: string) {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function statusTone(stage: DashboardStage) {
  if (stage === "registration") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (stage === "questions") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (stage === "reveal") return "border-white/20 bg-white text-black";
  return "border-[#333333] bg-[#111111] text-white";
}

function stepTone(active: boolean, complete: boolean) {
  if (active) return "bg-white text-black border-white";
  if (complete) return "bg-[#141414] text-white border-[#2b2b2b]";
  return "bg-[#0f0f0f] text-white/38 border-[#222222]";
}

function compactButtonClass(inverted = false) {
  return `inline-flex h-8 items-center justify-center rounded-md border px-3 text-[0.75rem] font-medium ${
    inverted ? "border-white bg-white text-black" : "border-[#222222] bg-[#0f0f0f] text-white"
  }`;
}

function compactInputClass() {
  return "h-8 w-full rounded-md border border-[#222222] bg-[#0f0f0f] px-2.5 text-[0.75rem] text-white outline-none";
}

function sectionLabel(text: string) {
  return <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">{text}</p>;
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
  const questionsClosed = readParam(searchParams.questionsClosed);
  const batchCreated = readParam(searchParams.batchCreated);

  if (!isAuthed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-6 py-10 text-white">
        <form action={loginAdmin} className="w-full max-w-sm rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">ThoughtMatch Admin</p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.05em]">Hi CEO.</h1>
          <p className="mt-1 text-[0.85rem] leading-5 text-white/58">Enter the admin password to open the dashboard.</p>

          <input
            type="password"
            name="password"
            placeholder="Password"
            className="mt-3 h-8 w-full rounded-md border border-[#222222] bg-[#0a0a0a] px-2.5 text-[0.75rem] text-white outline-none placeholder:text-white/28"
          />

          {error === "invalid-password" ? <p className="mt-2 text-[0.75rem] text-red-400">Incorrect password.</p> : null}

          <button type="submit" className={`${compactButtonClass(true)} mt-3 w-full`}>
            Enter
          </button>
        </form>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: domains } = await supabase.from("domains").select("id, name, partner_name").order("name");

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
  let statusCountdown = "--";

  if (activeBatch?.id) {
    const [{ count: registrationCount }, { count: questionCount }, { data: registrations }, { data: matchRows }] =
      await Promise.all([
        supabase.from("batch_registrations").select("*", { count: "exact", head: true }).eq("batch_id", activeBatch.id),
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
    } else if (registrationClosesAt && now < registrationClosesAt) {
      currentStage = "registration";
      statusLabel = "Registration Open";
      statusCountdown = formatTimeRemaining(activeBatch.registration_closes_at);
    } else if (questionClosesAt && now < questionClosesAt) {
      currentStage = "questions";
      statusLabel = "Questions Live";
      statusCountdown = formatTimeRemaining(activeBatch.question_closes_at);
    } else {
      currentStage = "matching";
      statusLabel = matches.length > 0 ? "Ready to Reveal" : "Waiting for Matching";
    }
  }

  const timelineSteps = [
    {
      title: "Registration",
      active: currentStage === "registration",
      complete: currentStage !== "registration"
    },
    {
      title: "Questions",
      active: currentStage === "questions",
      complete: currentStage === "matching" || currentStage === "reveal"
    },
    {
      title: "Matching",
      active: currentStage === "matching",
      complete: currentStage === "reveal"
    },
    {
      title: "Reveal",
      active: currentStage === "reveal",
      complete: false
    }
  ];

  const notices = [
    matched ? `Matching ran successfully. Created ${matched} matches.` : null,
    registrationOpened
      ? batchCreated === "true"
        ? `New batch created. Registration is open for ${registrationOpened} minute${registrationOpened === "1" ? "" : "s"}.`
        : `Registration is open now for ${registrationOpened} minute${registrationOpened === "1" ? "" : "s"}.`
      : null,
    registrationClosed === "true" ? "Registration is now closed for this batch." : null,
    questionsSet ? `Question window set for ${questionsSet} minute${questionsSet === "1" ? "" : "s"} from now.` : null,
    questionsClosed === "true" ? "Questions are now closed for this batch." : null,
    revealed === "true" ? "Reveal is now live for this batch." : null
  ].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-3 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-[0.78rem] font-bold tracking-[0.01em]">Hi CEO. ThoughtMatch Admin</p>
          <RefreshButton />
        </div>

        {error ? (
          <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[0.75rem] text-red-300">
            {error === "no-active-batch"
              ? "There is no active batch right now."
              : error === "missing-env"
                ? "Missing required admin environment variables."
                : `Admin action failed: ${decodeURIComponent(error)}`}
          </div>
        ) : null}

        {notices.map((notice) => (
          <div key={notice} className="mb-2 rounded-md border border-white/10 bg-white px-3 py-2 text-[0.75rem] text-black">
            {notice}
          </div>
        ))}

        {!activeBatch?.id ? (
          <section className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
            {sectionLabel("Status")}
            <p className="mt-2 text-[0.85rem] text-white/62">No active batch found.</p>
          </section>
        ) : (
          <div className="space-y-3">
            <section className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 text-[0.75rem]">
                  <span className="text-white/55">Batch {truncateBatchId(activeBatch.id)}</span>
                  {activeDomain ? <span className="truncate text-white/38">{activeDomain.name} · {activeDomain.partner_name}</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[0.7rem] font-medium ${statusTone(currentStage)}`}>
                    {statusLabel}
                  </span>
                  <span className="text-[0.9rem] font-semibold">{statusCountdown}</span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3">
                  <p className="text-[2rem] font-semibold leading-none">{totalRegistered}</p>
                  <p className="mt-1 text-[0.7rem] text-white/42">Registered</p>
                </div>
                <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3">
                  <p className="text-[2rem] font-semibold leading-none">{completedAllQuestions}</p>
                  <p className="mt-1 text-[0.7rem] text-white/42">Completed</p>
                </div>
                <div className="rounded-md border border-[#222222] bg-[#0a0a0a] p-3">
                  <p className="text-[2rem] font-semibold leading-none">{matches.length}</p>
                  <p className="mt-1 text-[0.7rem] text-white/42">Matches</p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
              {sectionLabel("Timeline")}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {timelineSteps.map((step, index) => (
                  <div key={step.title} className={`rounded-md border p-2 ${stepTone(step.active, step.complete)}`}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${step.active ? "bg-black" : step.complete ? "bg-white" : "bg-white/20"}`} />
                      {index < timelineSteps.length - 1 ? (
                        <span className={`h-px flex-1 ${step.active ? "bg-black/25" : step.complete ? "bg-white/20" : "bg-[#222222]"}`} />
                      ) : null}
                    </div>
                    <p className="text-[0.7rem]">{step.title}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
                {sectionLabel("Timing Controls")}
                <div className="mt-3 space-y-3">
                  <form action={openRegistrationNow} className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" name="registration_minutes" min="1" defaultValue="30" className={compactInputClass()} placeholder="Registration min" />
                      <input type="number" name="question_minutes" min="1" defaultValue="60" className={compactInputClass()} placeholder="Question min" />
                    </div>
                    <button type="submit" className={compactButtonClass(true)}>Open Registration</button>
                  </form>

                  <form action={closeRegistrationNow}>
                    <button type="submit" className={`${compactButtonClass()} w-full`}>Close Registration Now</button>
                  </form>

                  <form action={setQuestionWindow} className="grid grid-cols-[1fr_auto] gap-2">
                    <input type="number" name="question_minutes" min="1" defaultValue="60" className={compactInputClass()} placeholder="Question minutes" />
                    <button type="submit" className={compactButtonClass()}>Set Question Window</button>
                  </form>

                  <form action={closeQuestionsNow}>
                    <button type="submit" className={`${compactButtonClass()} w-full`}>Close Questions Now</button>
                  </form>
                </div>
              </div>

              <div className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
                {sectionLabel("Batch Controls")}
                <form action={createNewBatch} className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" name="registration_minutes" min="1" defaultValue="30" className={compactInputClass()} placeholder="Registration min" />
                    <input type="number" name="question_minutes" min="1" defaultValue="60" className={compactInputClass()} placeholder="Question min" />
                  </div>
                  <select
                    name="domain_id"
                    defaultValue={(domains?.[0] as DomainRow | undefined)?.id ?? ""}
                    className={compactInputClass()}
                  >
                    {(domains as DomainRow[] | null)?.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name} · {domain.partner_name}
                      </option>
                    )) ?? []}
                  </select>
                  <button type="submit" disabled={!domains || domains.length === 0} className={`${compactButtonClass(true)} w-full disabled:cursor-not-allowed disabled:opacity-40`}>
                    Create New Batch
                  </button>
                </form>
              </div>
            </section>

            <section className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
              {sectionLabel("Matching and Reveal")}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <form action={runMatching}>
                  <button type="submit" className={`${compactButtonClass(true)} w-full`}>Run Matching</button>
                </form>
                <form action={doReveal}>
                  <button type="submit" className={`${compactButtonClass()} w-full`}>Do Reveal</button>
                </form>
              </div>
            </section>

            <section className="rounded-md border border-[#222222] bg-[#0f0f0f] p-3">
              {sectionLabel("Matches Table")}
              {!matches.length ? (
                <p className="mt-3 text-[0.75rem] text-white/55">No matches created yet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[0.75rem]">
                    <thead>
                      <tr className="border-b border-[#222222] text-white/42">
                        <th className="pb-2 font-medium">User A</th>
                        <th className="pb-2 font-medium">User B</th>
                        <th className="pb-2 text-right font-medium">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((match) => (
                        <tr key={match.id} className="border-b border-[#181818] last:border-b-0">
                          <td className="py-2">{match.userA}</td>
                          <td className="py-2">{match.userB}</td>
                          <td className="py-2 text-right font-medium">{match.score}%</td>
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
