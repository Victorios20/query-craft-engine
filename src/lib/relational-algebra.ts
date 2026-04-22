import type {
  JoinBinding,
  QueryValidationResult,
  TableBinding,
} from "@/lib/sql-validator";

export type RelationalAlgebraResult = {
  expression: string;
  projection: string;
  selection: string | null;
  joins: string[];
};

export function buildRelationalAlgebra(
  validationResult: QueryValidationResult,
): RelationalAlgebraResult | null {
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

  const projection = formatProjection(selectItems);
  const selection = validationResult.whereCondition
    ? `σ_{${validationResult.whereCondition}}`
    : null;
  const joinExpressions = joins.map(formatJoin);
  const relationalSource = buildRelationalSource(tables[0], joins);
  const selectedSource = selection
    ? `${selection} (${relationalSource})`
    : relationalSource;

  return {
    expression: `${projection} (${selectedSource})`,
    projection,
    selection,
    joins: joinExpressions,
  };
}

function buildRelationalSource(
  baseTable: TableBinding,
  joins: JoinBinding[],
) {
  return joins.reduce(
    (currentExpression, join) =>
      `(${currentExpression} ⋈_{${join.condition}} ${formatRelation(join)})`,
    formatRelation(baseTable),
  );
}

function formatProjection(selectItems: string[]) {
  const projectionItems = selectItems.length > 0 ? selectItems.join(", ") : "*";

  return `π_{${projectionItems}}`;
}

function formatJoin(join: JoinBinding) {
  return `⋈_{${join.condition}} ${formatRelation(join)}`;
}

function formatRelation(table: TableBinding) {
  return table.alias ? `${table.tableName} ${table.alias}` : table.tableName;
}
