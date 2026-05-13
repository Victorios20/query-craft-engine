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

export function buildRelationalAlgebra( // recebe validationResult: QueryValidationResult 
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

  const projection = formatProjection(selectItems);// monta a projeção


  const selection = validationResult.whereCondition
    ? `σ_{${validationResult.whereCondition}}`
    : null;
  const joinExpressions = joins.map(formatJoin); //isso gera a lista de cada JOIN convertido para ⋈
  const relationalSource = buildRelationalSource(tables[0], joins); // Monta a fonte relacional principal 
  const selectedSource = selection // Decide se a fonte vai ter seleção
    ? `${selection} (${relationalSource})`
    : relationalSource;

  return {
    // Expressao completa da algebra relacional gerada para a consulta
    expression: `${projection} (${selectedSource})`,
    // Parte da projecao (π), correspondente aos campos do SELECT
    projection,
    // Parte da selecao (σ), correspondente a condicao do WHERE, se existir
    selection,
    // Lista das juncoes (⋈) reconhecidas na consulta
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
