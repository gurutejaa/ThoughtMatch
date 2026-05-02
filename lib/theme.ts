export const THEME_STORAGE_KEY = "thoughtmatch-theme-gender";

export type ThemeGender = "Men" | "Women";

export function normalizeThemeGender(value: unknown): ThemeGender | null {
  if (value === "Men" || value === "Women") {
    return value;
  }

  return null;
}

export function getThemeDataAttribute(value: ThemeGender | null) {
  if (value === "Women") return "women";
  if (value === "Men") return "men";
  return "";
}

export function readStoredThemeGender() {
  if (typeof window === "undefined") return null;

  const storedTheme = normalizeThemeGender(localStorage.getItem(THEME_STORAGE_KEY));
  if (storedTheme) return storedTheme;

  const storedForm = localStorage.getItem("reg_form");
  if (!storedForm) return null;

  try {
    const parsed = JSON.parse(storedForm);
    return normalizeThemeGender(parsed?.gender);
  } catch {
    return null;
  }
}

export function persistThemeGender(value: unknown) {
  if (typeof window === "undefined") return;

  const normalized = normalizeThemeGender(value);
  if (!normalized) return;

  localStorage.setItem(THEME_STORAGE_KEY, normalized);
}

export function applyThemeGender(value: unknown) {
  if (typeof document === "undefined") return;

  const normalized = normalizeThemeGender(value);
  const dataTheme = getThemeDataAttribute(normalized);

  if (dataTheme) {
    document.documentElement.setAttribute("data-theme", dataTheme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}
