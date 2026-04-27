import { QUERY_SCHEMA } from "@/lib/query-schema";
import type { OperatorGraph } from "@/lib/operator-graph";
import type {
  JoinBinding,
  QueryValidationResult,
  TableBinding,
} from "@/lib/sql-validator";

type PredicateInfo = {
  id: string;
  expression: string;
  tableKeys: string[];
  score: number;
};

type JoinCandidate = {
  id: string;
  condition: string;
  newTableKey: string;
  requiredTableKeys: string[];
  score: number;
};

type TableInfo = {
  key: string;
  tableName: string;
  alias: string | null;
  binding: TableBinding;
  order: number;
};

export type OptimizedQueryPlan = {
  graph: OperatorGraph;
  appliedHeuristics: string[];
  joinOrder: string[];
  pushedSelectionCount: number;
  pushedProjectionCount: number;
};

export function buildOptimizedQueryPlan(
  validationResult: QueryValidationResult,
): OptimizedQueryPlan | null {
  const tables = Array.isArray(validationResult.tables)
    ? validationResult.tables
    : [];
  const joins = Array.isArray(validationResult.joins)
    ? validationResult.joins
    : null;
  const selectItems = Array.isArray(validationResult.selectItems)
    ? validationResult.selectItems
    : null;

  if (!validationResult.isValid || tables.length === 0 || !joins || !selectItems) {
    return null;
  }

  const tableInfos = tables.map((table, index) => ({
    key: getTableKey(table),
    tableName: table.tableName,
    alias: table.alias,
    binding: table,
    order: index,
  }));
  const tableInfoByKey = new Map(
    tableInfos.map((tableInfo) => [tableInfo.key, tableInfo]),
  );
  const referenceIndex = buildReferenceIndex(validationResult, tableInfos);
  const { localPredicates, sharedPredicates } = classifyWherePredicates(
    validationResult.whereCondition,
    referenceIndex,
  );
  const projectionPlan = buildProjectionPlan(validationResult, tableInfos);
  const joinCandidates = buildJoinCandidates(joins, referenceIndex, tableInfos);
  const nodes: OperatorGraph["nodes"] = [];
  const edges: OperatorGraph["edges"] = [];
  const branchByTableKey = new Map<string, string>();
  const usedSharedPredicateIds = new Set<string>();
  const joinedTableOrder: string[] = [];
  let pushedSelectionCount = 0;
  let pushedProjectionCount = 0;
  let nodeSequence = 0;

  const localScoreByTable = new Map<string, number>(
    tableInfos.map((tableInfo) => [
      tableInfo.key,
      (localPredicates.get(tableInfo.key) ?? []).reduce(
        (total, predicate) => total + predicate.score,
        0,
      ),
    ]),
  );
  const startTable = chooseStartTable(
    tableInfos,
    localScoreByTable,
    projectionPlan,
  );
  let currentBranchId = ensureTableBranch(startTable.key);
  let currentTableKeys = new Set([startTable.key]);
  joinedTableOrder.push(formatRelation(startTable.binding));
  currentBranchId = applySharedSelections(currentBranchId, currentTableKeys);

  while (currentTableKeys.size < tableInfos.length) {
    const nextJoin = chooseNextJoin(
      joinCandidates,
      currentTableKeys,
      localScoreByTable,
    );

    if (!nextJoin) {
      return null;
    }

    const incomingBranchId = ensureTableBranch(nextJoin.newTableKey);
    const joinNodeId = nextNodeId("optimized-join");

    nodes.push({
      id: joinNodeId,
      type: "join",
      symbol: "⋈",
      label: `JOIN ${joinedTableOrder.length}`,
      detail: nextJoin.condition,
    });
    edges.push({
      id: `${currentBranchId}-${joinNodeId}`,
      from: currentBranchId,
      to: joinNodeId,
      label: "resultado intermediario",
    });
    edges.push({
      id: `${incomingBranchId}-${joinNodeId}`,
      from: incomingBranchId,
      to: joinNodeId,
      label: "entrada otimizada",
    });

    currentBranchId = joinNodeId;
    currentTableKeys.add(nextJoin.newTableKey);
    joinedTableOrder.push(
      formatRelation(tableInfoByKey.get(nextJoin.newTableKey)?.binding),
    );
    currentBranchId = applySharedSelections(currentBranchId, currentTableKeys);
  }

  const projectionNodeId = nextNodeId("optimized-projection-root");

  nodes.push({
    id: projectionNodeId,
    type: "projection",
    symbol: "π",
    label: "Projecao final",
    detail: selectItems.length > 0 ? selectItems.join(", ") : "*",
  });
  edges.push({
    id: `${currentBranchId}-${projectionNodeId}`,
    from: currentBranchId,
    to: projectionNodeId,
    label: "resultado otimizado",
  });

  return {
    graph: {
      rootId: projectionNodeId,
      nodes,
      edges,
    },
    appliedHeuristics: buildHeuristicSummary(
      pushedSelectionCount,
      pushedProjectionCount,
      joins.length,
    ),
    joinOrder: joinedTableOrder,
    pushedSelectionCount,
    pushedProjectionCount,
  };

  function nextNodeId(prefix: string) {
    nodeSequence += 1;
    return `${prefix}-${nodeSequence}`;
  }

  function ensureTableBranch(tableKey: string) {
    const existingBranchId = branchByTableKey.get(tableKey);

    if (existingBranchId) {
      return existingBranchId;
    }

    const tableInfo = tableInfoByKey.get(tableKey);

    if (!tableInfo) {
      return "";
    }

    const tableNodeId = nextNodeId("optimized-table");

    nodes.push({
      id: tableNodeId,
      type: "table",
      symbol: "R",
      label: formatRelation(tableInfo.binding),
      detail: "Tabela base para otimizacao",
    });

    let branchId = tableNodeId;
    const tableSelections = [...(localPredicates.get(tableKey) ?? [])].sort(
      (left, right) => right.score - left.score,
    );

    tableSelections.forEach((predicate) => {
      const selectionNodeId = nextNodeId("optimized-selection");

      nodes.push({
        id: selectionNodeId,
        type: "selection",
        symbol: "σ",
        label: "Selecao antecipada",
        detail: predicate.expression,
      });
      edges.push({
        id: `${branchId}-${selectionNodeId}`,
        from: branchId,
        to: selectionNodeId,
        label: "tuplas reduzidas",
      });

      branchId = selectionNodeId;
      pushedSelectionCount += 1;
    });

    const projectedColumns = projectionPlan.get(tableKey) ?? [];

    if (projectedColumns.length > 0) {
      const projectionNodeId = nextNodeId("optimized-projection");

      nodes.push({
        id: projectionNodeId,
        type: "projection",
        symbol: "π",
        label: "Projecao antecipada",
        detail: projectedColumns.join(", "),
      });
      edges.push({
        id: `${branchId}-${projectionNodeId}`,
        from: branchId,
        to: projectionNodeId,
        label: "atributos reduzidos",
      });

      branchId = projectionNodeId;
      pushedProjectionCount += 1;
    }

    branchByTableKey.set(tableKey, branchId);

    return branchId;
  }

  function applySharedSelections(
    branchId: string,
    currentKeys: Set<string>,
  ) {
    let currentBranch = branchId;
    const availableSelections = sharedPredicates
      .filter(
        (predicate) =>
          !usedSharedPredicateIds.has(predicate.id) &&
          predicate.tableKeys.every((tableKey) => currentKeys.has(tableKey)),
      )
      .sort((left, right) => right.score - left.score);

    availableSelections.forEach((predicate) => {
      usedSharedPredicateIds.add(predicate.id);

      const selectionNodeId = nextNodeId("optimized-selection-shared");

      nodes.push({
        id: selectionNodeId,
        type: "selection",
        symbol: "σ",
        label: "Selecao combinada",
        detail: predicate.expression,
      });
      edges.push({
        id: `${currentBranch}-${selectionNodeId}`,
        from: currentBranch,
        to: selectionNodeId,
        label: "filtro mais restritivo",
      });

      currentBranch = selectionNodeId;
      pushedSelectionCount += 1;
    });

    return currentBranch;
  }
}

function buildHeuristicSummary(
  pushedSelectionCount: number,
  pushedProjectionCount: number,
  joinCount: number,
) {
  return [
    `${pushedSelectionCount} selecao(oes) aproximada(s) das tabelas para reduzir tuplas primeiro.`,
    `${pushedProjectionCount} projecao(oes) antecipada(s) para reduzir atributos logo apos as selecoes.`,
    `${joinCount} juncao(oes) ordenada(s) por restritividade e dependencia logica.`,
    "Nenhum produto cartesiano foi gerado: apenas juncoes conectadas entraram no plano otimizado.",
  ];
}

function chooseStartTable(
  tableInfos: TableInfo[],
  localScoreByTable: Map<string, number>,
  projectionPlan: Map<string, string[]>,
) {
  return [...tableInfos].sort((left, right) => {
    const leftScore =
      (localScoreByTable.get(left.key) ?? 0) +
      (projectionPlan.get(left.key)?.length ? 1 : 0);
    const rightScore =
      (localScoreByTable.get(right.key) ?? 0) +
      (projectionPlan.get(right.key)?.length ? 1 : 0);

    if (leftScore === rightScore) {
      return left.order - right.order;
    }

    return rightScore - leftScore;
  })[0];
}

function chooseNextJoin(
  joinCandidates: JoinCandidate[],
  currentTableKeys: Set<string>,
  localScoreByTable: Map<string, number>,
) {
  return joinCandidates
    .filter(
      (candidate) =>
        !currentTableKeys.has(candidate.newTableKey) &&
        candidate.requiredTableKeys.every((tableKey) =>
          currentTableKeys.has(tableKey),
        ),
    )
    .sort((left, right) => {
      const leftScore =
        left.score + (localScoreByTable.get(left.newTableKey) ?? 0);
      const rightScore =
        right.score + (localScoreByTable.get(right.newTableKey) ?? 0);

      return rightScore - leftScore;
    })[0];
}

function buildProjectionPlan(
  validationResult: QueryValidationResult,
  tableInfos: TableInfo[],
) {
  const blockedTables = new Set<string>();
  const hasGlobalWildcard = validationResult.selectItems.some(
    (item) => item.trim() === "*",
  );
  const projectionPlan = new Map<string, string[]>();

  if (hasGlobalWildcard) {
    return projectionPlan;
  }

  const qualifierToTableKey = new Map<string, string>(
    tableInfos.flatMap((tableInfo) => {
      const pairs: Array<[string, string]> = [[tableInfo.tableName.toLowerCase(), tableInfo.key]];

      if (tableInfo.alias) {
        pairs.push([tableInfo.alias.toLowerCase(), tableInfo.key]);
      }

      return pairs;
    }),
  );

  validationResult.selectItems.forEach((item) => {
    const match = item.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\.\*$/);

    if (!match) {
      return;
    }

    const tableKey = qualifierToTableKey.get(match[1].toLowerCase());

    if (tableKey) {
      blockedTables.add(tableKey);
    }
  });

  tableInfos.forEach((tableInfo) => {
    if (blockedTables.has(tableInfo.key)) {
      return;
    }

    const usedColumns = Array.from(
      new Set(
        validationResult.resolvedColumns
          .filter(
            (column) =>
              column.resolvedTable.toLowerCase() ===
              tableInfo.tableName.toLowerCase(),
          )
          .map((column) => column.resolvedColumn),
      ),
    );
    const availableColumns = QUERY_SCHEMA[
      tableInfo.tableName.toLowerCase() as keyof typeof QUERY_SCHEMA
    ];

    if (
      usedColumns.length > 0 &&
      availableColumns &&
      usedColumns.length < availableColumns.length
    ) {
      projectionPlan.set(tableInfo.key, usedColumns);
    }
  });

  return projectionPlan;
}

function classifyWherePredicates(
  whereCondition: string | null,
  referenceIndex: Map<string, Set<string>>,
) {
  const localPredicates = new Map<string, PredicateInfo[]>();
  const sharedPredicates: PredicateInfo[] = [];

  if (!whereCondition) {
    return { localPredicates, sharedPredicates };
  }

  splitTopLevelAndConditions(whereCondition).forEach((predicate, index) => {
    const tableKeys = Array.from(
      extractReferencedTableKeys(predicate, referenceIndex),
    );
    const predicateInfo: PredicateInfo = {
      id: `where-${index + 1}`,
      expression: predicate,
      tableKeys,
      score: scorePredicate(predicate),
    };

    if (tableKeys.length === 1) {
      const tableKey = tableKeys[0];
      const existingPredicates = localPredicates.get(tableKey) ?? [];

      localPredicates.set(tableKey, [...existingPredicates, predicateInfo]);
      return;
    }

    if (tableKeys.length > 1) {
      sharedPredicates.push(predicateInfo);
    }
  });

  return { localPredicates, sharedPredicates };
}

function buildJoinCandidates(
  joins: JoinBinding[],
  referenceIndex: Map<string, Set<string>>,
  tableInfos: TableInfo[],
) {
  const tableKeySet = new Set(tableInfos.map((tableInfo) => tableInfo.key));
  const candidates: JoinCandidate[] = [];

  joins.forEach((join, index) => {
    const referencedTableKeys = extractReferencedTableKeys(
      join.condition,
      referenceIndex,
    );
    const joinTableKey = getTableKey(join);

    if (!referencedTableKeys.has(joinTableKey)) {
      referencedTableKeys.add(joinTableKey);
    }

    const connectedTableKeys = Array.from(referencedTableKeys).filter((tableKey) =>
      tableKeySet.has(tableKey),
    );

    connectedTableKeys.forEach((newTableKey) => {
      const requiredTableKeys = connectedTableKeys.filter(
        (tableKey) => tableKey !== newTableKey,
      );

      if (requiredTableKeys.length === 0) {
        return;
      }

      candidates.push({
        id: `join-candidate-${index + 1}-${newTableKey}`,
        condition: join.condition,
        newTableKey,
        requiredTableKeys,
        score: scorePredicate(join.condition),
      });
    });
  });

  return candidates;
}

function buildReferenceIndex(
  validationResult: QueryValidationResult,
  tableInfos: TableInfo[],
) {
  const tableKeyByTableName = new Map(
    tableInfos.map((tableInfo) => [tableInfo.tableName.toLowerCase(), tableInfo.key]),
  );
  const referenceIndex = new Map<string, Set<string>>();

  validationResult.resolvedColumns.forEach((column) => {
    const tableKey = tableKeyByTableName.get(column.resolvedTable.toLowerCase());

    if (!tableKey) {
      return;
    }

    const referenceKey = column.reference.toLowerCase();
    const existingSet = referenceIndex.get(referenceKey) ?? new Set<string>();

    existingSet.add(tableKey);
    referenceIndex.set(referenceKey, existingSet);
  });

  return referenceIndex;
}

function extractReferencedTableKeys(
  expression: string,
  referenceIndex: Map<string, Set<string>>,
) {
  const referencedTableKeys = new Set<string>();
  const sanitizedExpression = stripQuotedLiterals(expression);
  const matches =
    sanitizedExpression.match(
      /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/g,
    ) ?? [];

  matches.forEach((match) => {
    const token = match.toLowerCase();

    if (token === "and") {
      return;
    }

    const tableKeys = referenceIndex.get(token);

    if (!tableKeys) {
      return;
    }

    tableKeys.forEach((tableKey) => referencedTableKeys.add(tableKey));
  });

  return referencedTableKeys;
}

function scorePredicate(predicate: string) {
  const literalPattern =
    String.raw`(?:[-+]?\d+(?:\.\d+)?|'(?:''|[^'])*'|"(?:\\.|[^"])*")`;
  const equalityToLiteralRegex = new RegExp(
    `${literalPattern}\\s*=\\s*[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)?|[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)?\\s*=\\s*${literalPattern}`,
    "i",
  );
  const comparisonToLiteralRegex = new RegExp(
    `${literalPattern}\\s*(?:<=|>=|<>|<|>)\\s*[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)?|[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)?\\s*(?:<=|>=|<>|<|>)\\s*${literalPattern}`,
    "i",
  );

  if (equalityToLiteralRegex.test(predicate)) {
    return 5;
  }

  if (comparisonToLiteralRegex.test(predicate)) {
    return 4;
  }

  if (/\bAND\b/i.test(predicate)) {
    return 3;
  }

  return 2;
}

function splitTopLevelAndConditions(expression: string) {
  const conditions: string[] = [];
  let buffer = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < expression.length; index += 1) {
    const currentCharacter = expression[index];
    const nextSlice = expression.slice(index);

    if (quote) {
      buffer += currentCharacter;

      if (currentCharacter === quote) {
        quote = null;
      }

      continue;
    }

    if (currentCharacter === "'" || currentCharacter === '"') {
      quote = currentCharacter;
      buffer += currentCharacter;
      continue;
    }

    if (currentCharacter === "(") {
      depth += 1;
      buffer += currentCharacter;
      continue;
    }

    if (currentCharacter === ")") {
      depth = Math.max(0, depth - 1);
      buffer += currentCharacter;
      continue;
    }

    if (depth === 0 && /^AND\b/i.test(nextSlice)) {
      const normalizedCondition = buffer.trim();

      if (normalizedCondition) {
        conditions.push(normalizedCondition);
      }

      buffer = "";
      index += 2;
      continue;
    }

    buffer += currentCharacter;
  }

  const lastCondition = buffer.trim();

  if (lastCondition) {
    conditions.push(lastCondition);
  }

  return conditions;
}

function stripQuotedLiterals(expression: string) {
  return expression.replace(
    /'(?:''|[^'])*'|"(?:\\.|[^"])*"/g,
    " ",
  );
}

function formatRelation(table: TableBinding | JoinBinding | undefined) {
  if (!table) {
    return "relacao";
  }

  return table.alias ? `${table.tableName} ${table.alias}` : table.tableName;
}

function getTableKey(table: TableBinding | JoinBinding) {
  return (table.alias ?? table.tableName).toLowerCase();
}
