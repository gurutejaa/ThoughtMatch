"use client";

import { useEffect } from "react";
import { applyThemeGender, readStoredThemeGender } from "@/lib/theme";

export default function ThemeProvider({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const storedGender = readStoredThemeGender();
    applyThemeGender(storedGender);
  }, []);

  return <>{children}</>;
}
