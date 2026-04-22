'use client'

import { MoonStar, SunMedium } from "lucide-react";

const STORAGE_KEY = "querycraft-theme";

export default function ThemeToggle() {
  const handleToggle = () => {
    const root = document.documentElement;
    const nextTheme = root.classList.contains("dark") ? "light" : "dark";

    root.classList.toggle("dark", nextTheme === "dark");
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Alternar tema claro e escuro"
      className="inline-flex h-11 items-center gap-2 rounded-2xl border border-black/8 bg-white/70 px-3 text-xs font-semibold tracking-[0.2em] text-slate-700 uppercase shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/6 dark:text-slate-100 dark:hover:bg-white/10"
    >
      <SunMedium className="size-4 text-amber-600 transition-transform dark:hidden" />
      <MoonStar className="hidden size-4 text-cyan-300 dark:block" />
      <span className="dark:hidden">Claro</span>
      <span className="hidden dark:inline">Escuro</span>
    </button>
  );
}
