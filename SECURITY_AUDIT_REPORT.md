# Security Audit Report: Grafana Datasource Plugins

**Date:** 2026-08-12  
**Scope:** SQL injection, query injection, and unsafe query construction in datasource plugins  
**Excluded (already known):**
- InfluxQL injection in `pkg/tsdb/influxdb/models/query.go`
- KQL injection in `pkg/tsdb/azuremonitor/loganalytics/traces.go`
- LogQL injection in `pkg/tsdb/loki/sql.go`
- CloudWatch injection in `pkg/tsdb/cloudwatch/log_actions.go`

---

## Finding 1: MySQL `restrictedRegExp` Bypass via Block Comment Injection (TOCTOU)

**Severity:** HIGH  
**Type:** Security control bypass / Information disclosure  
**CWE:** CWE-367 (Time-of-check Time-of-use Race Condition)

### Location

- **File:** `pkg/tsdb/mysql/macros.go`
- **Lines:** 116–124

### Description

The MySQL datasource restricts certain dangerous functions (`current_user`, `session_user()`, `system_user()`, `user()`, `SHOW GRANTS`) via a regular expression check. However, there is a **time-of-check-time-of-use (TOCTOU) vulnerability**: the regex runs against the **original SQL** (line 116), but SQL block comments are stripped **after** the check (line 124). The comment-stripped SQL is what ultimately gets executed by MySQL.

An attacker can split any restricted keyword with a `/**/` block comment to evade the regex, and the comment-stripped version (which is the SQL that reaches MySQL) will contain the intact restricted function.

### Data Flow

```
1. User sends query via POST /api/ds/query with rawSql field
2. Backend extracts rawSql from query JSON (mysql/sqleng/sql_engine.go:165)
3. Global interpolation (mysql/sqleng/sql_engine.go:244)
4. MySQL macro engine Interpolate() called (mysql/sqleng/sql_engine.go:247)
   → Line 116: restrictedRegExp.FindAllStringSubmatch(sql, 1) — CHECK on original SQL
   → Line 124: sql = stripSQLComments(sql) — STRIP comments AFTER check
   → Lines 130-141: macro substitution on stripped SQL
5. Result sent to MySQL: e.db.QueryContext(queryContext, interpolatedQuery) (mysql/sqleng/sql_engine.go:253)
```

### Proof of Concept

| Input (rawSql) | Regex Match? | After stripSQLComments | MySQL Executes |
|---|---|---|---|
| `SELECT cu/**/rrent_user` | No match | `SELECT current_user` | Returns current user |
| `SELECT sessio/**/n_user()` | No match | `SELECT session_user()` | Returns session user |
| `SELECT us/**/er()` | No match | `SELECT user()` | Returns user |
| `SELECT syste/**/m_user()` | No match | `SELECT system_user()` | Returns system user |
| `SHO/**/W GRANTS` | No match | `SHOW GRANTS` | Shows grants |

### Impact

Any Grafana user with MySQL datasource query access (including dashboard viewers executing pre-defined queries that allow variable substitution in raw SQL mode) can extract MySQL credential/privilege information that the `restrictedRegExp` was specifically designed to prevent.

### Recommended Fix

Move the `restrictedRegExp` check to **after** `stripSQLComments`:

```go
func (m *mySQLMacroEngine) Interpolate(query *backend.DataQuery, timeRange backend.TimeRange, sql string) (string, error) {
    // Strip SQL comments FIRST
    sql = stripSQLComments(sql)

    // THEN check restricted patterns on the executable SQL
    matches := restrictedRegExp.FindAllStringSubmatch(sql, 1)
    if len(matches) > 0 {
        m.logger.Error("Show grants, session_user(), current_user(), system_user() or user() not allowed in query")
        return "", fmt.Errorf("invalid query - %s", m.userError)
    }
    // ... rest of macro processing
}
```

---

## Finding 2: MySQL `restrictedRegExp` Bypass via Parenthesis Context

**Severity:** MEDIUM  
**Type:** Security control bypass / Information disclosure  
**CWE:** CWE-185 (Incorrect Regular Expression)

### Location

- **File:** `pkg/tsdb/mysql/macros.go`
- **Line:** 17

### Description

The `restrictedRegExp` pattern requires `[\s,]` (whitespace or comma) immediately before the restricted function names. This means functions preceded by `(` are not caught by the regex, because `(` is neither whitespace nor comma.

### Regex Pattern

```go
var restrictedRegExp = regexp.MustCompile(`(?im)([\s]*show[\s]+grants|[\s,]session_user\([^\)]*\)|[\s,]current_user(\([^\)]*\))?|[\s,]system_user\([^\)]*\)|[\s,]user\([^\)]*\))([\s,;]|$)`)
```

### Proof of Concept

| Input (rawSql) | Bypasses Regex? | MySQL Result |
|---|---|---|
| `SELECT(current_user)` | Yes — `(` is not `[\s,]` | Returns current user |
| `SELECT(user())` | Yes | Returns user |
| `SELECT(session_user())` | Yes | Returns session user |
| `SELECT(system_user())` | Yes | Returns system user |
| `SELECT CONCAT((current_user),'x')` | Yes — inner `(` before `current_user` | Returns current user concatenated |

All of these are valid MySQL syntax. `SELECT(expr)` is equivalent to `SELECT (expr)`.

### Impact

Same as Finding 1 — information disclosure of MySQL user/privilege data.

### Recommended Fix

Modify the regex to also account for `(` as a valid preceding character, or use word-boundary assertions:

```go
var restrictedRegExp = regexp.MustCompile(`(?im)([\s]*show[\s]+grants|[\s,(]session_user\([^\)]*\)|[\s,(]current_user(\([^\)]*\))?|[\s,(]system_user\([^\)]*\)|[\s,(]user\([^\)]*\))([\s,;)]|$)`)
```

Or preferably, use a deny-list approach on the AST after parsing rather than regex-based filtering.

---

## Finding 3: MSSQL Frontend Meta Query — Unescaped Parameters

**Severity:** LOW  
**Type:** SQL injection in metadata queries  
**CWE:** CWE-89 (SQL Injection)

### Location

- **File:** `public/app/plugins/datasource/mssql/MSSqlMetaQuery.ts`
- **Lines:** 6–16

### Description

The MSSQL metadata query functions use direct string interpolation without sanitization:

```typescript
export function getSchemaAndName(database?: string) {
  return `SELECT TABLE_SCHEMA + '.' + TABLE_NAME as schemaAndName
    FROM [${database}].INFORMATION_SCHEMA.TABLES`;
}

export function getSchema(database?: string, table?: string) {
  return `
   USE [${database}]
   SELECT COLUMN_NAME as 'column',DATA_TYPE as 'type'
   FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}';`;
}
```

- `database` inside `[...]` can be escaped with `]` (e.g., `db]; DROP TABLE x; --`)
- `table` in `TABLE_NAME='${table}'` has zero escaping (single-quote breakout trivial)

### Data Flow

```
1. Frontend query builder UI calls fetchTables(dataset) or fetchFields(query)
   (public/app/plugins/datasource/mssql/datasource.ts:38,47)
2. getSchemaAndName/getSchema constructs SQL with unsanitized params
3. this.runSql() sends the constructed SQL to POST /api/ds/query as rawSql
4. Backend executes via db.QueryContext()
```

### Impact

**Mitigated** — This path requires datasource editor permissions, and editors can already execute arbitrary SQL via the raw SQL editor. No privilege escalation occurs. However, this represents poor defense-in-depth practice and could become exploitable if access controls are tightened in the future.

### Comparison with PostgreSQL (safe)

PostgreSQL properly escapes:
```typescript
// pkg/grafana-postgresql-datasource/postgresMetaQuery.ts
export function getSchema(table: string) {
  const tableNamePart = "'" + table.replace(/'/g, "''") + "'";
  // ...
}
```

### Recommended Fix

Apply the same escaping pattern as PostgreSQL — escape `]` in database names and `'` in table names:

```typescript
export function getSchemaAndName(database?: string) {
  const escapedDb = database?.replace(/]/g, ']]') ?? '';
  return `SELECT TABLE_SCHEMA + '.' + TABLE_NAME as schemaAndName
    FROM [${escapedDb}].INFORMATION_SCHEMA.TABLES`;
}

export function getSchema(database?: string, table?: string) {
  const escapedDb = database?.replace(/]/g, ']]') ?? '';
  const escapedTable = table?.replace(/'/g, "''") ?? '';
  return `
   USE [${escapedDb}]
   SELECT COLUMN_NAME as 'column',DATA_TYPE as 'type'
   FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${escapedTable}';`;
}
```

---

## Finding 4: MSSQL Query Builder — Unquoted Table Name in FROM Clause

**Severity:** LOW  
**Type:** SQL injection in query construction  
**CWE:** CWE-89 (SQL Injection)

### Location

- **File:** `public/app/plugins/datasource/mssql/sqlUtil.ts`
- **Line:** 92

### Description

The MSSQL query builder's `toRawSql` function constructs SQL with the `table` value unquoted:

```typescript
if (dataset && table) {
    rawQuery += `FROM [${dataset}].${table} `;
}
```

While `dataset` is bracket-quoted (though without `]` escaping), `table` is inserted verbatim. A table name containing SQL syntax (e.g., `dbo.users; DROP TABLE x; --`) would produce valid injection.

### Impact

**Mitigated** — Same as Finding 3; requires editor permissions. The table name comes from user selection in the query builder, not from URL parameters or template variables.

### Recommended Fix

Bracket-quote the table name:
```typescript
rawQuery += `FROM [${dataset}].[${table}] `;
```

---

## Finding 5: MySQL Frontend — Backtick Injection in `quoteIdentifierIfNecessary`

**Severity:** LOW  
**Type:** Identifier injection  
**CWE:** CWE-89 (SQL Injection)

### Location

- **File:** `public/app/plugins/datasource/mysql/sqlUtil.ts`
- **Lines:** 44–46

### Description

```typescript
export function quoteIdentifierIfNecessary(value: string) {
  return isValidIdentifier(value) ? value : `\`${value}\``;
}
```

When a value is not a valid identifier, it's wrapped in backticks. However, backtick characters **within** the value are not escaped. In MySQL, a literal backtick inside backtick-quoted identifiers must be doubled: `` `table``name` ``.

### Impact

**Very low** — The values passed to this function come from `information_schema.tables` query results (actual table names in the database). Creating a table name containing a backtick requires MySQL admin privileges, and exploitation would require that injected table name to appear in subsequent queries.

### Recommended Fix

```typescript
export function quoteIdentifierIfNecessary(value: string) {
  return isValidIdentifier(value) ? value : `\`${value.replace(/`/g, '``')}\``;
}
```

---

## Architecture Notes

### SQL Datasource Design (By Design, Not a Vulnerability)

All three SQL datasources (MSSQL, MySQL, PostgreSQL) intentionally allow users with editor permissions to execute **arbitrary raw SQL**. The flow is:

1. Frontend sends `rawSql` in query JSON
2. Backend performs global variable interpolation (replacing `$__interval`, time range macros)
3. Backend performs datasource-specific macro interpolation
4. Interpolated query is executed directly: `db.QueryContext(ctx, interpolatedQuery)`

There is **no parameterization** — this is by design since the datasources are code editors for SQL.

### Template Variable Interpolation

Template variables are interpolated on the **frontend** before the query reaches the backend. The `SqlDatasource.interpolateVariable` method (`packages/grafana-sql/src/datasource/SqlDatasource.ts:77`) provides:
- Single values: replaces `'` with `''` (assumes the template wraps the variable in quotes)
- Multi values: wraps each in `quoteLiteral` (adds surrounding quotes with escaping)
- Numbers: pass-through

This is safe when templates use quoted contexts (e.g., `WHERE name = '$var'`), but does NOT protect against injection in unquoted numeric contexts (e.g., `WHERE id = $var`). This is a known limitation documented as part of Grafana's security model.

### Elasticsearch & Tempo

These datasources are not present in `pkg/tsdb/` — they are external plugins not bundled in this repository's backend code. Their query construction happens in separate plugin repositories and was not auditable in this scope.

### Prometheus

The Prometheus datasource delegates to `github.com/grafana/grafana-prometheus-datasource/pkg/promlib`. Queries are:
1. Parsed by the PromQL parser (`parser.NewParser`)
2. Scope filters applied via `labels.Matcher` (AST-level, safe)
3. Re-serialized via `expr.String()`
4. Sent as an HTTP parameter to the Prometheus API

No injection vulnerability identified — the PromQL parser provides structural validation, and Prometheus queries are read-only.

### Loki

Beyond the known `sql.go` issue, Loki's scope/filter handling (`pkg/tsdb/loki/scopes.go`) safely uses the LogQL parser (`syntax.ParseExprWithoutValidation`) and appends matchers at the AST level. The `interpolateVariables` function only replaces built-in time/interval variables with computed numeric values.

---

## Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | MySQL restrictedRegExp bypass via block comment (TOCTOU) | HIGH | New |
| 2 | MySQL restrictedRegExp bypass via parenthesis context | MEDIUM | New |
| 3 | MSSQL meta query unescaped parameters | LOW | New |
| 4 | MSSQL query builder unquoted table name | LOW | New |
| 5 | MySQL backtick injection in quoteIdentifierIfNecessary | LOW | New |
