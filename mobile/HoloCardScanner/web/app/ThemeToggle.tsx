"use client";

import { useState } from "react";

type ThemePreference = "system" | "light" | "dark";
const themeKey = "hololive-ocg-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem(themeKey);
    return saved === "light" || saved === "dark" ? saved : "system";
  });

  const updateTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    if (nextTheme === "system") {
      window.localStorage.removeItem(themeKey);
      document.documentElement.removeAttribute("data-theme");
    } else {
      window.localStorage.setItem(themeKey, nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    }
  };

  return (
    <label className="theme-control">
      <span className="sr-only">外觀主題</span>
      <select value={theme} onChange={(event) => updateTheme(event.target.value as ThemePreference)} aria-label="外觀主題" suppressHydrationWarning>
        <option value="system">系統外觀</option>
        <option value="light">淺色</option>
        <option value="dark">深色</option>
      </select>
    </label>
  );
}
