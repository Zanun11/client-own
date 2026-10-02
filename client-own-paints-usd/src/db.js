// A small, faithful Postgres emulation for the schema in src/schema.sql.
//
// It enforces column types, defaults, not-null, check constraints, foreign keys with
// `on delete cascade | restrict`, unique indexes, row level security policies, and it can
// plan queries against the declared indexes (EXPLAIN). The public API mirrors the Supabase
// JS client — db.from("products").select(...).eq("paint_type", "Interior"), db.rpc("place_order", {...}) —
// so the storefront front-end is identical whether it talks to this engine or to a real
// Supabase project (see src/supabase.js).

import { TABLES } from "./schema.js";
import { PgError } from "./pg-error.js";
import { parseSql, matchesFilter, flattenConditions } from "./sql.js";

export { PgError };

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const nowIso = () => new Date().toISOString();
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const TABLE_KEYS = ["users", "colors", "products", "product_variants", "cart_items", "orders", "order_items"];

function resolveKey(name) {
  const clean = String(name).replace(/^public\./, "");
  if (clean === "auth.users" || clean === "users") return "users";
  return clean;
}

function coerceValue(column, def, value) {
  if (value === null || value === undefined) return null;
  switch (def.type) {
    case "uuid":
    case "text":
      return String(value);
    case "numeric":
      if (Number.isNaN(Number(value)))
        throw new PgError(`invalid input syntax for type numeric: "${value}"`, "22P02");
      return round2(value);
    case "int4":
      if (Number.isNaN(Number.parseInt(value, 10)))
        throw new PgError(`invalid input syntax for type integer: "${value}"`, "22P02");
      return Math.trunc(Number(value));
    case "timestamptz":
      return new Date(value).toISOString();
    case "text[]":
      if (typeof value === "string") return parseArrayLiteral(value);
      if (!Array.isArray(value)) throw new PgError(`malformed array literal for column "${column}"`, "22P02");
      return value.map(String);
    default:
      return value;
  }
}

function defaultFor(expr) {
  if (expr === "gen_random_uuid()") return uuid();
  if (expr === "now()") return nowIso();
  if (Array.isArray(expr)) return expr.slice();
  return expr;
}

// Parses a Postgres array literal such as {Matte,Gloss} or {"a,b",c}.
export function parseArrayLiteral(text) {
  const trimmed = String(text).trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}"))
    throw new PgError(`malformed array literal: "${text}"`, "22P02");
  const body = trimmed.slice(1, -1);
  if (!body.trim()) return [];
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (inQuotes) {
      if (char === '"' && body[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      current += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out;
}

const ALLOWED_ROLE_RANK = { anon: 0, authenticated: 1, service_role: 2 };
const POLICY_RANK = { public: "anon", own: "authenticated", service: "service_role", none: "service_role" };

export class QueryBuilder {
  constructor(db, table, mode = "select", session = null) {
    this.db = db;
    this.table = table;
    this.session = session || db.session;
    this._mode = mode;
    this._columns = "*";
    this._filters = [];
    this._orders = [];
    this._limit = null;
    this._offset = 0;
    this._single = false;
    this._maybeSingle = false;
    this._count = null;
    this._payload = null;
  }

  select(columns = "*", opts = {}) {
    if (this._mode === "select") this._columns = columns;
    else this._columns = columns;
    if (opts && opts.count) this._count = opts.count;
    return this;
  }

  insert(payload) {
    this._mode = "insert";
    this._payload = payload;
    return this;
  }

  update(patch) {
    this._mode = "update";
    this._payload = patch;
    return this;
  }

  delete() {
    this._mode = "delete";
    return this;
  }

  eq(column, value) {
    return this._filter(column, "=", value);
  }
  neq(column, value) {
    return this._filter(column, "!=", value);
  }
  gt(column, value) {
    return this._filter(column, ">", value);
  }
  gte(column, value) {
    return this._filter(column, ">=", value);
  }
  lt(column, value) {
    return this._filter(column, "<", value);
  }
  lte(column, value) {
    return this._filter(column, "<=", value);
  }
  like(column, value) {
    return this._filter(column, "like", value);
  }
  ilike(column, value) {
    return this._filter(column, "ilike", value);
  }
  is(column, value) {
    return this._filter(column, "is", value);
  }
  contains(column, value) {
    return this._filter(column, "@>", value);
  }
  in(column, values) {
    return this._filter(column, "in", values);
  }
  not(column, op, value) {
    const negated = {
  "=": "!=",
  "!=": "=",
  ">": "<=",
  "<": ">=",
  ">=": "<",
  "<=": ">"
};
    return this._filter(column, negated[op] || op, value);
  }

  _filter(column, op, value) {
    this._filters.push({ type: "cond", column, op, value });
    return this;
  }

  order(column, opts = {}) {
    this._orders.push({ column, ascending: opts.ascending !== false });
    return this;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  offset(n) {
    this._offset = n || 0;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._single = true;
    this._maybeSingle = true;
    return this;
  }

  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }

  async _execute() {
    const started = performance.now();
    let result;
    try {
      if (this._mode === "insert") {
        const rows = this.db._insertAs(this.table, this._payload, this.session);
        result = { data: rows, error: null, status: 201, count: rows.length };
      } else if (this._mode === "update") {
        const rows = this.db._updateRows(this.table, this._payload, this._filters, this.session);
        result = { data: rows, error: null, status: 200, count: rows.length };
      } else if (this._mode === "delete") {
        const rows = this.db._deleteRows(this.table, this._filters, this.session);
        result = { data: rows, error: null, status: 200, count: rows.length };
      } else {
        const { rows, count } = this.db._selectRows(this.table, {
          columns: this._columns,
          filter: this._filters,
          orders: this._orders,
          offset: this._offset,
          limit: this._limit,
          session: this.session,
          withCount: !!this._count,
        });
        const data = this._single ? rows[0] || null : rows;
        if (this._single && !data && !this._maybeSingle)
          result = { data: null, error: new PgError("JSON object requested, multiple (or no) rows returned", "PGRST116"), status: 406, count: 0 };
        else result = { data, error: null, status: 200, count: this._count ? count : null };
      }
    } catch (error) {
      result = { data: null, error, status: error.code === "42501" ? 401 : 400, count: null };
    }
    if (this._single && Array.isArray(result.data)) result.data = result.data[0] || null;
    const rows = Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
    this.db._log({
      source: "client",
      kind: this._mode,
      table: this.table,
      sql: this.toSql(),
      rows,
      ms: Math.round((performance.now() - started) * 100) / 100,
      error: result.error ? `${result.error.code}: ${result.error.message}` : null,
      role: this.session?.role || "anon",
    });
    return result;
  }

  toSql() {
    if (this._mode === "insert") {
      const rows = Array.isArray(this._payload) ? this._payload : [this._payload];
      const columns = rows.length ? Object.keys(rows[0]) : [];
      const values = rows
        .map((row) => `(${columns.map((column) => formatValue(row[column])).join(", ")})`)
        .join(", ");
      return `insert into ${this.table} (${columns.join(", ")}) values ${values};`;
    }
    if (this._mode === "update")
      return `update ${this.table} set ${Object.entries(this._payload || {})
        .map(([column, value]) => `${column} = ${formatValue(value)}`)
        .join(", ")}${this._where()};`;
    if (this._mode === "delete") return `delete from ${this.table}${this._where()};`;
    return `select ${this._columns} from ${this.table}${this._where()}${this._orders
      .map((order, index) => `${index ? ", " : " order by "}${order.column} ${order.ascending ? "asc" : "desc"}`)
      .join("")}${this._limit !== null ? ` limit ${this._limit}` : ""}${this._offset ? ` offset ${this._offset}` : ""};`;
  }

  _where() {
    const conditions = this._filters || [];
    if (!conditions.length) return "";
    return ` where ${conditions.map((condition) => conditionToSql(condition)).join(" and ")}`;
  }
}

export class Database {
  constructor({ schema = TABLES, adapter = null, session = { userId: null, role: "anon" }, shopSettings = {}, name = "local-postgres" } = {}) {
    this.schema = schema;
    this.adapter = adapter;
    this.session = session;
    this.shopSettings = shopSettings;
    this.name = name;
    this.data = {};
    for (const key of TABLE_KEYS) this.data[key] = [];
    this.indexes = [];
    for (const table of Object.values(schema)) {
      for (const index of table.indexes || []) {
        this.indexes.push({ table: table.key, unique: !!index.unique, columns: index.columns, name: index.name });
      }
    }
    this.queriesServed = 0;
    this.queryLog = [];
    this._querySeq = 0;
    this._listeners = new Set();
  }

  // ---------------------------------------------------------- persistence

  async load() {
    if (!this.adapter) return this;
    const saved = await this.adapter.load();
    if (saved && typeof saved === "object") {
      for (const key of TABLE_KEYS) if (Array.isArray(saved[key])) this.data[key] = saved[key];
    }
    return this;
  }

  async persist() {
    if (!this.adapter) return;
    await this.adapter.save(this.snapshot());
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.data));
  }

  async replaceAll(data) {
    for (const key of TABLE_KEYS) this.data[key] = Array.isArray(data[key]) ? data[key] : [];
    this._emit(null);
    await this.persist();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(table) {
    for (const fn of this._listeners) fn(table, this);
  }

  _log(entry) {
    this.queryLog.unshift({ id: ++this._querySeq, at: Date.now(), ...entry });
    if (this.queryLog.length > 40) this.queryLog.length = 40;
    this._emit("__query_log");
  }

  // A service-role client, used by the auth layer and by seeder jobs — the equivalent of a
  // server-side `createClient(url, service_role_key)` in Supabase.
  asService() {
    const session = { userId: null, role: "service_role" };
    return {
      from: (table) => new QueryBuilder(this, resolveKey(table), "select", session),
      rpc: (fn, params) => this.rpc(fn, params, { session }),
    };
  }

  tableOf(name) {
    const table = this.schema[resolveKey(name)];
    if (!table) throw new PgError(`relation "${name}" does not exist`, "42P01");
    return table;
  }

  from(table) {
    return new QueryBuilder(this, resolveKey(table));
  }

  // ---------------------------------------------------------------- inserts

  _insertAs(tableName, payload, session) {
    const table = this.tableOf(tableName);
    const input = Array.isArray(payload) ? payload : [payload];
    if (!input.length) throw new PgError("no rows to insert", "22023");
    const inserted = [];
    for (const raw of input) {
      if (!raw || typeof raw !== "object") throw new PgError("insert payload must be an object", "22023");
      for (const key of Object.keys(raw))
        if (!table.columns[key]) throw new PgError(`column "${key}" of relation "${table.key}" does not exist`, "42703");
      const row = {};
      for (const [column, def] of Object.entries(table.columns)) {
        const value = Object.prototype.hasOwnProperty.call(raw, column)
          ? raw[column]
          : def.default === undefined
            ? null
            : defaultFor(def.default);
        if (def.notNull && (value === null || value === undefined))
          throw new PgError(`null value in column "${column}" of relation "${table.key}" violates not-null constraint`, "23502");
        row[column] = coerceValue(column, def, value);
      }
      this._assertUnique(table, row);
      this._assertChecks(table, row);
      this._assertForeignKeys(table, row);
      this._assertInsertPolicy(table, row, session);
      this.data[table.key].push(row);
      inserted.push(row);
    }
    this._emit(table.key);
    return inserted;
  }

  _assertUnique(table, row) {
    for (const index of table.indexes || []) {
      if (!index.unique) continue;
      const clash = this.data[table.key].some(
        (existing) => existing !== row && index.columns.every((column) => matchesFilter(existing, { type: "cond", column, op: "=", value: row[column] })),
      );
      if (clash)
        throw new PgError(`duplicate key value violates unique constraint "${index.name}"`, "23505", {
          detail: `Key (${index.columns.join(", ")})=(${index.columns.map((c) => row[c]).join(", ")}) already exists.`,
        });
    }
  }

  _assertChecks(table, row) {
    for (const constraint of table.constraints || []) {
      if (!constraint.test(row))
        throw new PgError(`new row for relation "${table.key}" violates check constraint "${constraint.name}"`, "23514", {
          detail: `Failing row contains ${JSON.stringify(row)}.`,
        });
    }
  }

  _assertForeignKeys(table, row) {
    for (const [column, def] of Object.entries(table.columns)) {
      if (!def.references) continue;
      if (row[column] === null || row[column] === undefined) continue;
      const targetKey = resolveKey(def.references.table);
      const exists = this.data[targetKey].some((candidate) => candidate[def.references.column] === row[column]);
      if (!exists)
        throw new PgError(`insert or update on table "${table.key}" violates foreign key constraint "${table.key}_${column}_fkey"`, "23503", {
          detail: `Key (${column})=(${row[column]}) is not present in table "${targetKey}".`,
        });
    }
  }

  // ------------------------------------------------------ row level security

  _hasRank(table, action, session) {
    const policy = table.rls?.[action] || "service";
    const required = ALLOWED_ROLE_RANK[POLICY_RANK[policy] ?? "service_role"];
    return (ALLOWED_ROLE_RANK[session?.role || "anon"] ?? 0) >= required;
  }

  _ownsRow(table, row, session) {
    if ((session?.role || "anon") === "service_role") return true;
    if (!session?.userId) return false;
    if (table.rls?.ownerColumn) return row[table.rls.ownerColumn] === session.userId;
    if (table.rls?.inheritOwner) {
      const parentKey = resolveKey(table.rls.ownerParent || "orders");
      const parent = this.data[parentKey].find((candidate) => candidate.id === row[table.rls.inheritOwner]);
      return !!parent && parent.user_id === session.userId;
    }
    return false;
  }

  _canReadRow(table, row, session) {
    const policy = table.rls?.select || "public";
    if (policy === "public") return true;
    if (policy === "own") return this._ownsRow(table, row, session);
    return (session?.role || "anon") === "service_role";
  }

  _assertInsertPolicy(table, row, session) {
    const policy = table.rls?.insert || "service";
    if (policy !== "own" && !this._hasRank(table, "insert", session))
      throw new PgError(`new row violates row-level security policy for table "${table.key}"`, "42501");
    if (policy === "own" && !this._ownsRow(table, row, session))
      throw new PgError(`new row violates row-level security policy for table "${table.key}"`, "42501");
  }

  // ---------------------------------------------------------------- selects

  _selectRows(tableName, { columns = "*", filter = null, orders = [], offset = 0, limit = null, session = this.session, withCount = false } = {}) {
    const table = this.tableOf(tableName);
    this.queriesServed += 1;
    let rows = this.data[table.key].filter((row) => this._canReadRow(table, row, session));
    if (filter) rows = rows.filter((row) => matchesFilter(row, filter));
    const count = rows.length;
    for (const order of [...orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const av = a[order.column];
        const bv = b[order.column];
        if (av === bv) return 0;
        const result = av === null || av === undefined ? -1 : bv === null || bv === undefined ? 1 : av > bv ? 1 : -1;
        return order.ascending ? result : -result;
      });
    }
    if (offset) rows = rows.slice(offset);
    if (limit !== null && limit !== undefined) rows = rows.slice(0, limit);
    void withCount;
    const projected = rows.map((row) => this._project(table, row, columns, session));
    return { rows: projected, count };
  }

  _project(table, row, columns, session) {
    if (!columns || columns === "*") return { ...row };
    const out = {};
    for (const token of splitSelectList(columns)) {
      const embed = token.match(/^(\w+)(?:\.(\w+))?\s*\((.*)\)$/);
      if (embed) {
        const targetKey = resolveKey(embed[1]);
        const targetTable = this.schema[targetKey];
        const fk = Object.entries(table.columns).find(
          ([, def]) => def.references && resolveKey(def.references.table) === targetKey,
        );
        if (fk && targetTable) {
          const parent = this.data[targetKey].find((candidate) => candidate.id === row[fk[0]]);
          out[embed[1]] =
            parent && this._canReadRow(targetTable, parent, session)
              ? this._project(targetTable, parent, embed[3] || "*", session)
              : null;
          continue;
        }
        // Reverse embed — the child table holds the foreign key (orders → order_items).
        const childColumn = targetTable
          ? Object.entries(targetTable.columns).find(
              ([, def]) => def.references && resolveKey(def.references.table) === table.key,
            )
          : null;
        if (childColumn && targetTable) {
          out[embed[1]] = this.data[targetKey]
            .filter((child) => child[childColumn[0]] === row.id && this._canReadRow(targetTable, child, session))
            .map((child) => this._project(targetTable, child, embed[3] || "*", session));
        }
        continue;
      }
      if (token === "*") {
        Object.assign(out, row);
        continue;
      }
      out[token] = row[token] === undefined ? null : row[token];
    }
    return out;
  }

  // ---------------------------------------------------------------- updates

  _updateRows(tableName, patch, filter = null, session = this.session) {
    const table = this.tableOf(tableName);
    if (!patch || typeof patch !== "object" || !Object.keys(patch).length)
      throw new PgError("UPDATE requires a non-empty payload", "22023");
    for (const key of Object.keys(patch))
      if (!table.columns[key]) throw new PgError(`column "${key}" of relation "${table.key}" does not exist`, "42703");
    if (!this._hasRank(table, "update", session) && (table.rls?.update || "service") !== "own")
      throw new PgError(`permission denied for table ${table.key}`, "42501");
    const filterList = filter ? (Array.isArray(filter) ? filter : flattenConditions(filter)) : [];
    const targets = this.data[table.key].filter(
      (row) => this._canReadRow(table, row, session) && (!filterList.length || matchAll(row, filterList)) && this._ownsRow(table, row, session),
    );
    const updated = [];
    for (const row of targets) {
      for (const [column, def] of Object.entries(table.columns))
        if (def.notNull && Object.prototype.hasOwnProperty.call(patch, column) && patch[column] === null)
          throw new PgError(`null value in column "${column}" of relation "${table.key}" violates not-null constraint`, "23502");
      const draft = { ...row };
      for (const [column, value] of Object.entries(patch)) draft[column] = coerceValue(column, table.columns[column], value);
      if (table.columns.updated_at) draft.updated_at = nowIso();
      this._assertChecks(table, draft);
      this._assertForeignKeys(table, draft);
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, draft);
      updated.push(row);
    }
    if (updated.length) this._emit(table.key);
    return updated;
  }

  // ---------------------------------------------------------------- deletes

  _deleteRows(tableName, filter = null, session = this.session) {
    const table = this.tableOf(tableName);
    if (table.key === "users") return this._deleteUsers(filter, session);
    if (!this._hasRank(table, "delete", session))
      throw new PgError(`permission denied for table ${table.key}`, "42501");
    const victims = this.data[table.key].filter((row) => this._canReadRow(table, row, session) && matchesFilter(row, filter));
    this._deleteByIds(table.key, new Set(victims.map((row) => row.id)), 0);
    return victims;
  }

  _deleteByIds(tableKey, ids, depth) {
    if (!ids.size) return;
    if (depth > 8) throw new PgError(`cascade depth exceeded while deleting from "${tableKey}"`, "54001");
    for (const other of Object.values(this.schema)) {
      if (other.key === tableKey) continue;
      for (const [column, def] of Object.entries(other.columns)) {
        if (!def.references || resolveKey(def.references.table) !== tableKey) continue;
        const dependents = this.data[other.key].filter((row) => ids.has(row[column]));
        if (!dependents.length) continue;
        if (def.references.onDelete === "cascade") {
          this._deleteByIds(other.key, new Set(dependents.map((row) => row.id)), depth + 1);
        } else {
          throw new PgError(
            `update or delete on table "${tableKey}" violates foreign key constraint "${other.key}_${column}_fkey" on table "${other.key}"`,
            "23503",
            { detail: `Key (id)=(${dependents[0][column]}) is still referenced from table "${other.key}".` },
          );
        }
      }
    }
    const before = this.data[tableKey].length;
    this.data[tableKey] = this.data[tableKey].filter((row) => !ids.has(row.id));
    if (this.data[tableKey].length !== before) this._emit(tableKey);
  }

  _deleteUsers(filter, session) {
    const victims = this.data.users.filter(
      (row) => ((session?.role || "anon") === "service_role" || row.id === session?.userId) && matchesFilter(row, filter),
    );
    for (const user of victims) {
      const blockingOrders = this.data.orders.filter((order) => order.user_id === user.id);
      if (blockingOrders.length)
        throw new PgError(
          'update or delete on table "users" violates foreign key constraint "orders_user_id_fkey" on table "orders"',
          "23503",
          {
            detail: `Key (id)=(${user.id}) is still referenced from table "orders" — that foreign key is ON DELETE RESTRICT, so order history always survives.`,
          },
        );
      this.data.cart_items = this.data.cart_items.filter((item) => item.user_id !== user.id);
      this.data.users = this.data.users.filter((candidate) => candidate.id !== user.id);
    }
    if (victims.length) this._emit("users");
    return victims;
  }

  // ------------------------------------------------------------------- rpc

  // Server-side functions, mirrored for real Supabase in src/sql/functions.sql.
  async rpc(fn, params = {}, { session = this.session } = {}) {
    const service = { role: "service_role", userId: null };
    try {
      switch (fn) {
        case "place_order":
          return { data: this._placeOrder(params, session), error: null };
        case "merge_cart":
          return { data: this._mergeCart(params, session), error: null };
        case "advance_order_status":
          return { data: this._advanceOrderStatus(params, service), error: null };
        case "set_payment_status":
          return { data: this._setPaymentStatus(params, service), error: null };
        case "order_totals": {
          const order = this.data.orders.find((candidate) => candidate.id === params.p_order_id);
          if (!order) throw new PgError(`order ${params.p_order_id} not found`, "P0002");
          return { data: this._orderTotals(order), error: null };
        }
        case "reorder_to_cart":
          return { data: this._reorderToCart(params, session), error: null };
        default:
          throw new PgError(`function ${fn} does not exist`, "42883");
      }
    } catch (error) {
      return { data: null, error };
    }
  }

  _setPaymentStatus({ p_order_id, p_payment_status }, session) {
    const order = this.data.orders.find((candidate) => candidate.id === p_order_id);
    if (!order) throw new PgError(`order ${p_order_id} not found`, "P0002");
    this._updateRows("orders", { payment_status: p_payment_status }, [{ type: "cond", column: "id", op: "=", value: p_order_id }], session);
    return this.data.orders.find((candidate) => candidate.id === p_order_id);
  }

  _reorderToCart({ p_order_id, p_user_id }, session) {
    this._assertSelf(p_user_id, session);
    const items = this.data.order_items.filter((item) => item.order_id === p_order_id);
    if (!items.length) throw new PgError(`order ${p_order_id} has no items`, "P0002");
    let added = 0;
    for (const item of items) {
      const variant = this.data.product_variants.find((candidate) => candidate.id === item.variant_id);
      if (!variant || variant.stock_status === "Out of Stock") continue;
      this._insertAs(
        "cart_items",
        {
          user_id: p_user_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          selected_size: item.selected_size,
          selected_finish: item.selected_finish,
        },
        { role: "service_role" },
      );
      added += 1;
    }
    return { added };
  }

  _assertSelf(userId, session) {
    const role = session?.role || "anon";
    if (role !== "service_role" && session?.userId !== userId)
      throw new PgError("permission denied: you can only act on your own rows", "42501");
  }

  _placeOrder({ p_user_id, p_delivery_address, p_payment_method = "card" }, session) {
    this._assertSelf(p_user_id, session);
    if (!p_delivery_address || String(p_delivery_address).trim().length < 8)
      throw new PgError("delivery address must be at least 8 characters", "22023");
    const cart = this.data.cart_items.filter((item) => item.user_id === p_user_id);
    if (!cart.length) throw new PgError("cart is empty", "22023");
    const lines = cart.map((item) => {
      const variant = this.data.product_variants.find((candidate) => candidate.id === item.variant_id);
      if (!variant) throw new PgError(`variant ${item.variant_id} not found`, "P0002");
      if (variant.stock_status === "Out of Stock") throw new PgError("one of the items in your basket is out of stock", "22023");
      const product = this.data.products.find((candidate) => candidate.id === variant.product_id);
      const color = this.data.colors.find((candidate) => candidate.id === variant.color_id);
      if (!product || !color) throw new PgError("variant is missing its product or colour", "P0002");
      const allowedFinishes = color.finish_types || [];
      if (allowedFinishes.length && !allowedFinishes.includes(item.selected_finish))
        throw new PgError(`finish "${item.selected_finish}" is not available for ${color.name}`, "22023");
      if (product.size_options.length && !product.size_options.includes(item.selected_size))
        throw new PgError(`size "${item.selected_size}" is not available for ${product.title}`, "22023");
      const unit = round2(Number(product.base_price) * sizeFactor(item.selected_size));
      return { item, variant, product, unit, lineTotal: round2(unit * item.quantity) };
    });
    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const totals = this.totalsFor(subtotal);
    const order = this._insertAs(
      "orders",
      {
        user_id: p_user_id,
        total_amount: totals.total,
        delivery_address: String(p_delivery_address).trim(),
        status: "Pending",
        payment_status: p_payment_method === "invoice" ? "Pending" : "Paid",
      },
      { role: "service_role" },
    )[0];
    for (const line of lines) {
      this._insertAs(
        "order_items",
        {
          order_id: order.id,
          variant_id: line.variant.id,
          quantity: line.item.quantity,
          selected_size: line.item.selected_size,
          selected_finish: line.item.selected_finish,
          unit_price: line.unit,
        },
        { role: "service_role" },
      );
    }
    this.data.cart_items = this.data.cart_items.filter((item) => item.user_id !== p_user_id);
    this._emit("cart_items");
    return {
      ...order,
      subtotal: totals.subtotal,
      tax: totals.tax,
      shipping: totals.shipping,
      items: this.data.order_items.filter((item) => item.order_id === order.id),
    };
  }

  totalsFor(subtotal) {
    const taxRate = this.shopSettings.taxRate ?? 0.0825;
    const freeFrom = this.shopSettings.freeShippingThreshold ?? 75;
    const flat = this.shopSettings.shippingFlat ?? 6.95;
    const tax = round2(subtotal * taxRate);
    const shipping = subtotal >= freeFrom || subtotal === 0 ? 0 : flat;
    return { subtotal: round2(subtotal), tax, shipping, total: round2(subtotal + tax + shipping) };
  }

  _orderTotals(order) {
    const items = this.data.order_items.filter((item) => item.order_id === order.id);
    const subtotal = round2(items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0));
    return { order, items, ...this.totalsFor(subtotal) };
  }

  _mergeCart({ p_from_user, p_to_user }, session) {
    const role = session?.role || "anon";
    if (role !== "service_role" && session?.userId !== p_to_user)
      throw new PgError("permission denied: you can only merge into your own cart", "42501");
    if (!this.data.users.some((user) => user.id === p_to_user)) throw new PgError(`user ${p_to_user} not found`, "P0002");
    const drop = new Set();
    let moved = 0;
    for (const item of this.data.cart_items.filter((candidate) => candidate.user_id === p_from_user)) {
      const existing = this.data.cart_items.find(
        (candidate) =>
          candidate.user_id === p_to_user &&
          candidate.variant_id === item.variant_id &&
          candidate.selected_size === item.selected_size &&
          candidate.selected_finish === item.selected_finish,
      );
      if (existing) {
        existing.quantity += item.quantity;
        drop.add(item.id);
      } else {
        item.user_id = p_to_user;
      }
      moved += 1;
    }
    this.data.cart_items = this.data.cart_items.filter((item) => !drop.has(item.id));
    this._emit("cart_items");
    return { moved };
  }

  _advanceOrderStatus({ p_order_id, p_status }, session) {
    const order = this.data.orders.find((candidate) => candidate.id === p_order_id);
    if (!order) throw new PgError(`order ${p_order_id} not found`, "P0002");
    this._updateRows("orders", { status: p_status }, [{ type: "cond", column: "id", op: "=", value: p_order_id }], session);
    return this.data.orders.find((candidate) => candidate.id === p_order_id);
  }

  info(tableName) {
    const table = this.tableOf(tableName);
    return {
      key: table.key,
      label: table.label || `public.${table.key}`,
      schema: table.schema,
      columns: Object.entries(table.columns).map(([name, def]) => ({
        name,
        type: def.type,
        notNull: !!def.notNull,
        default: def.default === undefined ? null : Array.isArray(def.default) ? "{}" : def.default,
        references: def.references
          ? `${resolveKey(def.references.table)}(${def.references.column}) on delete ${def.references.onDelete}`
          : null,
      })),
      constraints: (table.constraints || []).map((constraint) => ({ name: constraint.name, definition: constraint.definition })),
      indexes: (table.indexes || []).map((index) => ({ name: index.name, columns: index.columns, unique: !!index.unique })),
      policies: table.rls || {},
      rows: this.data[table.key].length,
    };
  }

  stats() {
    const result = [];
    for (const table of Object.values(this.schema)) {
      result.push({
        key: table.key,
        label: table.label,
        rows: this.data[table.key].length,
        indexes: (table.indexes || []).length,
        constraints: (table.constraints || []).length,
      });
    }
    return result;
  }

  plan(tableName, filter, orders = [], estimatedRows = null) {
    const table = this.tableOf(tableName);
    const conditions = flattenConditions(filter);
    const rows =
      estimatedRows === null
        ? this.data[table.key].filter((row) => this._canReadRow(table, row, this.session) && matchesFilter(row, filter)).length
        : estimatedRows;
    const eqColumns = conditions.filter((condition) => condition.op === "=").map((condition) => condition.column);
    const usable = this.indexes.find((index) => index.table === table.key && eqColumns.includes(index.columns[0]));
    const lines = [];
    if (usable) {
      lines.push(`Index Scan using ${usable.name} on ${table.key}  (cost=0.15..${(0.02 + rows * 0.014).toFixed(2)} rows=${rows} width=96)`);
      const match = conditions.find((condition) => condition.column === usable.columns[0]);
      if (match) lines.push(`  Index Cond: (${match.column} = ${formatValue(match.value)})`);
      for (const condition of conditions.filter((c) => c.column !== usable.columns[0]))
        lines.push(`  Filter: (${condition.column} ${condition.op} ${formatValue(condition.value)})`);
    } else {
      lines.push(
        `Seq Scan on ${table.key}  (cost=0.00..${(0.01 + this.data[table.key].length * 0.021).toFixed(2)} rows=${rows} width=96)`,
      );
      for (const condition of conditions) lines.push(`  Filter: (${condition.column} ${condition.op} ${formatValue(condition.value)})`);
    }
    for (const order of orders) lines.push(`  Sort Key: ${order.column} ${order.ascending ? "ASC" : "DESC"}`);
    return lines;
  }

  // --------------------------------------------------------- SQL console

  // Coerces quoted array literals ('{Matte,Gloss}') in a parsed WHERE clause into real
  // arrays for text[] columns — Postgres does the same with its array literal syntax.
  _coerceFilter(tableName, filter) {
    const table = this.schema[resolveKey(tableName)];
    const walk = (node) => {
      if (!node) return node;
      if (Array.isArray(node)) return node.map(walk);
      if (node.type === "cond") {
        const def = table?.columns?.[node.column];
        if (def?.type === "text[]" && typeof node.value === "string")
          return { ...node, value: parseArrayLiteral(node.value) };
        return node;
      }
      if (node.type === "and" || node.type === "or") return { ...node, children: node.children.map(walk) };
      if (node.type === "not") return { ...node, child: walk(node.child) };
      return node;
    };
    return walk(filter);
  }

  async sqlText(text, session = null) {
    const activeSession = session || this.session;
    const started = performance.now();
    try {
      const statement = parseSql(text);
      const filter = this._coerceFilter(statement.table, statement.filter);
      const duration = () => Math.round((performance.now() - started) * 100) / 100;
      let result;
      if (statement.kind === "select") {
        const plan = this.plan(statement.table, filter, statement.orders);
        const { rows, count } = this._selectRows(statement.table, {
          columns: statement.columns,
          filter,
          orders: statement.orders,
          offset: statement.offset || 0,
          limit: statement.limit,
          session: activeSession,
        });
        const data = statement.aggregate === "count" ? [{ count }] : rows.map((row) => pickColumns(row, statement.columns));
        result = { data, error: null, rowCount: data.length, plan, durationMs: duration() };
      } else if (statement.kind === "insert") {
        const rows = this._insertAs(statement.table, statement.values, activeSession);
        result = { data: rows, error: null, rowCount: rows.length, durationMs: duration() };
      } else if (statement.kind === "update") {
        const rows = this._updateRows(statement.table, statement.values, filter, activeSession);
        result = { data: rows, error: null, rowCount: rows.length, durationMs: duration() };
      } else if (statement.kind === "delete") {
        const rows = this._deleteRows(statement.table, filter, activeSession);
        result = { data: rows, error: null, rowCount: rows.length, durationMs: duration() };
      } else {
        throw new PgError("unsupported statement", "42601");
      }
      this._log({
        source: "console",
        kind: statement.kind,
        table: statement.table,
        sql: String(text).trim(),
        rows: result.rowCount,
        ms: result.durationMs,
        error: null,
        role: activeSession?.role || "anon",
      });
      return result;
    } catch (error) {
      this._log({
        source: "console",
        kind: "error",
        table: "-",
        sql: String(text).trim(),
        rows: 0,
        ms: Math.round((performance.now() - started) * 100) / 100,
        error: `${error.code}: ${error.message}`,
        role: activeSession?.role || "anon",
      });
      return { data: null, error, rowCount: 0, durationMs: 0 };
    }
  }
}

export function sizeFactor(size) {
  const factors = { "500ml": 0.28, "1L": 0.38, "2.5L": 0.72, "5L": 1, "10L": 1.78 };
  if (size in factors) return factors[size];
  const match = String(size).match(/^([\d.]+)\s*(ml|l)$/i);
  if (!match) return 1;
  const litres = match[2].toLowerCase() === "ml" ? Number(match[1]) / 1000 : Number(match[1]);
  return Math.max(0.2, round2((litres / 5) * 1.15));
}

export function formatValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${String(value)}'`;
}

function matchAll(row, conditions) {
  return conditions.every((condition) => matchesFilter(row, condition));
}

export function conditionToSql(node) {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(conditionToSql).filter(Boolean).join(" and ");
  switch (node.type) {
    case "cond":
      if (node.op === "in") return `${node.column} in (${(node.value || []).map(formatValue).join(", ")})`;
      if (node.op === "is" || node.op === "is not") return `${node.column} ${node.op} null`;
      return `${node.column} ${node.op} ${formatValue(node.value)}`;
    case "and":
      return node.children.map((child) => `(${conditionToSql(child)})`).join(" and ");
    case "or":
      return node.children.map((child) => `(${conditionToSql(child)})`).join(" or ");
    case "not":
      return `not (${conditionToSql(node.child)})`;
    default:
      return "";
  }
}

export function splitSelectList(columns) {
  const tokens = [];
  let depth = 0;
  let current = "";
  for (const char of String(columns)) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      tokens.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens.filter(Boolean);
}

function pickColumns(row, columns) {
  if (!columns || columns === "*" || /count\s*\(/i.test(columns)) return { ...row };
  const out = {};
  for (const token of splitSelectList(columns)) {
    if (/^\w+\s*\((.*)\)$/.test(token)) continue;
    out[token] = row[token];
  }
  return out;
}
