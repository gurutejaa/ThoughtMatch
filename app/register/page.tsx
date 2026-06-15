"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewMode, withPreview } from "@/lib/preview";
import { supabase } from "@/lib/supabase";
import { parseUSPhone } from "@/lib/phone";
import { getZodiac } from "@/lib/zodiac";

type FormState = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  dob_month: string;
  dob_day: string;
  dob_year: string;
};

type ErrorState = {
  field: "name" | "email" | "phone" | "dob" | "gender" | "submit" | "";
  message: string;
};

type BatchWindow = {
  closesAt: string | null;
  status: string | null;
};

type BatchStatusResponse = {
  id?: string | null;
  status?: string | null;
  registration_closes_at?: string | null;
  question_closes_at?: string | null;
  reveal_ready?: boolean;
  current_time?: string;
};

type RegisterStage = "email" | "new" | "returning";

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  gender: "",
  dob_month: "",
  dob_day: "",
  dob_year: ""
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const registerThemeStyle = {
  backgroundColor: "#FEF7F0",
  color: "#292524",
  "--background": "#FEF7F0",
  "--background-strong": "#FFFFFF",
  "--card": "#FFFFFF",
  "--card-strong": "#FFFFFF",
  "--foreground": "#292524",
  "--muted": "#A8A29E",
  "--line": "#FDE5D4",
  "--accent": "#C2410C",
  "--accent-deep": "#C2410C",
  "--accent-soft": "#FFF7ED",
  "--primary": "#C2410C",
  "--primary-contrast": "#FFFFFF",
  "--surface": "#FFFFFF",
  "--input-border": "#FDE5D4"
} as React.CSSProperties;

function getAge(year: string, month: string, day: string) {
  if (!year || !month || !day) return null;

  const birthDate = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function formatCountdown(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const inputClassName =
  "h-11 w-full rounded-lg border border-[#FDE5D4] bg-white px-4 text-sm text-[#292524] outline-none transition-all duration-200 ease-in-out placeholder:text-[#A8A29E] focus:border-[#C2410C]";

const selectClassName =
  "h-11 w-full rounded-lg border border-[#FDE5D4] bg-white px-4 text-sm text-[#292524] outline-none transition-all duration-200 ease-in-out focus:border-[#C2410C]";

const buttonClassName =
  "mt-2 h-11 w-full rounded-lg bg-[#C2410C] px-4 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:bg-[#9A3412] disabled:cursor-not-allowed disabled:opacity-50";

export default function Register() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [form, setForm] = useState<FormState>(initialForm);
  const [stage, setStage] = useState<RegisterStage>(previewMode ? "new" : "email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState>({ field: "", message: "" });
  const [batchWindow, setBatchWindow] = useState<BatchWindow>({ closesAt: null, status: null });
  const [batchWindowLoaded, setBatchWindowLoaded] = useState(previewMode);
  const [now, setNow] = useState(() => Date.now());
  const [registrationClosedNotice, setRegistrationClosedNotice] = useState(false);

  const zodiac =
    form.dob_month && form.dob_day ? getZodiac(Number(form.dob_month), Number(form.dob_day)) : "";
  const closesAtMs = batchWindow.closesAt ? new Date(batchWindow.closesAt).getTime() : null;
  const countdownExpired = closesAtMs !== null && closesAtMs <= now;
  const registrationUnavailable = !previewMode && batchWindowLoaded && (!batchWindow.closesAt || countdownExpired);
  const countdownLabel = closesAtMs !== null ? formatCountdown(closesAtMs - now) : null;

  useEffect(() => {
    if (previewMode) {
      setStage("new");
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) {
      const closesAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      setBatchWindow({ closesAt, status: "active" });
      setBatchWindowLoaded(true);
      return;
    }

    async function loadBatchWindow() {
      try {
        const response = await fetch("/api/active-batch", { cache: "no-store" });
        const payload = (await response.json()) as { closesAt?: string | null; status?: string | null };

        setBatchWindow({
          closesAt: payload?.closesAt ?? null,
          status: payload?.status ?? null
        });
      } catch {
        setBatchWindow({
          closesAt: null,
          status: null
        });
      }

      setBatchWindowLoaded(true);
    }

    void loadBatchWindow();
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;

    async function pollBatchStatus() {
      try {
        const response = await fetch("/api/batch-status", { cache: "no-store" });
        const payload = (await response.json()) as BatchStatusResponse;

        if (!response.ok) {
          return;
        }

        const previousClosesAt = batchWindow.closesAt ? new Date(batchWindow.closesAt).getTime() : null;
        const nextClosesAt = payload.registration_closes_at ? new Date(payload.registration_closes_at).getTime() : null;
        const currentServerTime = payload.current_time ? new Date(payload.current_time).getTime() : Date.now();

        if (
          previousClosesAt !== null &&
          nextClosesAt !== null &&
          previousClosesAt > currentServerTime &&
          nextClosesAt <= currentServerTime
        ) {
          setRegistrationClosedNotice(true);
        }

        setBatchWindow({
          closesAt: payload.registration_closes_at ?? null,
          status: payload.status ?? null
        });

        if (!Number.isNaN(currentServerTime)) {
          setNow(currentServerTime);
        }
      } catch {
        // keep current UI state if polling fails
      }
    }

    const interval = window.setInterval(() => {
      void pollBatchStatus();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [batchWindow.closesAt, previewMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function handleFieldChange(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error.field) {
      setError({ field: "", message: "" });
    }
  }

  function validateRegistrationWindow() {
    if (!batchWindowLoaded && !previewMode) {
      return {
        field: "submit",
        message: "Checking the current registration window. Please try again in a moment."
      } as ErrorState;
    }

    if (registrationUnavailable) {
      return {
        field: "submit",
        message: countdownExpired
          ? "Registration is closed for this batch."
          : "There is no active registration window right now."
      } as ErrorState;
    }

    return null;
  }

  function validateForm() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim().toLowerCase())) {
      return { field: "email", message: "Enter a valid email address" } as ErrorState;
    }

    if (!form.name.trim()) {
      return { field: "name", message: "Please enter your full name" } as ErrorState;
    }

    const phoneResult = parseUSPhone(form.phone);
    if (!phoneResult.valid) {
      return { field: "phone", message: phoneResult.error } as ErrorState;
    }

    if (!form.dob_month || !form.dob_day || !form.dob_year) {
      return { field: "dob", message: "Please select your full date of birth" } as ErrorState;
    }

    const age = getAge(form.dob_year, form.dob_month, form.dob_day);
    if (age === null || age < 21) {
      return { field: "dob", message: "You must be 21 or older to join ThoughtMatch." } as ErrorState;
    }

    if (!form.gender) {
      return { field: "gender", message: "Please select your gender" } as ErrorState;
    }

    return null;
  }

  async function sendOtp(email: string, regData?: Record<string, string>) {
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + "/verify",
        ...(regData ? { data: regData } : {})
      }
    });

    return signInError;
  }

  async function handleEmailContinue(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const batchError = validateRegistrationWindow();
    if (batchError) {
      setError(batchError);
      return;
    }

    const normalizedEmail = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError({ field: "email", message: "Enter a valid email address" });
      return;
    }

    setLoading(true);
    setError({ field: "", message: "" });

    try {
      const response = await fetch("/api/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const payload = (await response.json()) as { exists?: boolean; error?: string };

      if (!response.ok) {
        setError({ field: "submit", message: payload.error ?? "Unable to check this email right now." });
        setLoading(false);
        return;
      }

      if (payload.exists) {
        localStorage.setItem(
          "reg_form",
          JSON.stringify({
            email: normalizedEmail,
            returning_user: true
          })
        );

        const signInError = await sendOtp(normalizedEmail);
        if (signInError) {
          setError({ field: "submit", message: signInError.message });
          setLoading(false);
          return;
        }

        setStage("returning");
        setLoading(false);

        window.setTimeout(() => {
          router.push(withPreview("/verify", previewMode));
        }, 900);
        return;
      }

      setForm((current) => ({ ...current, email: normalizedEmail }));
      setStage("new");
      setLoading(false);
    } catch {
      setError({ field: "submit", message: "Unable to check this email right now." });
      setLoading(false);
    }
  }

  async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const batchError = validateRegistrationWindow();
    if (batchError) {
      setError(batchError);
      return;
    }

    if (!previewMode) {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setLoading(true);
    setError({ field: "", message: "" });

    if (previewMode) {
      localStorage.setItem(
        "reg_form",
        JSON.stringify({
          name: form.name || "Preview User",
          email: form.email || "preview@thoughtmatch.app",
          phone: form.phone || "(555) 000-0000",
          normalized_phone: "5550000000",
          country_code: "+1",
          area_code: "555",
          gender: form.gender || "Women",
          interested_in: "Everyone",
          date_of_birth: `${form.dob_year || "1998"}-${String(form.dob_month || "8").padStart(2, "0")}-${String(form.dob_day || "8").padStart(2, "0")}`,
          zodiac: zodiac || "Leo"
        })
      );

      router.push(withPreview("/verify", previewMode));
      return;
    }

    const phoneData = parseUSPhone(form.phone);
    if (!phoneData.valid) {
      setLoading(false);
      setError({ field: "phone", message: phoneData.error });
      return;
    }

    const regForm = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone,
      normalized_phone: phoneData.normalized,
      country_code: phoneData.country_code,
      area_code: phoneData.area_code,
      gender: form.gender,
      interested_in: "Everyone",
      date_of_birth:
        `${form.dob_year}-${String(form.dob_month).padStart(2, "0")}-${String(form.dob_day).padStart(2, "0")}`,
      zodiac: getZodiac(Number(form.dob_month), Number(form.dob_day))
    };

    const signInError = await sendOtp(form.email.trim().toLowerCase(), regForm);

    if (signInError) {
      setError({ field: "submit", message: signInError.message });
      setLoading(false);
      return;
    }

    localStorage.setItem("reg_form", JSON.stringify(regForm));
    router.push(withPreview("/verify", previewMode));
  }

  const years = Array.from({ length: new Date().getFullYear() - 1940 - 20 }, (_, index) =>
    String(new Date().getFullYear() - 21 - index)
  );
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1));

  return (
    <main className="relative flex min-h-screen justify-center overflow-hidden px-4 py-6" style={registerThemeStyle}>
      <div className="tm-shell relative z-10 max-w-[460px]">
        <div className="rounded-2xl border border-[#FDE5D4] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="mb-4 pt-1">
            <div className="flex items-start justify-between gap-4">
              <h1
                className="text-left text-[2.5rem] font-medium leading-[0.92] tracking-[-0.05em] text-[#292524]"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                <span className="block">People who</span>
                <span className="block">think like</span>
                <span className="block">you exist.</span>
              </h1>
              <p className="pt-1 text-right text-[13px] font-medium text-[#78716C]">{countdownLabel ?? "--"}</p>
            </div>
            <p className="mt-3 max-w-[20rem] text-left text-[13px] font-medium leading-5 text-[#78716C]">
              Join a matching experience built around mindset, behavior, and meaningful connection.
            </p>
          </div>

          {stage === "email" ? (
            <form className="space-y-2" onSubmit={handleEmailContinue}>
              <input
                className={inputClassName}
                placeholder="Email address"
                type="email"
                value={form.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
              />
              {error.field === "email" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}
              {error.field === "submit" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}
              {registrationClosedNotice ? (
                <p className="px-1 text-sm text-[#78716C]">Registration is now closed.</p>
              ) : null}
              {!previewMode && !batchWindowLoaded ? (
                <p className="px-1 text-sm text-[#78716C]">Checking if registration is open...</p>
              ) : null}
              <button type="submit" disabled={loading || !batchWindowLoaded || registrationUnavailable} className={buttonClassName}>
                {loading
                  ? "Checking..."
                  : !batchWindowLoaded && !previewMode
                    ? "Checking registration..."
                    : registrationUnavailable
                      ? "Registration closed"
                      : "Continue"}
              </button>
            </form>
          ) : null}

          {stage === "returning" ? (
            <section className="rounded-2xl border border-[#FDE5D4] bg-white px-5 py-6">
              <p className="text-xl font-semibold text-[#292524]">Welcome back.</p>
              <p className="mt-2 text-sm leading-6 text-[#78716C]">
                We sent a code to your email. Taking you to verification now.
              </p>
              <button
                type="button"
                onClick={() => router.push(withPreview("/verify", previewMode))}
                className="mt-5 h-11 w-full rounded-lg bg-[#C2410C] px-4 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:bg-[#9A3412]"
              >
                Enter code
              </button>
            </section>
          ) : null}

          {stage === "new" ? (
            <form className="space-y-2" onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  className={inputClassName}
                  placeholder="Full name"
                  value={form.name}
                  onChange={(event) => handleFieldChange("name", event.target.value)}
                />
                <select className={selectClassName} value={form.gender} onChange={(event) => handleFieldChange("gender", event.target.value)}>
                  <option value="" disabled hidden>
                    Gender
                  </option>
                  <option>Men</option>
                  <option>Women</option>
                </select>
              </div>
              {error.field === "name" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}
              {error.field === "gender" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}

              <input
                className={inputClassName}
                placeholder="Email address"
                type="email"
                value={form.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
              />
              {error.field === "email" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}

              <input
                className={inputClassName}
                placeholder="(555) 000-0000"
                type="tel"
                value={form.phone}
                onChange={(event) => handleFieldChange("phone", event.target.value)}
              />
              {error.field === "phone" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}

              <div className="grid grid-cols-3 gap-2.5">
                <select className={selectClassName} value={form.dob_month} onChange={(event) => handleFieldChange("dob_month", event.target.value)}>
                  <option value="" disabled hidden>
                    Month
                  </option>
                  {monthNames.map((month, index) => (
                    <option key={month} value={String(index + 1)}>
                      {month}
                    </option>
                  ))}
                </select>
                <select className={selectClassName} value={form.dob_day} onChange={(event) => handleFieldChange("dob_day", event.target.value)}>
                  <option value="" disabled hidden>
                    Day
                  </option>
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <select className={selectClassName} value={form.dob_year} onChange={(event) => handleFieldChange("dob_year", event.target.value)}>
                  <option value="" disabled hidden>
                    Year
                  </option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              {error.field === "dob" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}
              {zodiac ? <p className="px-1 text-[12px] text-[#78716C]">Your zodiac sign: {zodiac}</p> : null}

              {error.field === "submit" ? <p className="px-1 text-sm text-[#C2410C]">{error.message}</p> : null}
              {registrationClosedNotice ? <p className="px-1 text-sm text-[#78716C]">Registration is now closed.</p> : null}

              <button type="submit" disabled={loading || !batchWindowLoaded || registrationUnavailable} className={buttonClassName}>
                {loading
                  ? "Sending code..."
                  : !batchWindowLoaded && !previewMode
                    ? "Checking registration..."
                    : registrationUnavailable
                      ? "Registration closed"
                      : "Continue"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
