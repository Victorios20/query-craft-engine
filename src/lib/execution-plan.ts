import type { OperatorGraph, OperatorGraphNode } from "@/lib/operator-graph";
import type { OptimizedQueryPlan } from "@/lib/query-optimizer";

export type ExecutionPlanStep = {
  order: number;
  nodeId: string;
  nodeType: OperatorGraphNode["type"];
  symbol: string;
  title: string;
  detail: string;
  inputs: string[];
};

export type ExecutionPlan = {
  rootNodeId: string;
  steps: ExecutionPlanStep[];
};

export function buildExecutionPlan(
  optimizedPlan: OptimizedQueryPlan,
): ExecutionPlan | null {
  const graph = optimizedPlan.graph;

  if (!graph.rootId || graph.nodes.length === 0) {
    return null;
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const dependencyEdgesByNodeId = new Map<string, OperatorGraph["edges"]>();
  const orderedNodeIds: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  if (!nodeById.has(graph.rootId)) {
    return null;
  }

  graph.edges.forEach((edge) => {
    const existingEdges = dependencyEdgesByNodeId.get(edge.to) ?? [];

    dependencyEdgesByNodeId.set(edge.to, [...existingEdges, edge]);
  });

  const canBuild = visit(graph.rootId);

  if (!canBuild) {
    return null;
  }

  return {
    rootNodeId: graph.rootId,
    steps: orderedNodeIds.map((nodeId, index) => {
      const node = nodeById.get(nodeId);

      if (!node) {
        return {
          order: index + 1,
          nodeId,
          nodeType: "table",
          symbol: "?",
          title: "Operacao desconhecida",
          detail: "No nao encontrado no grafo otimizado.",
          inputs: [],
        };
      }

      return {
        order: index + 1,
        nodeId,
        nodeType: node.type,
        symbol: node.symbol,
        title: formatStepTitle(node),
        detail: node.detail,
        inputs: (dependencyEdgesByNodeId.get(nodeId) ?? [])
          .map((edge) => nodeById.get(edge.from))
          .filter((dependencyNode): dependencyNode is OperatorGraphNode =>
            Boolean(dependencyNode),
          )
          .map((dependencyNode) => formatNodeLabel(dependencyNode)),
      };
    }),
  };

  function visit(nodeId: string) {
    if (visited.has(nodeId)) {
      return true;
    }

    if (visiting.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    const dependencyEdges = dependencyEdgesByNodeId.get(nodeId) ?? [];

    for (const dependencyEdge of dependencyEdges) {
      const canVisitDependency = visit(dependencyEdge.from);

      if (!canVisitDependency) {
        return false;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    orderedNodeIds.push(nodeId);

    return true;
  }
}

function formatStepTitle(node: OperatorGraphNode) {
  if (node.type === "table") {
    return `Ler tabela ${node.label}`;
  }

  if (node.type === "selection") {
    return `Aplicar ${node.label}`;
  }

  return `Executar ${node.label}`;
}

function formatNodeLabel(node: OperatorGraphNode) {
  return `${node.symbol} ${node.label}`;
}
