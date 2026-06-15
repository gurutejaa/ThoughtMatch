"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock3,
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  TimerReset,
  Wrench
} from "lucide-react";
import type { AdminActionResult } from "@/app/admin/actions";
import {
  clearStuckSessionForUser,
  createIssueForUser,
  extendQuestionWindowForUser,
  forceAdvanceToQuestionsForUser,
  forceAdvanceToRevealForUser,
  resendOtpForUser,
  resetUserRegistration,
  sendCustomMessageToUser,
  updateIssueStatus
} from "@/app/admin/actions";

type IssueItem = {
  id: string;
  description: string;
  status: "open" | "in-progress" | "resolved";
  created_at: string;
};

export type AdminUserItem = {
  id: string;
  name: string;
  email: string;
  gender: string | null;
  completedQuestions: boolean;
  hasMatch: boolean;
  currentStatus: string;
  issues: IssueItem[];
};

type Props = {
  users: AdminUserItem[];
};

function statusPillClass(status: string) {
  if (status === "resolved") {
    return "border-[#D6E8D8] bg-[#F3FBF3] text-[#3F6212]";
  }

  if (status === "in-progress") {
    return "border-[#FDE5D4] bg-[#FFF7ED] text-[#C2410C]";
  }

  return "border-[#FDE5D4] bg-[#FEF7F0] text-[#78716C]";
}

function actionButtonClassName() {
  return "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#FDE5D4] bg-white px-3 text-[12px] font-medium text-[#292524] transition-all duration-200 ease-in-out hover:border-[#C2410C] hover:bg-[#FFF7ED] hover:text-[#C2410C] disabled:cursor-not-allowed disabled:opacity-50";
}

export default function UserIssuePanel({ users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(users[0]?.id ?? null);
  const [messageByUser, setMessageByUser] = useState<Record<string, string>>({});
  const [customMessageByUser, setCustomMessageByUser] = useState<Record<string, string>>({});
  const [issueDraftByUser, setIssueDraftByUser] = useState<Record<string, string>>({});
  const [minutesByUser, setMinutesByUser] = useState<Record<string, number>>({});

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) => {
      return user.name.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery);
    });
  }, [query, users]);

  function runAction(userId: string, action: () => Promise<AdminActionResult>) {
    startTransition(() => {
      void (async () => {
        const result = await action();
        setMessageByUser((current) => ({
          ...current,
          [userId]: result.message
        }));

        if (result.ok) {
          router.refresh();
        }
      })();
    });
  }

  return (
    <section className="rounded-xl border border-[#FDE5D4] bg-white p-5 shadow-[0_4px_14px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">User Issue Resolution</p>
          <h2 className="mt-1 text-[15px] font-semibold text-[#292524]">Fix user problems without touching SQL</h2>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or email"
          className="h-9 w-full max-w-xs rounded-md border border-[#FDE5D4] bg-white px-3 text-[13px] text-[#292524] outline-none transition-all duration-200 ease-in-out placeholder:text-[#A8A29E] focus:border-[#C2410C]"
        />
      </div>

      <div className="mt-4 space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#FDE5D4] px-4 py-5 text-[13px] text-[#78716C]">
            No users match that search.
          </div>
        ) : null}

        {filteredUsers.map((user) => {
          const isExpanded = expandedUserId === user.id;
          const currentMinutes = minutesByUser[user.id] ?? 5;
          const currentMessage = customMessageByUser[user.id] ?? "";
          const currentIssueDraft = issueDraftByUser[user.id] ?? "";

          return (
            <div key={user.id} className="rounded-lg border border-[#FDE5D4] bg-[#FFFCF8]">
              <button
                type="button"
                onClick={() => setExpandedUserId((current) => (current === user.id ? null : user.id))}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="grid flex-1 gap-2 md:grid-cols-[1.4fr_1.4fr_0.8fr_0.8fr_0.8fr_1fr]">
                  <div>
                    <p className="text-[13px] font-semibold text-[#292524]">{user.name}</p>
                    <p className="text-[12px] text-[#78716C]">{user.email}</p>
                  </div>
                  <div className="text-[12px] text-[#78716C]">
                    <p>Gender: {user.gender ?? "Not set"}</p>
                    <p>Status: {user.currentStatus}</p>
                  </div>
                  <div className="text-[12px] text-[#78716C]">
                    <p>Completed</p>
                    <p className="font-medium text-[#292524]">{user.completedQuestions ? "Yes" : "No"}</p>
                  </div>
                  <div className="text-[12px] text-[#78716C]">
                    <p>Has match</p>
                    <p className="font-medium text-[#292524]">{user.hasMatch ? "Yes" : "No"}</p>
                  </div>
                  <div className="text-[12px] text-[#78716C]">
                    <p>Issues</p>
                    <p className="font-medium text-[#292524]">{user.issues.length}</p>
                  </div>
                  <div className="flex items-center justify-start md:justify-end">
                    <span className="rounded-full border border-[#FDE5D4] bg-white px-2.5 py-1 text-[11px] text-[#78716C]">
                      {isExpanded ? "Hide tools" : "Open tools"}
                    </span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-[#78716C]" /> : <ChevronDown size={16} className="text-[#78716C]" />}
              </button>

              {isExpanded ? (
                <div className="border-t border-[#FDE5D4] bg-white px-4 py-4">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[#FDE5D4] bg-[#FEF7F0] p-3">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Quick fixes</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => runAction(user.id, () => resendOtpForUser(user.id))}
                            className={actionButtonClassName()}
                          >
                            <Mail size={14} />
                            User did not receive OTP
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => runAction(user.id, () => forceAdvanceToQuestionsForUser(user.id))}
                            className={actionButtonClassName()}
                          >
                            <Clock3 size={14} />
                            User stuck on waiting page
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => runAction(user.id, () => resetUserRegistration(user.id))}
                            className={actionButtonClassName()}
                          >
                            <RotateCcw size={14} />
                            User closed page during registration
                          </button>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              value={currentMinutes}
                              onChange={(event) =>
                                setMinutesByUser((current) => ({
                                  ...current,
                                  [user.id]: Math.max(1, Number(event.target.value) || 1)
                                }))
                              }
                              className="h-9 w-20 rounded-md border border-[#FDE5D4] bg-white px-2 text-center text-[12px] text-[#292524] outline-none focus:border-[#C2410C]"
                            />
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => runAction(user.id, () => extendQuestionWindowForUser(user.id, currentMinutes))}
                              className={`${actionButtonClassName()} flex-1`}
                            >
                              <TimerReset size={14} />
                              Question timer did not start
                            </button>
                          </div>
                          <div className="rounded-md border border-dashed border-[#FDE5D4] bg-white px-3 py-2 text-[12px] text-[#78716C]">
                            User wants to change an answer: not possible after submission.
                          </div>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => runAction(user.id, () => forceAdvanceToRevealForUser(user.id))}
                            className={actionButtonClassName()}
                          >
                            <ShieldAlert size={14} />
                            Force advance to reveal
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#FDE5D4] bg-[#FEF7F0] p-3">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Custom message</p>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={currentMessage}
                            onChange={(event) =>
                              setCustomMessageByUser((current) => ({
                                ...current,
                                [user.id]: event.target.value
                              }))
                            }
                            placeholder="Tell the user what to do next"
                            className="h-9 flex-1 rounded-md border border-[#FDE5D4] bg-white px-3 text-[13px] text-[#292524] outline-none placeholder:text-[#A8A29E] focus:border-[#C2410C]"
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              runAction(user.id, async () => {
                                const result = await sendCustomMessageToUser(user.id, currentMessage);
                                if (result.ok) {
                                  setCustomMessageByUser((current) => ({ ...current, [user.id]: "" }));
                                }
                                return result;
                              })
                            }
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#C2410C] bg-[#C2410C] px-3 text-[12px] font-medium text-white transition-all duration-200 ease-in-out hover:border-[#9A3412] hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send size={14} />
                            Send
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#FDE5D4] bg-[#FEF7F0] p-3">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Session recovery</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => runAction(user.id, () => clearStuckSessionForUser(user.id))}
                            className={actionButtonClassName()}
                          >
                            <RefreshCw size={14} />
                            Clear stuck session
                          </button>
                          <span className="self-center text-[12px] text-[#78716C]">
                            Forces fresh OTP on next refresh.
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-[#FDE5D4] bg-[#FEF7F0] p-3">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-[#A8A29E]">Issue tracker</p>
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={currentIssueDraft}
                            onChange={(event) =>
                              setIssueDraftByUser((current) => ({
                                ...current,
                                [user.id]: event.target.value
                              }))
                            }
                            placeholder="Describe the user's issue"
                            className="h-9 flex-1 rounded-md border border-[#FDE5D4] bg-white px-3 text-[13px] text-[#292524] outline-none placeholder:text-[#A8A29E] focus:border-[#C2410C]"
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              runAction(user.id, async () => {
                                const result = await createIssueForUser(user.id, currentIssueDraft);
                                if (result.ok) {
                                  setIssueDraftByUser((current) => ({ ...current, [user.id]: "" }));
                                }
                                return result;
                              })
                            }
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#FDE5D4] bg-white px-3 text-[12px] font-medium text-[#292524] transition-all duration-200 ease-in-out hover:border-[#C2410C] hover:bg-[#FFF7ED] hover:text-[#C2410C] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Wrench size={14} />
                            Log issue
                          </button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {user.issues.length === 0 ? (
                            <div className="rounded-md border border-dashed border-[#FDE5D4] bg-white px-3 py-3 text-[12px] text-[#78716C]">
                              No issues logged for this user yet.
                            </div>
                          ) : (
                            user.issues.map((issue) => (
                              <div key={issue.id} className="rounded-md border border-[#FDE5D4] bg-white px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[13px] text-[#292524]">{issue.description}</p>
                                    <p className="mt-1 text-[11px] text-[#A8A29E]">
                                      {new Date(issue.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusPillClass(issue.status)}`}>
                                    {issue.status}
                                  </span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {(["open", "in-progress", "resolved"] as const).map((status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      disabled={isPending || issue.status === status}
                                      onClick={() => runAction(user.id, () => updateIssueStatus(issue.id, status))}
                                      className={actionButtonClassName()}
                                    >
                                      <AlertCircle size={14} />
                                      Mark {status}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#FDE5D4] bg-white px-3 py-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={14} className="text-[#C2410C]" />
                          <p className="text-[12px] text-[#78716C]">Latest admin feedback</p>
                        </div>
                        <p className="mt-2 text-[13px] text-[#292524]">
                          {messageByUser[user.id] ?? "No action run yet for this user."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
