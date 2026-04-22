import type {
  JoinBinding,
  QueryValidationResult,
  TableBinding,
} from "@/lib/sql-validator";

export type OperatorGraphNodeType =
  | "projection"
  | "selection"
  | "join"
  | "table";

export type OperatorGraphNode = {
  id: string;
  type: OperatorGraphNodeType;
  symbol: string;
  label: string;
  detail: string;
};

export type OperatorGraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type OperatorGraph = {
  rootId: string;
  nodes: OperatorGraphNode[];
  edges: OperatorGraphEdge[];
};

export function buildOperatorGraph(
  validationResult: QueryValidationResult,
): OperatorGraph | null {
  const tables = Array.isArray(validationResult.tables)
    ? validationResult.tables
    : [];
  const joins = Array.isArray(validationResult.joins)
    ? validationResult.joins
    : null;
  const selectItems = Array.isArray(validationResult.selectItems)
    ? validationResult.selectItems
    : null;
  const baseTable = tables[0];

  if (!validationResult.isValid || !baseTable || !joins || !selectItems) {
    return null;
  }

  const nodes: OperatorGraphNode[] = [];
  const edges: OperatorGraphEdge[] = [];
  let currentResultId = addTableNode(nodes, baseTable, 0);

  joins.forEach((join, index) => {
    const tableNodeId = addTableNode(nodes, join, index + 1);
    const joinNodeId = `join-${index + 1}`;

    nodes.push({
      id: joinNodeId,
      type: "join",
      symbol: "⋈",
      label: `JOIN ${index + 1}`,
      detail: join.condition,
    });

    edges.push({
      id: `${currentResultId}-${joinNodeId}`,
      from: currentResultId,
      to: joinNodeId,
      label: "resultado intermediario",
    });
    edges.push({
      id: `${tableNodeId}-${joinNodeId}`,
      from: tableNodeId,
      to: joinNodeId,
      label: "tabela de entrada",
    });

    currentResultId = joinNodeId;
  });

  if (validationResult.whereCondition) {
    const selectionNodeId = "selection-1";

    nodes.push({
      id: selectionNodeId,
      type: "selection",
      symbol: "σ",
      label: "Selecao",
      detail: validationResult.whereCondition,
    });
    edges.push({
      id: `${currentResultId}-${selectionNodeId}`,
      from: currentResultId,
      to: selectionNodeId,
      label: "tuplas filtradas",
    });

    currentResultId = selectionNodeId;
  }

  const projectionNodeId = "projection-1";

  nodes.push({
    id: projectionNodeId,
    type: "projection",
    symbol: "π",
    label: "Projecao final",
    detail: selectItems.length > 0 ? selectItems.join(", ") : "*",
  });
  edges.push({
    id: `${currentResultId}-${projectionNodeId}`,
    from: currentResultId,
    to: projectionNodeId,
    label: "resultado final",
  });

  return {
    rootId: projectionNodeId,
    nodes,
    edges,
  };
}

function addTableNode(
  nodes: OperatorGraphNode[],
  table: TableBinding | JoinBinding,
  index: number,
) {
  const nodeId = `table-${index}`;

  nodes.push({
    id: nodeId,
    type: "table",
    symbol: "R",
    label: formatRelation(table),
    detail: index === 0 ? "Tabela base" : "Tabela usada no JOIN",
  });

  return nodeId;
}

function formatRelation(table: TableBinding | JoinBinding) {
  return table.alias ? `${table.tableName} ${table.alias}` : table.tableName;
}
