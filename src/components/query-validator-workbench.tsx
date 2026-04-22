'use client'

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSearch,
  GitBranchPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildRelationalAlgebra,
  type RelationalAlgebraResult,
} from "@/lib/relational-algebra";
import {
  type QueryValidationResult,
  validateSqlQuery,
} from "@/lib/sql-validator";

type ValidationToast = {
  id: number;
  status: "success" | "error";
  title: string;
  description: string;
};

export default function QueryValidatorWorkbench() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryValidationResult | null>(null);
  const [toast, setToast] = useState<ValidationToast | null>(null);
  const algebra = result?.isValid ? buildRelationalAlgebra(result) : null;

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3600);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const handleValidate = () => {
    const validationResult = validateSqlQuery(query);

    setResult(validationResult);
    setToast({
      id: Date.now(),
      status: validationResult.isValid ? "success" : "error",
      title: validationResult.isValid
        ? "Consulta validada"
        : "Consulta com pendencias",
      description: validationResult.isValid
        ? "Consulta validada e algebra relacional gerada com sucesso."
        : `${validationResult.issues.length} problema(s) encontrado(s). Confira os detalhes abaixo.`,
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="rounded-[2rem] border border-black/6 bg-white/80 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="border-b border-black/6 px-6 py-5 dark:border-white/10 sm:px-8">
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.22em] text-emerald-700 uppercase dark:text-emerald-300">
            HU 01 + HU 02
          </span>

          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Entrada, validacao e algebra relacional
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Digite uma consulta SQL para validar comandos, operadores, tabelas,
            atributos e gerar a expressao equivalente em algebra relacional.
          </p>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="space-y-3">
            <label
              htmlFor="sql-query"
              className="text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              Consulta SQL
            </label>

            <textarea
              id="sql-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              spellCheck={false}
              className="min-h-80 w-full rounded-[1.5rem] border border-black/8 bg-[#faf9f4] px-4 py-4 font-mono text-sm leading-7 text-slate-900 shadow-inner outline-none transition focus:border-cyan-500/40 focus:ring-4 focus:ring-cyan-500/10 dark:border-white/10 dark:bg-[#0f1821] dark:text-slate-100 dark:focus:border-cyan-300/40 dark:focus:ring-cyan-300/10"
              placeholder="Escreva sua query SQL aqui..."
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={handleValidate}>
              Validar consulta
            </Button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div
                className={`rounded-[1.5rem] border px-5 py-5 ${
                  result.isValid
                    ? "border-emerald-500/20 bg-emerald-500/10"
                    : "border-rose-500/20 bg-rose-500/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.isValid ? (
                    <CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-5 text-rose-600 dark:text-rose-300" />
                  )}

                  <div className="w-full">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {result.isValid
                        ? "Consulta valida."
                        : "Consulta invalida."}
                    </p>

                    {result.isValid ? null : (
                      <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-100">
                        {result.issues.map((issue) => (
                          <li key={`${issue.clause}-${issue.message}`}>
                            <span className="font-semibold">{issue.clause}:</span>{" "}
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <MetricBlock
                  title="Tabelas reconhecidas"
                  value={String(countRecognizedTables(result))}
                  icon={<Database className="size-5" />}
                  detail={formatTables(result)}
                />
                <MetricBlock
                  title="JOINs reconhecidos"
                  value={String(result.joinCount)}
                  icon={<GitBranchPlus className="size-5" />}
                  detail={formatRecognizedJoins(result)}
                />
                <MetricBlock
                  title="Campos reconhecidos"
                  value={String(countRecognizedFields(result))}
                  icon={<FileSearch className="size-5" />}
                  detail={formatColumns(result)}
                  mono
                />
              </div>

              {algebra ? <RelationalAlgebraBlock algebra={algebra} /> : null}

              <RecognitionBlock
                title="Consulta normalizada"
                content={result.normalizedQuery || "Nenhuma consulta reconhecida."}
                mono
              />
            </div>
          ) : null}
        </div>
      </div>

      {toast ? <ValidationToast key={toast.id} toast={toast} /> : null}
    </div>
  );
}

function RelationalAlgebraBlock({
  algebra,
}: {
  algebra: RelationalAlgebraResult;
}) {
  return (
    <div className="rounded-[1.5rem] border border-cyan-500/20 bg-cyan-500/10 px-5 py-5 dark:border-cyan-300/20 dark:bg-cyan-300/8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-cyan-700 uppercase dark:text-cyan-300">
            HU 02
          </p>
          <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Algebra relacional
          </h3>
        </div>

        <div className="rounded-full border border-cyan-500/20 bg-white/60 px-3 py-1 font-mono text-xs text-cyan-800 dark:border-cyan-300/20 dark:bg-white/8 dark:text-cyan-200">
          π / σ / ⋈
        </div>
      </div>

      <p className="mt-4 overflow-x-auto rounded-[1rem] border border-black/6 bg-white/70 px-4 py-4 font-mono text-sm leading-7 text-slate-900 dark:border-white/10 dark:bg-[#0f1821] dark:text-slate-100">
        {algebra.expression}
      </p>

      <div className="mt-4 grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
        <AlgebraDetail label="Projecao" value={algebra.projection} />
        <AlgebraDetail
          label="Selecao"
          value={algebra.selection ?? "Sem condicao WHERE"}
        />
        <AlgebraDetail
          label="Juncoes"
          value={
            algebra.joins.length > 0
              ? `${algebra.joins.length} join(s) preservado(s)`
              : "Sem JOIN na consulta"
          }
        />
      </div>
    </div>
  );
}

function AlgebraDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-black/6 bg-white/60 px-3 py-3 dark:border-white/10 dark:bg-white/6">
      <p className="font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 line-clamp-3 font-mono text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function ValidationToast({ toast }: { toast: ValidationToast }) {
  const isSuccess = toast.status === "success";

  return (
    <div
      aria-live="polite"
      className={`fixed right-4 bottom-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-[1.25rem] border px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 sm:right-6 sm:bottom-6 ${
        isSuccess
          ? "border-emerald-500/25 bg-emerald-50/95 text-emerald-950 dark:bg-emerald-950/85 dark:text-emerald-50"
          : "border-rose-500/25 bg-rose-50/95 text-rose-950 dark:bg-rose-950/85 dark:text-rose-50"
      }`}
    >
      <div className="flex gap-3">
        {isSuccess ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        ) : (
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600 dark:text-rose-300" />
        )}

        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{toast.description}</p>
        </div>
      </div>
    </div>
  );
}

function formatTables(result: QueryValidationResult) {
  if (result.tables.length === 0) {
    return "Nenhuma tabela reconhecida.";
  }

  return result.tables
    .map((table) =>
      table.alias ? `${table.tableName} (alias: ${table.alias})` : table.tableName,
    )
    .join(", ");
}

function formatColumns(result: QueryValidationResult) {
  if (result.resolvedColumns.length === 0) {
    return "Nenhum campo reconhecido.";
  }

  return Array.from(
    new Set(
      result.resolvedColumns.map(
        (column) =>
          `${column.reference} -> ${column.resolvedTable}.${column.resolvedColumn}`,
      ),
    ),
  ).join(", ");
}

function formatRecognizedJoins(result: QueryValidationResult) {
  const joins = result.tables.filter((table) => table.source === "join");

  if (joins.length === 0) {
    return "Nenhum JOIN reconhecido.";
  }

  return joins
    .map((table) =>
      table.alias ? `${table.tableName} (alias: ${table.alias})` : table.tableName,
    )
    .join(", ");
}

function countRecognizedTables(result: QueryValidationResult) {
  return new Set(
    result.tables.map((table) =>
      `${table.tableName}:${table.alias ?? "sem-alias"}`,
    ),
  ).size;
}

function countRecognizedFields(result: QueryValidationResult) {
  return new Set(
    result.resolvedColumns.map(
      (column) =>
        `${column.reference}:${column.resolvedTable}.${column.resolvedColumn}`,
    ),
  ).size;
}

function MetricBlock({
  title,
  value,
  icon,
  detail,
  mono = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  detail: string;
  mono?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand = detail.length > 120;

  return (
    <div className="rounded-[1.35rem] border border-black/6 bg-[#faf9f4] px-4 py-4 dark:border-white/10 dark:bg-[#101821]">
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300">
        <div className="rounded-2xl bg-slate-950/8 p-2 dark:bg-white/8">
          {icon}
        </div>
        <p className="text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
          {title}
        </p>
      </div>
      <p className="mt-4 font-heading text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
      <p
        className={`mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300 ${
          canExpand && !isExpanded ? "line-clamp-3" : ""
        } ${mono ? "font-mono" : ""}`}
      >
        {detail}
      </p>

      {canExpand ? (
        <button
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="mt-3 text-xs font-semibold text-cyan-700 transition hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100"
        >
          {isExpanded ? "Mostrar menos" : "Ver tudo..."}
        </button>
      ) : null}
    </div>
  );
}

function RecognitionBlock({
  title,
  content,
  mono = false,
}: {
  title: string;
  content: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[1.35rem] border border-black/6 bg-[#faf9f4] px-4 py-4 dark:border-white/10 dark:bg-[#101821]">
      <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
        {title}
      </p>
      <p
        className={`mt-2 text-sm leading-6 text-slate-800 dark:text-slate-100 ${
          mono ? "font-mono" : ""
        }`}
      >
        {content}
      </p>
    </div>
  );
}
