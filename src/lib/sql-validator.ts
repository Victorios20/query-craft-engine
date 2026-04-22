import { QUERY_SCHEMA } from "@/lib/query-schema";

type ClauseName = "SELECT" | "FROM" | "JOIN" | "ON" | "WHERE";

type TokenType =
  | "identifier"
  | "string"
  | "number"
  | "operator"
  | "and"
  | "lparen"
  | "rparen";

type ConditionToken = {
  type: TokenType;
  value: string;
};

export type TableBinding = {
  tableName: string;
  alias: string | null;
  source: "base" | "join";
};

export type JoinBinding = TableBinding & {
  source: "join";
  condition: string;
};

type ParsedTableSpec =
  | {
      issue: ValidationIssue;
    }
  | {
      tableName: string;
      alias: string | null;
    };

type QueryClauses = {
  selectClause: string;
  fromClause: string;
  whereClause: string | null;
};

type ParsedFromClause = {
  tables: TableBinding[];
  joins: JoinBinding[];
};

export type ValidationIssue = {
  clause: ClauseName;
  message: string;
};

export type ResolvedColumn = {
  clause: "SELECT" | "ON" | "WHERE";
  reference: string;
  resolvedTable: string;
  resolvedColumn: string;
};

export type QueryValidationResult = {
  isValid: boolean;
  normalizedQuery: string;
  issues: ValidationIssue[];
  tables: TableBinding[];
  joins: JoinBinding[];
  resolvedColumns: ResolvedColumn[];
  selectItems: string[];
  whereCondition: string | null;
  joinCount: number;
  hasWhere: boolean;
};

// Regex sources used only to recognize the limited SQL dialect of HU01.
const IDENTIFIER_SOURCE = "[A-Za-z_][A-Za-z0-9_]*";
const STRING_LITERAL_SOURCE = String.raw`'(?:''|[^'])*'|"(?:\\.|[^"])*"`;
const NUMBER_LITERAL_SOURCE = String.raw`[-+]?\d+(?:\.\d+)?`;
const TABLE_SPEC_SOURCE = `${IDENTIFIER_SOURCE}(?:\\s+(?:AS\\s+)?${IDENTIFIER_SOURCE})?`;
const COLUMN_REFERENCE_SOURCE = `${IDENTIFIER_SOURCE}(?:\\.${IDENTIFIER_SOURCE})?`;
const COMPARISON_OPERATOR_SOURCE = String.raw`<=|>=|<>|=|<|>`;
const LOGICAL_AND_SOURCE = String.raw`AND\b`;
const SUPPORTED_OPERATOR_SOURCE = `${COMPARISON_OPERATOR_SOURCE}|${LOGICAL_AND_SOURCE}|\\(|\\)`;
const CONDITION_TOKEN_SOURCE = `${SUPPORTED_OPERATOR_SOURCE}|${STRING_LITERAL_SOURCE}|${NUMBER_LITERAL_SOURCE}|${COLUMN_REFERENCE_SOURCE}`;

// Regex instances used in each stage of recognition.
const QUERY_SEGMENT_REGEX = new RegExp(
  `${STRING_LITERAL_SOURCE}|[^'"\\n\\r]+|[\\n\\r]+`,
  "g",
);
const STARTS_WITH_SELECT_REGEX = /^SELECT\b/i;
const HAS_FROM_REGEX = /\bFROM\b/i;
const TRAILING_SEMICOLON_REGEX = /;\s*$/;
const EXTRA_SEMICOLON_REGEX = /;/;
const QUERY_STRUCTURE_REGEX = /^SELECT\s+([\s\S]+?)\s+FROM\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]+))?$/i;
const FIRST_JOIN_REGEX = /\s+JOIN\s+/i;
const TABLE_SPEC_REGEX = new RegExp(
  `^(${IDENTIFIER_SOURCE})(?:\\s+(?:AS\\s+)?(${IDENTIFIER_SOURCE}))?$`,
  "i",
);
const JOIN_SEGMENT_REGEX = new RegExp(
  `^JOIN\\s+(${TABLE_SPEC_SOURCE})\\s+ON\\s+([\\s\\S]+?)(?=(?:\\s+JOIN\\s+${IDENTIFIER_SOURCE})|$)`,
  "i",
);
const COLUMN_REFERENCE_REGEX = new RegExp(`^${COLUMN_REFERENCE_SOURCE}$`);
const QUALIFIED_STAR_REGEX = new RegExp(`^${IDENTIFIER_SOURCE}\\.\\*$`);
const IDENTIFIER_REGEX = new RegExp(`^${IDENTIFIER_SOURCE}$`);
const COMPARISON_OPERATOR_REGEX = new RegExp(
  `^(?:${COMPARISON_OPERATOR_SOURCE})$`,
);
const LOGICAL_AND_REGEX = /^AND$/i;
const CONDITION_TOKEN_REGEX = new RegExp(
  `\\s*(${CONDITION_TOKEN_SOURCE})`,
  "iy",
);

const schemaIndex = Object.fromEntries(
  Object.entries(QUERY_SCHEMA).map(([tableName, columns]) => [
    tableName.toLowerCase(),
    {
      tableName,
      columnsByKey: new Map(
        columns.map((columnName) => [columnName.toLowerCase(), columnName]),
      ),
    },
  ]),
);

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function isQuotedLiteral(segment: string) {
  return /^'/.test(segment) || /^"/.test(segment);
}

function normalizeSqlTextSegment(segment: string) {
  return segment
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

function normalizeQueryWhitespace(query: string) {
  const segments = query.match(QUERY_SEGMENT_REGEX) ?? [];

  return segments
    .reduce((normalizedQuery, segment) => {
      if (isQuotedLiteral(segment)) {
        return normalizedQuery + segment;
      }

      const normalizedSegment = normalizeSqlTextSegment(segment);

      if (normalizedQuery.endsWith(" ") && normalizedSegment.startsWith(" ")) {
        return normalizedQuery + normalizedSegment.trimStart();
      }

      return normalizedQuery + normalizedSegment;
    }, "")
    .trim();
}

function extractQueryClauses(
  normalizedQuery: string,
  issues: ValidationIssue[],
): QueryClauses | null {
  if (!normalizedQuery) {
    issues.push({
      clause: "SELECT",
      message: "Digite uma consulta SQL para iniciar a validacao.",
    });
    return null;
  }

  const sanitizedQuery = normalizedQuery.replace(TRAILING_SEMICOLON_REGEX, "").trim();

  if (EXTRA_SEMICOLON_REGEX.test(sanitizedQuery)) {
    issues.push({
      clause: "SELECT",
      message: "Use apenas uma consulta por vez.",
    });
  }

  if (!STARTS_WITH_SELECT_REGEX.test(sanitizedQuery)) {
    issues.push({
      clause: "SELECT",
      message: "A consulta precisa comecar com SELECT.",
    });
  }

  if (!HAS_FROM_REGEX.test(sanitizedQuery)) {
    issues.push({
      clause: "FROM",
      message: "A consulta precisa conter a clausula FROM.",
    });
  }

  if (issues.length > 0) {
    return null;
  }

  const match = sanitizedQuery.match(QUERY_STRUCTURE_REGEX);

  if (!match) {
    issues.push({
      clause: "SELECT",
      message: "A estrutura basica da consulta deve seguir SELECT ... FROM ... [WHERE ...].",
    });
    return null;
  }

  const selectClause = match[1]?.trim() ?? "";
  const fromClause = match[2]?.trim() ?? "";
  const whereClause = match[3]?.trim() || null;

  if (!selectClause) {
    issues.push({
      clause: "SELECT",
      message: "A clausula SELECT nao pode ficar vazia.",
    });
  }

  if (!fromClause) {
    issues.push({
      clause: "FROM",
      message: "A clausula FROM nao pode ficar vazia.",
    });
  }

  if (whereClause !== null && !whereClause) {
    issues.push({
      clause: "WHERE",
      message: "A clausula WHERE nao pode ficar vazia.",
    });
  }

  if (issues.length > 0) {
    return null;
  }

  return {
    selectClause,
    fromClause,
    whereClause,
  };
}

function splitSelectClause(selectClause: string) {
  return selectClause
    .split(/\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTableSpec(
  rawTableSpec: string,
  clause: "FROM" | "JOIN",
): ParsedTableSpec {
  const match = rawTableSpec.trim().match(TABLE_SPEC_REGEX);

  if (!match) {
    return {
      issue: {
        clause,
        message: `Tabela invalida em ${clause}: "${rawTableSpec.trim()}".`,
      },
    };
  }

  return {
    tableName: match[1].toLowerCase(),
    alias: match[2] ? match[2].toLowerCase() : null,
  };
}

function tokenizeCondition(
  input: string,
  clause: "ON" | "WHERE",
  issues: ValidationIssue[],
) {
  const tokens: ConditionToken[] = [];
  let cursor = 0;

  CONDITION_TOKEN_REGEX.lastIndex = 0;

  while (cursor < input.length) {
    CONDITION_TOKEN_REGEX.lastIndex = cursor;
    const match = CONDITION_TOKEN_REGEX.exec(input);

    if (!match?.[1]) {
      const excerpt = input.slice(cursor).trim().split(/\s+/)[0] ?? input.slice(cursor);
      issues.push({
        clause,
        message: `Token invalido em ${clause}: "${excerpt}".`,
      });
      return [];
    }

    const rawToken = match[1];
    let type: TokenType;

    if (rawToken === "(") {
      type = "lparen";
    } else if (rawToken === ")") {
      type = "rparen";
    } else if (COMPARISON_OPERATOR_REGEX.test(rawToken)) {
      type = "operator";
    } else if (LOGICAL_AND_REGEX.test(rawToken)) {
      type = "and";
    } else if (rawToken.startsWith("'") || rawToken.startsWith('"')) {
      type = "string";
    } else if (/^[-+]?\d+(?:\.\d+)?$/.test(rawToken)) {
      type = "number";
    } else {
      type = "identifier";
    }

    tokens.push({ type, value: rawToken });
    cursor = match.index + match[0].length;
  }

  return tokens;
}

function parseConditionTokens(
  tokens: ConditionToken[],
  clause: "ON" | "WHERE",
  issues: ValidationIssue[],
) {
  let cursor = 0;
  const identifiers: string[] = [];

  const current = () => tokens[cursor];

  const parseValue = () => {
    const token = current();

    if (!token) {
      issues.push({
        clause,
        message: `Expressao incompleta em ${clause}.`,
      });
      return false;
    }

    if (token.type === "identifier") {
      identifiers.push(token.value);
      cursor += 1;
      return true;
    }

    if (token.type === "string" || token.type === "number") {
      cursor += 1;
      return true;
    }

    issues.push({
      clause,
      message: `Valor invalido em ${clause}: "${token.value}".`,
    });
    return false;
  };

  const parseComparison = () => {
    if (!parseValue()) {
      return false;
    }

    const operatorToken = current();

    if (!operatorToken || operatorToken.type !== "operator") {
      issues.push({
        clause,
        message: `Operador invalido em ${clause}. Use apenas =, >, <, <=, >= ou <>.`,
      });
      return false;
    }

    cursor += 1;
    return parseValue();
  };

  const parseTerm = (): boolean => {
    const token = current();

    if (!token) {
      issues.push({
        clause,
        message: `Expressao incompleta em ${clause}.`,
      });
      return false;
    }

    if (token.type === "lparen") {
      cursor += 1;

      if (!parseExpression()) {
        return false;
      }

      const closingToken = current();

      if (!closingToken || closingToken.type !== "rparen") {
        issues.push({
          clause,
          message: `Parenteses nao fechados em ${clause}.`,
        });
        return false;
      }

      cursor += 1;
      return true;
    }

    return parseComparison();
  };

  const parseExpression = (): boolean => {
    if (!parseTerm()) {
      return false;
    }

    while (current()?.type === "and") {
      cursor += 1;

      if (!parseTerm()) {
        return false;
      }
    }

    return true;
  };

  if (tokens.length === 0) {
    issues.push({
      clause,
      message: `Clausula ${clause} vazia.`,
    });
    return [];
  }

  if (!parseExpression()) {
    return [];
  }

  if (cursor < tokens.length) {
    issues.push({
      clause,
      message: `Sobrou texto nao reconhecido em ${clause}: "${tokens[cursor]?.value}".`,
    });
    return [];
  }

  return identifiers;
}

function resolveColumnReference(
  reference: string,
  clause: "SELECT" | "ON" | "WHERE",
  tables: TableBinding[],
  issues: ValidationIssue[],
): ResolvedColumn[] {
  const rawReference = reference.trim();
  const normalizedReference = normalizeIdentifier(rawReference);

  if (rawReference === "*") {
    return [];
  }

  if (QUALIFIED_STAR_REGEX.test(rawReference)) {
    const qualifier = normalizeIdentifier(rawReference.split(".")[0] ?? "");
    const table = tables.find(
      (binding) =>
        binding.alias === qualifier || normalizeIdentifier(binding.tableName) === qualifier,
    );

    if (!table) {
      issues.push({
        clause,
        message: `Tabela ou alias desconhecido em ${clause}: "${qualifier}".`,
      });
    }

    return [];
  }

  if (!COLUMN_REFERENCE_REGEX.test(rawReference)) {
    issues.push({
      clause,
      message: `Campo invalido em ${clause}: "${rawReference}".`,
    });
    return [];
  }

  if (normalizedReference.includes(".")) {
    const [qualifier, columnKey] = normalizedReference.split(".");
    const table = tables.find(
      (binding) =>
        binding.alias === qualifier || normalizeIdentifier(binding.tableName) === qualifier,
    );

    if (!table) {
      issues.push({
        clause,
        message: `Tabela ou alias desconhecido em ${clause}: "${qualifier}".`,
      });
      return [];
    }

    const schemaTable = schemaIndex[normalizeIdentifier(table.tableName)];
    const resolvedColumn = schemaTable?.columnsByKey.get(columnKey);

    if (!resolvedColumn) {
      issues.push({
        clause,
        message: `Campo "${columnKey}" nao existe em "${table.tableName}".`,
      });
      return [];
    }

    return [
      {
        clause,
        reference: rawReference,
        resolvedTable: table.tableName,
        resolvedColumn,
      },
    ];
  }

  const matches: ResolvedColumn[] = [];

  for (const table of tables) {
    const schemaTable = schemaIndex[normalizeIdentifier(table.tableName)];
    const resolvedColumn = schemaTable?.columnsByKey.get(normalizedReference);

    if (!resolvedColumn) {
      continue;
    }

    matches.push({
      clause,
      reference: rawReference,
      resolvedTable: table.tableName,
      resolvedColumn,
    });
  }

  if (matches.length === 0) {
    issues.push({
      clause,
      message: `Campo "${rawReference}" nao existe nas tabelas usadas na consulta.`,
    });
    return [];
  }

  if (matches.length > 1) {
    issues.push({
      clause,
      message: `Campo ambiguo em ${clause}: "${rawReference}". Use tabela.campo ou alias.campo.`,
    });
    return [];
  }

  return matches;
}

function parseSelectColumns(
  selectItems: string[],
  tables: TableBinding[],
  issues: ValidationIssue[],
): ResolvedColumn[] {
  if (selectItems.length === 0) {
    issues.push({
      clause: "SELECT",
      message: "A clausula SELECT precisa de pelo menos um campo.",
    });
    return [];
  }

  return selectItems.flatMap((item) =>
    resolveColumnReference(item, "SELECT", tables, issues),
  );
}

function parseConditions(
  rawCondition: string,
  clause: "ON" | "WHERE",
  tables: TableBinding[],
  issues: ValidationIssue[],
): ResolvedColumn[] {
  const tokens = tokenizeCondition(rawCondition, clause, issues);

  if (tokens.length === 0) {
    return [];
  }

  const identifiers = parseConditionTokens(tokens, clause, issues);

  return identifiers.flatMap((identifier) =>
    resolveColumnReference(identifier, clause, tables, issues),
  );
}

function validateTablesAndAliases(
  tables: TableBinding[],
  issues: ValidationIssue[],
) {
  const usedNames = new Map<string, string>();

  for (const table of tables) {
    const schemaTable = schemaIndex[normalizeIdentifier(table.tableName)];

    if (!schemaTable) {
      issues.push({
        clause: table.source === "base" ? "FROM" : "JOIN",
        message: `Tabela "${table.tableName}" nao existe no modelo.`,
      });
    }

    const tableKey = normalizeIdentifier(table.tableName);

    if (usedNames.has(tableKey)) {
      issues.push({
        clause: table.source === "base" ? "FROM" : "JOIN",
        message: `Tabela repetida na consulta: "${table.tableName}". Use alias para diferenciar se isso for intencional.`,
      });
    } else {
      usedNames.set(tableKey, table.tableName);
    }

    if (!table.alias) {
      continue;
    }

    if (!IDENTIFIER_REGEX.test(table.alias)) {
      issues.push({
        clause: table.source === "base" ? "FROM" : "JOIN",
        message: `Alias invalido: "${table.alias}".`,
      });
      continue;
    }

    if (usedNames.has(table.alias)) {
      issues.push({
        clause: table.source === "base" ? "FROM" : "JOIN",
        message: `Alias repetido na consulta: "${table.alias}".`,
      });
      continue;
    }

    usedNames.set(table.alias, table.tableName);
  }
}

function parseFromClause(
  fromClause: string,
  issues: ValidationIssue[],
  resolvedColumns: ResolvedColumn[],
): ParsedFromClause {
  const tables: TableBinding[] = [];
  const joins: JoinBinding[] = [];
  const firstJoinMatch = fromClause.match(FIRST_JOIN_REGEX);
  const baseTableText = (
    firstJoinMatch
      ? fromClause.slice(0, firstJoinMatch.index)
      : fromClause
  ).trim();
  const parsedBaseTable = parseTableSpec(baseTableText, "FROM");

  if ("issue" in parsedBaseTable) {
    issues.push(parsedBaseTable.issue);
    return { tables, joins };
  }

  tables.push({
    tableName: parsedBaseTable.tableName,
    alias: parsedBaseTable.alias,
    source: "base",
  });

  let remainingJoinClause = firstJoinMatch
    ? fromClause.slice(firstJoinMatch.index).trim()
    : "";

  while (remainingJoinClause) {
    const joinMatch = remainingJoinClause.match(JOIN_SEGMENT_REGEX);

    if (!joinMatch) {
      if (!/\bON\b/i.test(remainingJoinClause)) {
        issues.push({
          clause: "JOIN",
          message: `JOIN sem ON: "${remainingJoinClause}".`,
        });
      } else {
        issues.push({
          clause: "JOIN",
          message: `Trecho JOIN invalido: "${remainingJoinClause}".`,
        });
      }

      break;
    }

    const parsedJoinTable = parseTableSpec(joinMatch[1], "JOIN");

    const joinCondition = joinMatch[2].trim();

    if ("issue" in parsedJoinTable) {
      issues.push(parsedJoinTable.issue);
    } else {
      const joinBinding: JoinBinding = {
        tableName: parsedJoinTable.tableName,
        alias: parsedJoinTable.alias,
        source: "join",
        condition: joinCondition,
      };

      tables.push(joinBinding);
      joins.push(joinBinding);
    }

    if (!joinCondition) {
      issues.push({
        clause: "ON",
        message: `A clausula ON nao pode ficar vazia no JOIN "${joinMatch[1]}".`,
      });
    } else {
      resolvedColumns.push(...parseConditions(joinCondition, "ON", tables, issues));
    }

    remainingJoinClause = remainingJoinClause.slice(joinMatch[0].length).trim();
  }

  return { tables, joins };
}

export function validateSqlQuery(query: string): QueryValidationResult {
  const issues: ValidationIssue[] = [];
  const normalizedQuery = normalizeQueryWhitespace(query);
  const resolvedColumns: ResolvedColumn[] = [];
  const clauses = extractQueryClauses(normalizedQuery, issues);

  if (!clauses) {
    return {
      isValid: false,
      normalizedQuery,
      issues,
      tables: [],
      joins: [],
      resolvedColumns,
      selectItems: [],
      whereCondition: null,
      joinCount: 0,
      hasWhere: false,
    };
  }

  const selectItems = splitSelectClause(clauses.selectClause);
  const { tables, joins } = parseFromClause(
    clauses.fromClause,
    issues,
    resolvedColumns,
  );

  validateTablesAndAliases(tables, issues);
  resolvedColumns.push(
    ...parseSelectColumns(selectItems, tables, issues),
  );

  if (clauses.whereClause) {
    resolvedColumns.push(
      ...parseConditions(clauses.whereClause, "WHERE", tables, issues),
    );
  }

  return {
    isValid: issues.length === 0,
    normalizedQuery,
    issues,
    tables,
    joins,
    resolvedColumns,
    selectItems,
    whereCondition: clauses.whereClause,
    joinCount: Math.max(0, tables.length - 1),
    hasWhere: Boolean(clauses.whereClause),
  };
}
