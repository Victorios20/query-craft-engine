import ThemeToggle from "@/components/theme-toggle";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/6 bg-background/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#091017]/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl border border-black/6 bg-white/80 shadow-[0_14px_32px_rgba(15,23,42,0.09)] dark:border-white/10 dark:bg-white/6">
            <div className="absolute inset-[3px] rounded-[14px] bg-gradient-to-br from-teal-500/20 via-cyan-400/15 to-amber-400/25 dark:from-cyan-400/25 dark:via-teal-300/12 dark:to-amber-300/18" />
            <div className="relative rounded-xl bg-slate-950 px-2 py-1 font-mono text-[0.65rem] font-semibold tracking-[0.3em] text-white dark:bg-white dark:text-slate-950">
              QC
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[0.66rem] font-semibold tracking-[0.22em] text-slate-500 uppercase dark:text-slate-400">
              <span className="rounded-full border border-black/8 bg-white/70 px-2.5 py-1 dark:border-white/10 dark:bg-white/6">
                Projeto 2
              </span>
              <span>Processador de Consultas SQL</span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-heading text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                QueryCraft
              </h1>
              <p className="font-mono text-[0.72rem] text-slate-500 dark:text-slate-400">
                Victor Rios Dantas - 2310350
              </p>
            </div>
          </div>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
}
