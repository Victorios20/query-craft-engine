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
  buildExecutionPlan,
  type ExecutionPlan,
} from "@/lib/execution-plan";
import {
  buildRelationalAlgebra,
  type RelationalAlgebraResult,
} from "@/lib/relational-algebra";
import {
  buildOperatorGraph,
  type OperatorGraph,
  type OperatorGraphNode,
} from "@/lib/operator-graph";
import {
  buildOptimizedQueryPlan,
  type OptimizedQueryPlan,
} from "@/lib/query-optimizer";
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
  const operatorGraph = result?.isValid ? buildOperatorGraph(result) : null;
  const optimizedPlan = result?.isValid ? buildOptimizedQueryPlan(result) : null;
  const executionPlan = optimizedPlan ? buildExecutionPlan(optimizedPlan) : null;

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
        ? "Algebra, grafo logico, grafo otimizado e plano de execucao gerados com sucesso."
        : `${validationResult.issues.length} problema(s) encontrado(s). Confira os detalhes abaixo.`,
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="rounded-[2rem] border border-black/6 bg-white/80 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]">
        <div className="border-b border-black/6 px-6 py-5 dark:border-white/10 sm:px-8">
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.22em] text-emerald-700 uppercase dark:text-emerald-300">
            HU 01 + HU 02 + HU 03 + HU 04 + HU 05
          </span>

          <h2 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Entrada, algebra, grafo e execucao
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Digite uma consulta SQL para validar comandos, operadores, tabelas,
            atributos, gerar algebra relacional, visualizar o grafo e comparar
            a estrategia otimizada junto com a ordem de execucao.
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
              {operatorGraph ? <OperatorGraphBlock graph={operatorGraph} /> : null}
              {optimizedPlan ? (
                <OptimizedGraphBlock optimizedPlan={optimizedPlan} />
              ) : null}
              {executionPlan ? (
                <ExecutionPlanBlock executionPlan={executionPlan} />
              ) : null}

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

function ExecutionPlanBlock({
  executionPlan,
}: {
  executionPlan: ExecutionPlan;
}) {
  return (
    <div className="rounded-[1.5rem] border border-fuchsia-500/20 bg-fuchsia-500/10 px-5 py-5 dark:border-fuchsia-300/20 dark:bg-fuchsia-300/8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-fuchsia-700 uppercase dark:text-fuchsia-300">
            HU 05
          </p>
          <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Plano de execucao
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            A sequencia abaixo segue exatamente a dependencia do grafo
            otimizado: das tabelas folha ate a projecao final.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GraphSummaryPill
            label="Etapas"
            value={String(executionPlan.steps.length)}
            tone="fuchsia"
          />
          <GraphSummaryPill
            label="Ultima"
            value={
              executionPlan.steps[executionPlan.steps.length - 1]?.symbol ?? "?"
            }
            tone="fuchsia"
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {executionPlan.steps.map((step, index) => {
          const isFinalStep = index === executionPlan.steps.length - 1;

          return (
            <div
              key={step.nodeId}
              className="rounded-[1.2rem] border border-black/6 bg-white/70 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/6"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 text-sm font-semibold text-white shadow-sm dark:bg-fuchsia-300 dark:text-fuchsia-950">
                  {step.order}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1 font-mono text-[0.7rem] text-fuchsia-800 dark:border-fuchsia-300/20 dark:bg-fuchsia-300/10 dark:text-fuchsia-200">
                      {step.symbol}
                    </span>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {step.title}
                    </p>
                    {isFinalStep ? (
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.12em] text-cyan-800 uppercase dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
                        resultado final
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 font-mono text-xs leading-6 text-slate-700 dark:text-slate-200">
                    {step.detail}
                  </p>

                  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {step.inputs.length > 0
                      ? `Entradas: ${step.inputs.join(" + ")}`
                      : "Origem: tabela folha do grafo otimizado."}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptimizedGraphBlock({
  optimizedPlan,
}: {
  optimizedPlan: OptimizedQueryPlan;
}) {
  const nodeById = new Map(
    optimizedPlan.graph.nodes.map((node) => [node.id, node]),
  );

  return (
    <div className="rounded-[1.5rem] border border-lime-500/20 bg-lime-500/10 px-5 py-5 dark:border-lime-300/20 dark:bg-lime-300/8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-lime-700 uppercase dark:text-lime-300">
            HU 04
          </p>
          <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Grafo otimizado
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            O plano abaixo aplica selecoes antes, reduz atributos na sequencia
            e escolhe a ordem de juncao sem gerar produto cartesiano.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GraphSummaryPill
            label="Selecoes"
            value={String(optimizedPlan.pushedSelectionCount)}
            tone="lime"
          />
          <GraphSummaryPill
            label="Projecoes"
            value={String(optimizedPlan.pushedProjectionCount)}
            tone="lime"
          />
          <GraphSummaryPill
            label="Juncoes"
            value={String(optimizedPlan.joinOrder.length - 1)}
            tone="lime"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1rem] border border-black/6 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/6">
          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
            Heuristicas aplicadas
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
            {optimizedPlan.appliedHeuristics.map((heuristic) => (
              <div
                key={heuristic}
                className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5"
              >
                {heuristic}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1rem] border border-black/6 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/6">
          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
            Ordem otimizada
          </p>
          <p className="mt-3 rounded-xl border border-black/5 bg-white/70 px-3 py-3 font-mono text-sm leading-6 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
            {optimizedPlan.joinOrder.join(" -> ")}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-black/6 bg-white/80 bg-[radial-gradient(circle_at_1px_1px,rgba(101,163,13,0.11)_1px,transparent_0)] bg-[length:22px_22px] px-6 py-7 dark:border-white/10 dark:bg-[#0f1821] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(190,242,100,0.12)_1px,transparent_0)]">
        <GraphTree
          nodeId={optimizedPlan.graph.rootId}
          nodeById={nodeById}
          graph={optimizedPlan.graph}
        />
      </div>
    </div>
  );
}

function OperatorGraphBlock({ graph }: { graph: OperatorGraph }) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return (
    <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-5 py-5 dark:border-emerald-300/20 dark:bg-emerald-300/8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-emerald-700 uppercase dark:text-emerald-300">
            HU 03
          </p>
          <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Grafo de operadores
          </h3>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Leia o fluxo de baixo para cima: tabelas nas folhas, operadores no
            meio e a projecao final como raiz.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <GraphSummaryPill label="Nos" value={String(graph.nodes.length)} />
          <GraphSummaryPill label="Arestas" value={String(graph.edges.length)} />
          <GraphSummaryPill label="Raiz" value="π" />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-black/6 bg-white/80 bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.09)_1px,transparent_0)] bg-[length:22px_22px] px-6 py-7 dark:border-white/10 dark:bg-[#0f1821] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.12)_1px,transparent_0)]">
        <GraphTree nodeId={graph.rootId} nodeById={nodeById} graph={graph} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1rem] border border-black/6 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/6">
          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
            Como ler
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
            O fluxo sobe das tabelas para os operadores. Cada seta indica um
            resultado intermediario usado pelo proximo operador, ate chegar na
            projecao final.
          </p>
        </div>

        <div className="rounded-[1rem] border border-black/6 bg-white/60 px-4 py-4 dark:border-white/10 dark:bg-white/6">
          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
            Arestas do grafo
          </p>
          <div className="mt-3 grid gap-2 text-xs text-slate-700 dark:text-slate-200">
            {graph.edges.map((edge) => (
              <div
                key={edge.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-black/5 bg-white/70 px-3 py-2 font-mono dark:border-white/10 dark:bg-white/5"
              >
                <span>{formatGraphNodeLabel(nodeById.get(edge.from))}</span>
                <span className="text-emerald-600 dark:text-emerald-300">
                  {"->"}
                </span>
                <span>{formatGraphNodeLabel(nodeById.get(edge.to))}</span>
                <span className="font-sans text-slate-500 dark:text-slate-400">
                  {edge.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphSummaryPill({
  label,
  value,
  tone = "emerald",
}: {
  label: string;
  value: string;
  tone?: "emerald" | "lime" | "fuchsia";
}) {
  const toneClasses =
    tone === "lime"
      ? "border-lime-500/20 bg-white/60 text-lime-800 dark:border-lime-300/20 dark:bg-white/8 dark:text-lime-200"
      : tone === "fuchsia"
        ? "border-fuchsia-500/20 bg-white/60 text-fuchsia-800 dark:border-fuchsia-300/20 dark:bg-white/8 dark:text-fuchsia-200"
      : "border-emerald-500/20 bg-white/60 text-emerald-800 dark:border-emerald-300/20 dark:bg-white/8 dark:text-emerald-200";

  return (
    <div className={`rounded-full border px-3 py-1 text-xs ${toneClasses}`}>
      <span className="font-semibold">{label}:</span>{" "}
      <span className="font-mono">{value}</span>
    </div>
  );
}

function GraphTree({
  nodeId,
  nodeById,
  graph,
}: {
  nodeId: string;
  nodeById: Map<string, OperatorGraphNode>;
  graph: OperatorGraph;
}) {
  const node = nodeById.get(nodeId);
  const childEdges = graph.edges.filter((edge) => edge.to === nodeId);

  if (!node) {
    return null;
  }

  return (
    <div className="flex min-w-max flex-col items-center">
      <GraphNodeCard node={node} />

      {childEdges.length > 0 ? (
        <>
          <div className="flex h-8 flex-col items-center">
            <div className="h-6 w-px bg-gradient-to-b from-emerald-400 to-slate-300 dark:to-slate-600" />
            <div className="size-2 rotate-45 border-r border-b border-slate-300 dark:border-slate-600" />
          </div>
          <div className="relative flex items-start justify-center gap-6 pt-5">
            {childEdges.length > 1 ? (
              <div className="absolute top-0 right-[12%] left-[12%] h-px bg-slate-300 dark:bg-slate-600" />
            ) : null}
            {childEdges.map((edge) => (
              <div key={edge.id} className="flex flex-col items-center">
                <div className="mb-4 h-5 w-px bg-slate-300 dark:bg-slate-600" />
                <GraphTree nodeId={edge.from} nodeById={nodeById} graph={graph} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function GraphNodeCard({ node }: { node: OperatorGraphNode }) {
  const styles = getGraphNodeStyles(node.type);

  return (
    <div
      className={`relative min-w-44 max-w-60 rounded-[1.15rem] border px-4 py-3 text-center shadow-[0_14px_34px_rgba(15,23,42,0.08)] ${styles.container}`}
    >
      <span
        className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.12em] uppercase ${styles.badge}`}
      >
        {getGraphNodeRole(node.type)}
      </span>
      <div
        className={`mx-auto flex size-9 items-center justify-center rounded-full font-mono text-lg font-semibold ${styles.symbol}`}
      >
        {node.symbol}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
        {node.label}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
        {node.detail}
      </p>
    </div>
  );
}

function getGraphNodeStyles(type: OperatorGraphNode["type"]) {
  if (type === "projection") {
    return {
      container:
        "border-cyan-500/25 bg-cyan-50/95 text-cyan-950 dark:border-cyan-300/25 dark:bg-cyan-950/45",
      symbol: "bg-cyan-600 text-white dark:bg-cyan-300 dark:text-cyan-950",
      badge: "bg-cyan-600/10 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-200",
    };
  }

  if (type === "selection") {
    return {
      container:
        "border-amber-500/25 bg-amber-50/95 text-amber-950 dark:border-amber-300/25 dark:bg-amber-950/45",
      symbol: "bg-amber-500 text-white dark:bg-amber-300 dark:text-amber-950",
      badge:
        "bg-amber-500/10 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200",
    };
  }

  if (type === "join") {
    return {
      container:
        "border-sky-500/25 bg-sky-50/95 text-sky-950 dark:border-sky-300/25 dark:bg-sky-950/45",
      symbol: "bg-sky-600 text-white dark:bg-sky-300 dark:text-sky-950",
      badge: "bg-sky-600/10 text-sky-700 dark:bg-sky-300/10 dark:text-sky-200",
    };
  }

  return {
    container:
      "border-slate-300/80 bg-slate-50/95 text-slate-950 dark:border-white/10 dark:bg-white/8",
    symbol: "bg-slate-900 text-white dark:bg-white dark:text-slate-950",
    badge: "bg-slate-900/8 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  };
}

function getGraphNodeRole(type: OperatorGraphNode["type"]) {
  if (type === "projection") {
    return "raiz";
  }

  if (type === "table") {
    return "folha";
  }

  return "operador";
}

function formatGraphNodeLabel(node: OperatorGraphNode | undefined) {
  if (!node) {
    return "no desconhecido";
  }

  return `${node.symbol} ${node.label}`;
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
