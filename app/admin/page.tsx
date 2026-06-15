import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Layers3,
  Play,
  Radio,
  Sparkles,
  Users
} from "lucide-react";
import AdminShell from "@/app/admin/admin-shell";
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
import UserIssuePanel, { type AdminUserItem } from "@/app/admin/user-issue-panel";
import {
  formatCategoryName,
  getAnswerLabel,
  scorePairAnswer,
  type AdminAnswerRecord,
  type AdminQuestionRecord
} from "@/lib/admin-match-breakdown";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const inter = Inter({
  subsets: ["latin"]
});

const ADMIN_COOKIE = "thoughtmatch-admin";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  total_score: number | null;
  match_summary?: string | null;
  match_reasons?: string[] | null;
  shared_answer_count?: number | null;
};

type DomainRow = {
  id: string;
  name: string;
  partner_name: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  gender: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
};

type IssueRow = {
  id: string;
  user_id: string;
  description: string;
  status: "open" | "in-progress" | "resolved";
  created_at: string;
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

type MatchBreakdownRow = {
  questionId: string;
  dayNumber: number | null;
  orderInDay: number | null;
  category: string;
  questionText: string;
  userAAnswer: string;
  userBAnswer: string;
  score: number;
  exactMatch: boolean;
};

type MatchDetail = {
  id: string;
  userA: string;
  userB: string;
  score: number;
  summary: string | null;
  reasons: string[];
  sharedAnswerCount: number;
  breakdown: MatchBreakdownRow[];
};

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

function sectionLabel(text: string) {
  return <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">{text}</p>;
}

function cardClassName(extra = "") {
  return `rounded-xl border border-[#FDE5D4] bg-white p-5 shadow-[0_4px_14px_rgba(0,0,0,0.03)] ${extra}`.trim();
}

function inputClassName() {
  return "h-9 w-full rounded-md border border-[#FDE5D4] bg-white px-3 text-[13px] text-[#292524] outline-none transition-all duration-200 ease-in-out placeholder:text-[#A8A29E] focus:border-[#C2410C]";
}

function buttonClassName({
  accent = false,
  outline = false
}: {
  accent?: boolean;
  outline?: boolean;
} = {}) {
  if (accent) {
    return "inline-flex h-9 items-center justify-center rounded-md border border-[#C2410C] bg-[#C2410C] px-3 text-[13px] font-medium text-white transition-all duration-200 ease-in-out hover:border-[#9A3412] hover:bg-[#9A3412]";
  }

  if (outline) {
    return "inline-flex h-9 items-center justify-center rounded-md border border-[#C2410C] bg-white px-3 text-[13px] font-medium text-[#C2410C] transition-all duration-200 ease-in-out hover:bg-[#FFF7ED]";
  }

  return "inline-flex h-9 items-center justify-center rounded-md border border-[#FDE5D4] bg-white px-3 text-[13px] font-medium text-[#292524] transition-all duration-200 ease-in-out hover:border-[#C2410C] hover:bg-[#FFF7ED] hover:text-[#C2410C]";
}

function comparisonPill(score: number, exactMatch: boolean) {
  if (exactMatch) {
    return "border-[#C2410C] bg-[#FFF7ED] text-[#C2410C]";
  }

  if (score >= 80) {
    return "border-[#E7D5C7] bg-[#FFFCF8] text-[#8C5B3C]";
  }

  if (score >= 50) {
    return "border-[#FDE5D4] bg-white text-[#78716C]";
  }

  return "border-[#F4D4D4] bg-[#FFF8F8] text-[#9F1239]";
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
  const view = readParam(searchParams.view) ?? "active-batch";

  if (!isAuthed) {
    return (
      <main className={`${inter.className} flex min-h-screen items-center justify-center bg-[#FEF7F0] px-6 py-10 text-[#292524]`}>
        <form action={loginAdmin} className="w-full max-w-sm rounded-xl border border-[#FDE5D4] bg-white p-6 shadow-[0_4px_14px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#A8A29E]">ThoughtMatch Admin</p>
          <h1 className="mt-2 text-[24px] font-semibold text-[#292524]">Sign in</h1>
          <p className="mt-2 text-[13px] leading-5 text-[#78716C]">Enter the admin password to open the dashboard.</p>

          <input type="password" name="password" placeholder="Password" className={`${inputClassName()} mt-4`} />

          {error === "invalid-password" ? <p className="mt-2 text-[13px] text-[#C2410C]">Incorrect password.</p> : null}

          <button type="submit" className={`${buttonClassName({ accent: true })} mt-4 w-full`}>
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
  let matchDetails: MatchDetail[] = [];
  let adminUsers: AdminUserItem[] = [];
  let participantUsers: UserRow[] = [];
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
          .select("id, user_a, user_b, total_score, match_summary, match_reasons, shared_answer_count")
          .eq("batch_id", activeBatch.id)
          .order("total_score", { ascending: false })
      ]);

    totalRegistered = registrationCount ?? 0;
    const requiredAnswers = questionCount ?? 0;
    const userIds = (registrations ?? []).map((registration) => registration.user_id);
    const answerCounts = new Map<string, number>();

    if (userIds.length > 0) {
      const { data: answers } = await supabase
        .from("answers")
        .select("user_id")
        .eq("batch_id", activeBatch.id)
        .in("user_id", userIds);

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

    if (typedMatches.length > 0 && matchUserIds.length > 0) {
      const [{ data: questionRows }, { data: answerRows }] = await Promise.all([
        supabase
          .from("questions")
          .select("id, text, category, question_type, option_a, option_b, option_c, option_d, day_number, order_in_day")
          .order("day_number")
          .order("order_in_day"),
        supabase
          .from("answers")
          .select("user_id, question_id, answer_index, answer_text")
          .eq("batch_id", activeBatch.id)
          .in("user_id", matchUserIds)
      ]);

      const questionsById = new Map<string, AdminQuestionRecord>(
        ((questionRows ?? []) as AdminQuestionRecord[]).map((question) => [question.id, question])
      );
      const answersByUser = new Map<string, Map<string, AdminAnswerRecord>>();

      for (const answer of (answerRows ?? []) as AdminAnswerRecord[]) {
        if (!answersByUser.has(answer.user_id)) {
          answersByUser.set(answer.user_id, new Map<string, AdminAnswerRecord>());
        }

        answersByUser.get(answer.user_id)?.set(answer.question_id, answer);
      }

      matchDetails = typedMatches.map((match) => {
        const userAAnswers = answersByUser.get(match.user_a) ?? new Map<string, AdminAnswerRecord>();
        const userBAnswers = answersByUser.get(match.user_b) ?? new Map<string, AdminAnswerRecord>();
        const sharedQuestionIds = Array.from(userAAnswers.keys()).filter((questionId) => userBAnswers.has(questionId));

        const breakdown = sharedQuestionIds
          .map((questionId) => {
            const question = questionsById.get(questionId);
            if (!question) {
              return null;
            }

            const answerA = userAAnswers.get(questionId);
            const answerB = userBAnswers.get(questionId);
            const result = scorePairAnswer(question.question_type, answerA, answerB);

            return {
              questionId,
              dayNumber: question.day_number ?? null,
              orderInDay: question.order_in_day ?? null,
              category: formatCategoryName(question.category),
              questionText: question.text,
              userAAnswer: getAnswerLabel(question, answerA),
              userBAnswer: getAnswerLabel(question, answerB),
              score: result.max > 0 ? Math.round((result.earned / result.max) * 100) : 0,
              exactMatch: result.exactMatch
            } satisfies MatchBreakdownRow;
          })
          .filter((item): item is MatchBreakdownRow => item !== null)
          .sort((a, b) => {
            const dayDiff = (a.dayNumber ?? 0) - (b.dayNumber ?? 0);
            if (dayDiff !== 0) {
              return dayDiff;
            }

            return (a.orderInDay ?? 0) - (b.orderInDay ?? 0);
          });

        return {
          id: match.id,
          userA: userNames.get(match.user_a) ?? "Unknown",
          userB: userNames.get(match.user_b) ?? "Unknown",
          score: Math.round(match.total_score ?? 0),
          summary: match.match_summary ?? null,
          reasons: match.match_reasons ?? [],
          sharedAnswerCount: match.shared_answer_count ?? breakdown.length,
          breakdown
        };
      });
    }

    if (userIds.length > 0) {
      const [{ data: users }, { data: issues }] = await Promise.all([
        supabase.from("users").select("id, name, email, gender, phone, date_of_birth").in("id", userIds).order("name"),
        supabase.from("issues").select("id, user_id, description, status, created_at").in("user_id", userIds).order("created_at", { ascending: false })
      ]);

      participantUsers = (users ?? []) as UserRow[];

      const matchIds = new Set(matchUserIds);
      const issuesByUser = new Map<string, IssueRow[]>();

      for (const issue of (issues ?? []) as IssueRow[]) {
        const items = issuesByUser.get(issue.user_id) ?? [];
        items.push(issue);
        issuesByUser.set(issue.user_id, items);
      }

      adminUsers = participantUsers.map((user) => {
        const now = Date.now();
        const registrationClosesAt = activeBatch.registration_closes_at ? new Date(activeBatch.registration_closes_at).getTime() : null;
        const questionClosesAt = activeBatch.question_closes_at ? new Date(activeBatch.question_closes_at).getTime() : null;
        const completedQuestions = requiredAnswers > 0 && (answerCounts.get(user.id) ?? 0) >= requiredAnswers;
        const hasMatch = matchIds.has(user.id);

        let currentStatus = "Waiting";
        if (activeBatch.reveal_ready) {
          currentStatus = hasMatch ? "Matched" : "No match yet";
        } else if (registrationClosesAt && now < registrationClosesAt) {
          currentStatus = "Registered";
        } else if (questionClosesAt && now < questionClosesAt) {
          currentStatus = completedQuestions ? "Completed questions" : "Questions live";
        } else {
          currentStatus = completedQuestions ? "Waiting for matching" : "Question window closed";
        }

        return {
          id: user.id,
          name: user.name ?? "Unknown",
          email: user.email ?? "No email",
          gender: user.gender ?? null,
          completedQuestions,
          hasMatch,
          currentStatus,
          issues: issuesByUser.get(user.id) ?? []
        };
      });
    }

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
    { title: "Registration", icon: Radio, active: currentStage === "registration", complete: currentStage !== "registration" },
    { title: "Questions", icon: CalendarClock, active: currentStage === "questions", complete: currentStage === "matching" || currentStage === "reveal" },
    { title: "Matching", icon: Activity, active: currentStage === "matching", complete: currentStage === "reveal" },
    { title: "Reveal", icon: Sparkles, active: currentStage === "reveal", complete: false }
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

  const showActiveBatch = view === "active-batch";
  const showParticipants = view === "participants";
  const showTimeline = view === "timeline";
  const showOperations = view === "operations";
  const showDashboard = view === "dashboard";
  const showRunMatching = view === "run-matching";
  const showReveal = view === "reveal";
  const showResults = view === "results";

  return (
    <AdminShell>
      <div className={inter.className}>
        <div className="flex min-h-screen flex-col gap-4 p-4">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[18px] font-semibold text-[#292524]">ThoughtMatch Admin</p>
              <p className="text-[13px] text-[#78716C]">Operate the current batch without leaving this screen.</p>
            </div>
            <RefreshButton />
          </header>

          {error ? (
            <div className="rounded-md border border-[#FDE5D4] bg-[#FFF7ED] px-3 py-2 text-[13px] text-[#C2410C]">
              {error === "no-active-batch"
                ? "There is no active batch right now."
                : error === "missing-env"
                  ? "Missing required admin environment variables."
                  : `Admin action failed: ${decodeURIComponent(error)}`}
            </div>
          ) : null}

          {notices.length > 0 ? (
            <div className="grid gap-2">
              {notices.map((notice) => (
                <div key={notice} className="rounded-md border border-[#FDE5D4] bg-white px-3 py-2 text-[13px] text-[#78716C]">
                  {notice}
                </div>
              ))}
            </div>
          ) : null}

          {!activeBatch?.id ? (
            <section className={cardClassName()}>
              {sectionLabel("Batch")}
              <p className="mt-2 text-[13px] text-[#78716C]">No active batch found.</p>
            </section>
          ) : (
            <>
              {(showActiveBatch || showDashboard || showTimeline) ? (
              <section className={cardClassName()}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {sectionLabel("Batch Status")}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-3 py-1 text-[13px] font-medium text-[#C2410C]">
                        <Clock3 size={14} />
                        {statusLabel}
                      </span>
                      <span className="text-[20px] font-semibold text-[#292524]">{statusCountdown}</span>
                    </div>
                    <p className="mt-3 text-[13px] text-[#78716C]">
                      Batch {truncateBatchId(activeBatch.id)}
                      {activeDomain ? ` · ${activeDomain.name} · ${activeDomain.partner_name}` : ""}
                    </p>
                  </div>
                </div>
              </section>
              ) : null}

              {(showActiveBatch || showDashboard) ? (
              <section className="grid grid-cols-3 gap-4">
                <div className={cardClassName()}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#292524]">Registered</p>
                    <Users size={16} className="text-[#C2410C]" />
                  </div>
                  <p className="mt-4 text-[28px] font-bold leading-none text-[#292524]">{totalRegistered}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Participants in batch</p>
                </div>
                <div className={cardClassName()}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#292524]">Completed Questions</p>
                    <CheckCircle2 size={16} className="text-[#C2410C]" />
                  </div>
                  <p className="mt-4 text-[28px] font-bold leading-none text-[#292524]">{completedAllQuestions}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Ready for scoring</p>
                </div>
                <div className={cardClassName()}>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#292524]">Matches Created</p>
                    <Sparkles size={16} className="text-[#C2410C]" />
                  </div>
                  <p className="mt-4 text-[28px] font-bold leading-none text-[#292524]">{matches.length}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Current batch pairs</p>
                </div>
              </section>
              ) : null}

              {(showActiveBatch || showTimeline) ? (
              <section className={cardClassName()}>
                {sectionLabel("Timeline")}
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {timelineSteps.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.title} className="flex items-center gap-3">
                        <div className="flex flex-1 items-center gap-3">
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] ${
                              step.active || step.complete
                                ? "border-[#C2410C] bg-[#C2410C] text-white"
                                : "border-[#FDE5D4] bg-[#FEF7F0] text-[#A8A29E]"
                            }`}
                          >
                            <Icon size={14} />
                          </span>
                          <span className={`text-[13px] ${step.active ? "font-semibold text-[#292524]" : "text-[#78716C]"}`}>{step.title}</span>
                        </div>
                        {index < timelineSteps.length - 1 ? <span className="h-px flex-1 bg-[#FDE5D4]" /> : null}
                      </div>
                    );
                  })}
                </div>
              </section>
              ) : null}

              {(showActiveBatch || showOperations) ? (
              <section className="grid grid-cols-2 gap-4">
                <div className={cardClassName()}>
                  {sectionLabel("Controls")}
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[13px] font-semibold text-[#292524]">Open Registration</p>
                      <form action={openRegistrationNow} className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input type="number" name="registration_minutes" min="1" defaultValue="30" className={inputClassName()} placeholder="Registration min" />
                        <input type="number" name="question_minutes" min="1" defaultValue="60" className={inputClassName()} placeholder="Question min" />
                        <button type="submit" className={buttonClassName({ accent: true })}>Open</button>
                      </form>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <p className="self-center text-[13px] text-[#78716C]">Close registration immediately</p>
                      <form action={closeRegistrationNow}>
                        <button type="submit" className={buttonClassName()}>Close Now</button>
                      </form>
                    </div>

                    <div>
                      <p className="text-[13px] font-semibold text-[#292524]">Set Question Window</p>
                      <form action={setQuestionWindow} className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                        <input type="number" name="question_minutes" min="1" defaultValue="60" className={inputClassName()} placeholder="Question minutes" />
                        <button type="submit" className={buttonClassName()}>Set Window</button>
                      </form>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <p className="self-center text-[13px] text-[#78716C]">Close questions immediately</p>
                      <form action={closeQuestionsNow}>
                        <button type="submit" className={buttonClassName()}>Close Now</button>
                      </form>
                    </div>
                  </div>
                </div>

                <div className={cardClassName()}>
                  {sectionLabel("Create New Batch")}
                  <div className="mt-4 space-y-3">
                    <p className="text-[13px] font-semibold text-[#292524]">Create New Batch</p>
                    <form action={createNewBatch} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" name="registration_minutes" min="1" defaultValue="30" className={inputClassName()} placeholder="Registration min" />
                        <input type="number" name="question_minutes" min="1" defaultValue="60" className={inputClassName()} placeholder="Question min" />
                      </div>
                      <select
                        name="domain_id"
                        defaultValue={(domains?.[0] as DomainRow | undefined)?.id ?? ""}
                        className={inputClassName()}
                      >
                        {(domains as DomainRow[] | null)?.map((domain) => (
                          <option key={domain.id} value={domain.id}>
                            {domain.name} · {domain.partner_name}
                          </option>
                        )) ?? []}
                      </select>
                      <button
                        type="submit"
                        disabled={!domains || domains.length === 0}
                        className={`${buttonClassName({ accent: true })} w-full disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        Create New Batch
                      </button>
                    </form>
                  </div>
                </div>
              </section>
              ) : null}

              {(showRunMatching || showReveal || showActiveBatch) ? (
              <section className={cardClassName()}>
                {sectionLabel("Matching")}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <form action={runMatching}>
                    <button type="submit" className={`${buttonClassName({ accent: true })} w-full`}>
                      <Activity size={14} />
                      <span className="ml-2">Run Matching</span>
                    </button>
                  </form>
                  <form action={doReveal}>
                    <button type="submit" className={`${buttonClassName({ outline: true })} w-full`}>
                      <Play size={14} />
                      <span className="ml-2">Do Reveal</span>
                    </button>
                  </form>
                </div>
              </section>
              ) : null}

              {(showResults || showRunMatching || showReveal) ? (
              <section className={cardClassName()}>
                {sectionLabel("Matches")}
                {!matches.length ? (
                  <p className="mt-4 text-[13px] text-[#78716C]">No matches created yet.</p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {matchDetails[0] ? (
                      <div className="rounded-xl border border-[#FDE5D4] bg-[#FFFCF8] p-4">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Top Percentage Pair</p>
                        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-[20px] font-semibold text-[#292524]">
                              {matchDetails[0].userA} + {matchDetails[0].userB}
                            </p>
                            <p className="mt-1 text-[13px] text-[#78716C]">
                              Based on {matchDetails[0].sharedAnswerCount} shared answers
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[28px] font-bold leading-none text-[#C2410C]">{matchDetails[0].score}%</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[#A8A29E]">Best current match</p>
                          </div>
                        </div>
                        {matchDetails[0].summary ? (
                          <p className="mt-4 text-[13px] leading-6 text-[#78716C]">{matchDetails[0].summary}</p>
                        ) : null}
                        {matchDetails[0].reasons.length > 0 ? (
                          <div className="mt-4 grid gap-2">
                            {matchDetails[0].reasons.map((reason) => (
                              <div key={reason} className="rounded-md border border-[#FDE5D4] bg-white px-3 py-2 text-[13px] text-[#78716C]">
                                {reason}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[#FDE5D4] text-[#78716C]">
                            <th className="pb-3 font-medium">User A</th>
                            <th className="pb-3 font-medium">User B</th>
                            <th className="pb-3 text-right font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matches.map((match, index) => (
                            <tr key={match.id} className={`${index % 2 === 0 ? "bg-white" : "bg-[#FEF7F0]"} border-b border-[#FDE5D4] last:border-b-0`}>
                              <td className="py-3 text-[#292524]">{match.userA}</td>
                              <td className="py-3 text-[#292524]">{match.userB}</td>
                              <td className="py-3 text-right font-medium text-[#292524]">{match.score}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3">
                      {matchDetails.map((detail) => (
                        <details key={detail.id} className="rounded-xl border border-[#FDE5D4] bg-white open:bg-[#FFFCF8]">
                          <summary className="cursor-pointer list-none px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-[14px] font-semibold text-[#292524]">
                                  {detail.userA} vs {detail.userB}
                                </p>
                                <p className="mt-1 text-[12px] text-[#78716C]">Question-by-question comparison</p>
                              </div>
                              <span className="rounded-full border border-[#FDE5D4] bg-white px-3 py-1 text-[12px] font-medium text-[#C2410C]">
                                {detail.score}%
                              </span>
                            </div>
                          </summary>

                          <div className="border-t border-[#FDE5D4] px-4 py-4">
                            {detail.summary ? (
                              <p className="mb-4 text-[13px] leading-6 text-[#78716C]">{detail.summary}</p>
                            ) : null}

                            <div className="space-y-3">
                              {detail.breakdown.map((row) => (
                                <div key={row.questionId} className="rounded-lg border border-[#FDE5D4] bg-white p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">
                                        Day {row.dayNumber ?? "-"} · {row.category}
                                      </p>
                                      <p className="mt-2 text-[14px] font-medium leading-6 text-[#292524]">{row.questionText}</p>
                                    </div>
                                    <span className={`rounded-full border px-3 py-1 text-[12px] font-medium ${comparisonPill(row.score, row.exactMatch)}`}>
                                      {row.exactMatch ? "Exact match" : `${row.score}% similarity`}
                                    </span>
                                  </div>

                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    <div className="rounded-md border border-[#FDE5D4] bg-[#FEF7F0] p-3">
                                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">{detail.userA}</p>
                                      <p className="mt-2 text-[13px] leading-6 text-[#292524]">{row.userAAnswer}</p>
                                    </div>
                                    <div className="rounded-md border border-[#FDE5D4] bg-[#FEF7F0] p-3">
                                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">{detail.userB}</p>
                                      <p className="mt-2 text-[13px] leading-6 text-[#292524]">{row.userBAnswer}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
              </section>
              ) : null}

              {showParticipants ? (
                <>
                  <section className={cardClassName()}>
                    {sectionLabel("Participants")}
                    {!participantUsers.length ? (
                      <p className="mt-4 text-[13px] text-[#78716C]">No users registered in the active batch yet.</p>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px]">
                          <thead>
                            <tr className="border-b border-[#FDE5D4] text-[#78716C]">
                              <th className="pb-3 font-medium">Name</th>
                              <th className="pb-3 font-medium">Phone</th>
                              <th className="pb-3 font-medium">Email</th>
                              <th className="pb-3 font-medium">Gender</th>
                              <th className="pb-3 font-medium">Date of birth</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participantUsers.map((user, index) => (
                              <tr key={user.id} className={`${index % 2 === 0 ? "bg-white" : "bg-[#FEF7F0]"} border-b border-[#FDE5D4] last:border-b-0`}>
                                <td className="py-3 text-[#292524]">{user.name ?? "Unknown"}</td>
                                <td className="py-3 text-[#292524]">{user.phone ?? "Not provided"}</td>
                                <td className="py-3 text-[#292524]">{user.email ?? "Not provided"}</td>
                                <td className="py-3 text-[#292524]">{user.gender ?? "Not set"}</td>
                                <td className="py-3 text-[#292524]">
                                  {user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : "Not provided"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <UserIssuePanel users={adminUsers} />
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
