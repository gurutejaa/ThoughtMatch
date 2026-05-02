"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewMode } from "@/lib/preview";
import { supabase } from "@/lib/supabase";

export default function Verify() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [resent, setResent] = useState(false);
  const [mode, setMode] = useState<"checking" | "otp" | "completing">("checking");

  useEffect(() => {
    const stored = localStorage.getItem("reg_form");
    if (stored) {
      const reg = JSON.parse(stored);
      if (reg?.email) {
        setEmail(reg.email);
      }
    }
  }, []);

  useEffect(() => {
    if (previewMode) {
      setMode("otp");
      return;
    }

    async function checkExistingSession() {
      setLoading(true);
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        setMode("completing");
        await completeRegistration(session);
        return;
      }

      setMode("otp");
      setLoading(false);
    }

    void checkExistingSession();
  }, [previewMode]);

  useEffect(() => {
    if (countdown <= 0 || mode !== "otp") return;
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, mode]);

  useEffect(() => {
    if (!resent) return;
    const timer = window.setTimeout(() => setResent(false), 2000);
    return () => window.clearTimeout(timer);
  }, [resent]);

  async function completeRegistration(session: any) {
    let reg: any = null;
    const stored = localStorage.getItem("reg_form");

    if (stored) {
      reg = JSON.parse(stored);
    } else {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      reg = user?.user_metadata ?? null;
    }

    if (!reg || !reg.name) {
      setError("Registration data missing — please register again");
      setLoading(false);
      setMode("otp");
      return;
    }

    const { data: batch } = await supabase
      .from("batches")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!batch) {
      setError("No active batch right now. You will be notified when the next one opens.");
      setLoading(false);
      setMode("otp");
      return;
    }

    const { error: upsertError } = await supabase.from("users").upsert({
      id: session.user.id,
      name: reg.name,
      email: reg.email,
      phone: reg.phone,
      normalized_phone: reg.normalized_phone,
      country_code: reg.country_code,
      area_code: reg.area_code,
      gender: reg.gender,
      interested_in: reg.interested_in,
      date_of_birth: reg.date_of_birth,
      zodiac: reg.zodiac,
      verified: true,
      batch_id: batch.id
    });

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      setMode("otp");
      return;
    }

    localStorage.removeItem("reg_form");
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "true";
    router.push("/waiting" + (isPreview ? "?preview=true" : ""));
  }

  async function handleResend() {
    const stored = localStorage.getItem("reg_form");
    const reg = stored ? JSON.parse(stored) : null;

    if (!reg?.email) {
      setError("Registration data missing — please register again");
      return;
    }

    setError("");

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: reg.email,
      options: { shouldCreateUser: true }
    });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setCountdown(30);
    setResent(true);
  }

  async function handleOTPSubmit() {
    setLoading(true);
    setError("");

    if (previewMode) {
      router.push("/waiting?preview=true");
      return;
    }

    let reg: any = null;
    const stored = localStorage.getItem("reg_form");
    if (stored) reg = JSON.parse(stored);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: reg?.email,
      token: otp,
      type: "email"
    });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (!session) {
      setError("Session failed — please try again");
      setLoading(false);
      return;
    }

    setMode("completing");
    await completeRegistration(session);
  }

  const subtext = useMemo(() => {
    if (mode === "completing" || mode === "checking") {
      return "Completing your registration.";
    }

    if (!email) {
      return "We sent a 6-digit code to your email. Enter it below, or click the link in the email.";
    }

    return `We sent a 6-digit code to ${email}. Enter it below, or click the link in the email.`;
  }, [email, mode]);

  return (
    <main className="flex min-h-screen items-center px-6 py-10">
      <div className="tm-shell">
        <div className="mb-8">
          <p className="tm-kicker text-sm text-[var(--accent-deep)]">
            {mode === "completing" || mode === "checking" ? "Almost there..." : "Check your email"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--foreground)]">
            {mode === "completing" || mode === "checking" ? "Almost there..." : "Check your email"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{subtext}</p>
        </div>

        <section className="tm-panel rounded-[2rem] p-5">
          {mode === "completing" || mode === "checking" ? (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--muted)]">Verifying...</p>
            </div>
          ) : (
            <>
              <input
                className="w-full rounded-3xl border border-[var(--line)] bg-[var(--background-strong)] px-4 py-4 text-center text-3xl tracking-[0.55em] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
              />

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
              {resent ? <p className="mt-4 text-sm text-[var(--muted)]">Code resent</p> : null}

              <button
                type="button"
                onClick={handleOTPSubmit}
                disabled={!previewMode && (loading || otp.length < 6)}
                className="mt-6 w-full rounded-2xl bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>

              {countdown <= 0 ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="mt-4 w-full text-center text-sm text-[var(--muted)]"
                >
                  Resend code
                </button>
              ) : (
                <p className="mt-4 text-center text-sm text-[var(--muted)]">Resend code in {countdown}s</p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
