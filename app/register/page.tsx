"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewMode, withPreview } from "@/lib/preview";
import { supabase } from "@/lib/supabase";
import { parseUSPhone } from "@/lib/phone";
import { getZodiac } from "@/lib/zodiac";
import { applyThemeGender, persistThemeGender } from "@/lib/theme";

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

function getReadableRandomColor() {
  const channel = () => Math.floor(Math.random() * 156);
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(channel())}${toHex(channel())}${toHex(channel())}`;
}

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

const neutralThemeStyle = {
  backgroundColor: "#ffffff",
  color: "#000000",
  "--background": "#ffffff",
  "--background-strong": "#ffffff",
  "--card": "rgba(255, 255, 255, 0.92)",
  "--card-strong": "rgba(255, 255, 255, 0.98)",
  "--foreground": "#000000",
  "--muted": "rgba(0, 0, 0, 0.62)",
  "--line": "rgba(0, 0, 0, 0.12)",
  "--accent": "#000000",
  "--accent-deep": "#000000",
  "--accent-soft": "rgba(0, 0, 0, 0.08)",
  "--primary": "#000000",
  "--primary-contrast": "#ffffff",
  "--surface": "#ffffff",
  "--input-border": "rgba(0, 0, 0, 0.12)"
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

function getCountdownParts(msRemaining: number) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0")
  };
}

export default function Register() {
  const router = useRouter();
  const previewMode = usePreviewMode();
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState>({ field: "", message: "" });
  const [batchWindow, setBatchWindow] = useState<BatchWindow>({ closesAt: null, status: null });
  const [batchWindowLoaded, setBatchWindowLoaded] = useState(previewMode);
  const [now, setNow] = useState(() => Date.now());
  const [timerColor, setTimerColor] = useState(() => getReadableRandomColor());

  const zodiac =
    form.dob_month && form.dob_day ? getZodiac(Number(form.dob_month), Number(form.dob_day)) : "";
  const neutralTheme = !form.gender;
  const closesAtMs = batchWindow.closesAt ? new Date(batchWindow.closesAt).getTime() : null;
  const countdownExpired = closesAtMs !== null && closesAtMs <= now;
  const registrationUnavailable = !previewMode && batchWindowLoaded && (!batchWindow.closesAt || countdownExpired);
  const countdownLabel = closesAtMs !== null ? formatCountdown(closesAtMs - now) : null;
  const countdownParts = closesAtMs !== null ? getCountdownParts(closesAtMs - now) : null;

  useEffect(() => {
    if (!form.gender) {
      applyThemeGender(null);
      return;
    }

    persistThemeGender(form.gender);
    applyThemeGender(form.gender);
  }, [form.gender]);

  useEffect(() => {
    if (previewMode) {
      const closesAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      setBatchWindow({ closesAt, status: "active" });
      setBatchWindowLoaded(true);
      return;
    }

    async function loadBatchWindow() {
      const { data: batch } = await supabase
        .from("batches")
        .select("registration_closes_at, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setBatchWindow({
        closesAt: batch?.registration_closes_at ?? null,
        status: batch?.status ?? null
      });
      setBatchWindowLoaded(true);
    }

    void loadBatchWindow();
  }, [previewMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setTimerColor(getReadableRandomColor());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function handleFieldChange(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error.field) {
      setError({ field: "", message: "" });
    }
  }

  function validateForm() {
    if (!form.name.trim()) {
      return { field: "name", message: "Please enter your full name" } as ErrorState;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return { field: "email", message: "Enter a valid email address" } as ErrorState;
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

  async function handleSubmit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!batchWindowLoaded && !previewMode) {
      setError({
        field: "submit",
        message: "Checking the current registration window. Please try again in a moment."
      });
      return;
    }

    if (registrationUnavailable) {
      setError({
        field: "submit",
        message: countdownExpired
          ? "Registration is closed for this batch."
          : "There is no active registration window right now."
      });
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
      persistThemeGender(form.gender || "Women");
      applyThemeGender(form.gender || "Women");
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

    persistThemeGender(regForm.gender);
    applyThemeGender(regForm.gender);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: form.email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        data: regForm,
        emailRedirectTo: window.location.origin + "/verify"
      }
    });

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
    <main
      className="flex min-h-screen justify-center px-4 py-4"
      style={neutralTheme ? neutralThemeStyle : undefined}
    >
      <div className="tm-shell max-w-[460px]">
        <div>
        <div className="mb-3 pt-1">
          <h1 className="text-left text-[2.25rem] font-extrabold leading-[0.92] tracking-[-0.06em] text-[var(--foreground)]">
            <span className="block">People who</span>
            <span className="block">think like</span>
            <span className="block">you exist.</span>
          </h1>
          <p className="mt-2 max-w-[20rem] text-left text-[13px] font-medium leading-5 text-[var(--muted)]">
            Join a matching experience built around mindset, behavior, and meaningful connection.
          </p>
          <p
            className="mt-3 text-left text-[1.75rem] leading-none tracking-[-0.06em]"
            style={{
              fontFamily: '"Bodoni 72", "Didot", "Times New Roman", serif',
              fontWeight: 700,
              color: timerColor
            }}
          >
            {countdownLabel ?? "--"}
          </p>
        </div>

        <form className="space-y-2" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              className="w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)]"
              style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
              placeholder="Full name"
              value={form.name}
              onChange={(event) => handleFieldChange("name", event.target.value)}
            />
            <select
              className="w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] outline-none"
              style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
              value={form.gender}
              onChange={(event) => handleFieldChange("gender", event.target.value)}
            >
              <option value="" disabled hidden>Gender</option>
              <option>Men</option>
              <option>Women</option>
            </select>
          </div>
          {error.field === "name" ? <p className="px-1 text-sm text-red-600">{error.message}</p> : null}
          {error.field === "gender" ? <p className="px-1 text-sm text-red-600">{error.message}</p> : null}

          <input
            className="w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)]"
            style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
            placeholder="Email address"
            type="email"
            value={form.email}
            onChange={(event) => handleFieldChange("email", event.target.value)}
          />
          {error.field === "email" ? <p className="px-1 text-sm text-red-600">{error.message}</p> : null}

          <input
            className="w-full rounded-xl px-4 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)]"
            style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
            placeholder="(555) 000-0000"
            type="tel"
            value={form.phone}
            onChange={(event) => handleFieldChange("phone", event.target.value)}
          />
          {error.field === "phone" ? <p className="px-1 text-sm text-red-600">{error.message}</p> : null}

          <div className="grid grid-cols-3 gap-2.5">
            <select
              className="w-full rounded-xl px-3 py-3 text-sm text-[var(--foreground)] outline-none"
              style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
              value={form.dob_month}
              onChange={(event) => handleFieldChange("dob_month", event.target.value)}
            >
              <option value="" disabled hidden>Month</option>
              {monthNames.map((month, index) => (
                <option key={month} value={String(index + 1)}>
                  {month}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl px-3 py-3 text-sm text-[var(--foreground)] outline-none"
              style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
              value={form.dob_day}
              onChange={(event) => handleFieldChange("dob_day", event.target.value)}
            >
              <option value="" disabled hidden>Day</option>
              {days.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl px-3 py-3 text-sm text-[var(--foreground)] outline-none"
              style={{ border: "1px solid var(--input-border)", backgroundColor: "var(--surface)" }}
              value={form.dob_year}
              onChange={(event) => handleFieldChange("dob_year", event.target.value)}
            >
              <option value="" disabled hidden>Year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {error.field === "dob" ? <p className="px-1 text-sm text-red-600">{error.message}</p> : null}
          {zodiac ? <p className="px-1 text-[12px] text-[var(--muted)]">Your zodiac sign: {zodiac}</p> : null}

          {error.field === "submit" ? <p className="px-1 text-sm text-red-600">{error.message}</p> : null}
          {!previewMode && !batchWindowLoaded ? (
            <p className="px-1 text-sm text-[var(--muted)]">Checking if registration is open...</p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !batchWindowLoaded || registrationUnavailable}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
          >
            {loading
              ? "Sending code..."
              : !batchWindowLoaded && !previewMode
                ? "Checking registration..."
                : registrationUnavailable
                  ? "Registration closed"
                  : "Continue"}
          </button>
        </form>
        </div>
      </div>
    </main>
  );
}
