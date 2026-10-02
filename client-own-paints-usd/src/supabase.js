// Optional adapter that points the same storefront at a real Supabase project.

import { TABLES } from "./schema.js";

const CHAIN_METHODS = [
  "select", "insert", "update", "delete", "upsert",
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "not", "match", "filter",
  "order", "limit", "range", "offset", "single", "maybeSingle", "textSearch", "or",
];

export async function connectSupabase({ url, anonKey }) {
  let createClient;
  try {
    ({ createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"));
  } catch (error) {
    throw new Error(`Could not load @supabase/supabase-js: ${error.message}`);
  }
  let client;
  try {
    client = createClient(String(url).trim(), String(anonKey).trim(), {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch (error) {
    throw new Error(`Could not create the Supabase client: ${error.message}`);
  }
  const db = new SupabaseBackend(client);
  return { db, makeAuth: (sessionStore) => new SupabaseAuth(client, db, sessionStore) };
}

class SupabaseBackend {
  constructor(client) {
    this.name = "supabase";
    this.client = client;
    this.session = { userId: null, role: "anon" };
    this.shopSettings = {};
    this.data = {};
    this.queryLog = [];
    this.adapter = null;
    this.backing = "supabase";
    for (const key of Object.keys(TABLES)) this.data[key] = [];
  }

  from(table) {
    if (resolveTableName(table) === "users") return emptyBuilder(this, table);
    return wrapBuilder(this, table);
  }

  asService() {
    return this;
  }

  totalsFor(subtotal) {
    const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
    const taxRate = Number(this.shopSettings.taxRate ?? 0.0825);
    const freeFrom = Number(this.shopSettings.freeShippingThreshold ?? 75);
    const flat = Number(this.shopSettings.shippingFlat ?? 6.95);
    const tax = round2(subtotal * taxRate);
    const shipping = subtotal >= freeFrom || subtotal === 0 ? 0 : flat;
    return { subtotal: round2(subtotal), tax, shipping, total: round2(subtotal + tax + shipping) };
  }

  async rpc(fn, params = {}, options = {}) {
    if (options?.session?.role === "service_role") {
      console.warn(`rpc ${fn}: ignoring a service_role request.`);
    }
    const started = performance.now();
    const { data, error } = await this.client.rpc(fn, params);
    this._log({
      kind: "rpc",
      table: fn,
      sql: `select * from ${fn}(...);`,
      rows: data ? 1 : 0,
      ms: Math.round((performance.now() - started) * 100) / 100,
      error: error ? `${error.code || error.details || ""}: ${error.message}` : null,
    });
    return { data, error };
  }

  async sqlText() {
    return {
      data: null,
      error: { code: "0A000", message: "The SQL console runs on the in-browser engine only." },
      rowCount: 0,
    };
  }

  async info(key) {
    const table = TABLES[key];
    if (!table) return null;
    const remote = resolveTableName(key) !== "users";
    return {
      key: table.key,
      label: table.label,
      schema: table.schema,
      remote,
      columns: Object.entries(table.columns).map(([name, def]) => ({
        name, type: def.type, notNull: !!def.notNull,
        default: def.default === undefined ? null : Array.isArray(def.default) ? "{}" : def.default,
        references: def.references ? `${def.references.table}(${def.references.column}) on delete ${def.references.onDelete}` : null,
      })),
      constraints: (table.constraints || []).map((c) => ({ name: c.name, definition: c.definition })),
      indexes: (table.indexes || []).map((i) => ({ name: i.name, columns: i.columns, unique: !!i.unique })),
      policies: table.rls || {},
      rows: remote ? await this._count(table.key) : null,
    };
  }

  async stats() {
    return Promise.all(
      Object.values(TABLES).map(async (table) => {
        const remote = resolveTableName(table.key) !== "users";
        return {
          key: table.key, label: table.label, remote,
          rows: remote ? await this._count(table.key) : null,
          indexes: (table.indexes || []).length,
          constraints: (table.constraints || []).length,
        };
      }),
    );
  }

  async _count(table) {
    const { count, error } = await this.client.from(table).select("*", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  }

  async counts() {
    const out = {};
    for (const table of Object.values(TABLES)) {
      out[table.key] = resolveTableName(table.key) === "users" ? null : await this._count(table.key);
    }
    return out;
  }

  async describeProject() {
    return { url: this.client.supabaseUrl, tables: await this.counts(), reachable: true };
  }

  async load() { return this; }
  async persist() {}
  onChange() { return () => {}; }

  _log(entry) {
    this.queryLog.unshift({ id: this.queryLog.length + 1, at: Date.now(), source: "client", role: this.session.role, ...entry });
    if (this.queryLog.length > 40) this.queryLog.length = 40;
  }
}

function resolveTableName(table) {
  return String(table || "").replace(/^public\./, "").replace(/^auth\./, "");
}

function emptyBuilder(backend, table) {
  const result = { data: [], error: null, status: 200, count: 0 };
  const proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "then") {
        return (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
      }
      if (property === "catch") return () => proxy;
      if (property === "single" || property === "maybeSingle") return () => proxy;
      if (property === "toSql") return () => `-- ${resolveTableName(table)} is managed by GoTrue`;
      return () => proxy;
    },
  });
  return proxy;
}

export async function probeSupabase({ url, anonKey }) {
  const base = String(url || "").trim().replace(/\/+$/, "");
  let parsed = null;
  try { parsed = new URL(base); } catch { parsed = null; }
  const isLocal = parsed ? /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(parsed.hostname) : false;
  if (!parsed || !/^https?:$/.test(parsed.protocol) || (parsed.protocol === "http:" && !isLocal)) {
    return { ok: false, reason: "url", message: "That doesn't look like a Supabase API URL." };
  }
  if (!String(anonKey || "").trim()) return { ok: false, reason: "key", message: "Paste the anon key." };

  const headers = { apikey: String(anonKey).trim(), Authorization: `Bearer ${String(anonKey).trim()}` };
  const ask = async (path) => {
    const response = await fetch(`${base}${path}`, { headers });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    return { status: response.status, body };
  };

  let products;
  try {
    products = await ask("/rest/v1/products?select=id&limit=1");
  } catch (error) {
    return { ok: false, reason: "network", message: `Could not reach ${base} — ${error.message}` };
  }
  if (products.status === 401 || products.status === 403) {
    return { ok: false, reason: "key", message: "The project answered 401/403. That anon key isn't right." };
  }
  if (products.status === 404) {
    return { ok: false, reason: "schema", message: "No `products` table. Run src/schema.sql first." };
  }
  if (products.status >= 400) {
    return { ok: false, reason: "project", message: `The project answered ${products.status}.` };
  }

  const colors = await ask("/rest/v1/colors?select=id&limit=1");
  const variants = await ask("/rest/v1/product_variants?select=id&limit=1");
  const seeded = (products.body?.length || 0) > 0;
  return {
    ok: true,
    url: base,
    seeded,
    message: seeded
      ? `Connected. Catalogue found (${colors.body?.length ?? 0} colours, ${variants.body?.length ?? 0} variants).`
      : "Connected to the project, but the catalogue is empty. Run src/seed.sql.",
    counts: {
      products: Array.isArray(products.body) ? products.body.length : 0,
      colors: Array.isArray(colors.body) ? colors.body.length : 0,
      variants: Array.isArray(variants.body) ? variants.body.length : 0,
    },
  };
}

function wrapBuilder(backend, table) {
  let builder = backend.client.from(table);
  const state = { mode: "select", columns: "*", filters: [], orders: [], limit: null, offset: 0, payload: null };

  const proxy = new Proxy({}, {
    get(_target, property) {
      if (property === "then") {
        const started = performance.now();
        return (onFulfilled, onRejected) =>
          Promise.resolve(builder).then(
            (result) => {
              backend._log({
                kind: state.mode, table, sql: describe(state, table),
                rows: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
                ms: Math.round((performance.now() - started) * 100) / 100,
                error: result.error ? `${result.error.code}: ${result.error.message}` : null,
              });
              return result;
            },
            (error) => ({ data: null, error, status: 500, count: null }),
          ).then(onFulfilled, onRejected);
      }
      if (property === "catch") return () => proxy;
      if (property === "toSql") return () => describe(state, table);
      if (CHAIN_METHODS.includes(property)) {
        return (...args) => {
          if (property === "select") state.columns = args[0] || "*";
          if (["insert", "update", "delete", "upsert"].includes(property)) { state.mode = property; state.payload = args[0] || null; }
          if (["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "not"].includes(property)) state.filters.push({ column: args[0], op: property, value: args[1] });
          if (property === "order") state.orders.push({ column: args[0], ascending: !(args[1] && args[1].ascending === false) });
          if (property === "limit") state.limit = args[0];
          if (property === "offset") state.offset = args[0];
          builder = builder[property](...args);
          return proxy;
        };
      }
      return undefined;
    },
  });
  return proxy;
}

function describe(state, table) {
  const where = state.filters.map((f) => `${f.column} ${f.op} ${JSON.stringify(f.value)}`).join(" and ");
  if (state.mode === "insert") return `insert into ${table} ... ;`;
  if (state.mode === "update") return `update ${table} set ... ${where ? `where ${where}` : ""};`;
  if (state.mode === "delete") return `delete from ${table}${where ? ` where ${where}` : ""};`;
  return `select ${state.columns} from ${table}${where ? ` where ${where}` : ""}${state.limit ? ` limit ${state.limit}` : ""};`;
}

class SupabaseAuth {
  constructor(client, db, sessionStore) {
    this.client = client;
    this.db = db;
    this.sessionStore = sessionStore;
    this.user = null;
    this.session = { userId: null, role: "anon" };
    this._listeners = new Set();
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) this._apply(session.user);
    });
  }

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  _apply(authUser) {
    this.user = {
      id: authUser.id,
      email: authUser.email || "",
      display_name: authUser.user_metadata?.display_name || "",
      encrypted_password: authUser.is_anonymous ? "anonymous" : "supabase",
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at,
      is_anonymous: !!authUser.is_anonymous,
    };
    this.session = { userId: this.user.id, role: "authenticated" };
    this.db.session = this.session;
    this._emit();
  }

  async restore() {
    const { data } = await this.client.auth.getSession();
    if (data?.session?.user) { this._apply(data.session.user); return this.user; }
    return this.signInAnonymously();
  }

  async signInAnonymously() {
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error) {
      const hint = /anonymous|not.*enabled|disabled/i.test(error.message || "")
        ? "Anonymous sign-ins are switched off. Enable them in Supabase → Authentication → Sign In / Providers → Anonymous."
        : error.message;
      const wrapped = new Error(hint);
      wrapped.code = error.code || (error.status ? String(error.status) : "08006");
      wrapped.cause = error;
      throw wrapped;
    }
    this._apply(data.user);
    return this.user;
  }

  async signUp({ email, password, displayName }) {
    const guestId = this.user?.is_anonymous ? this.user.id : null;
    const { data, error } = await this.client.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
    if (error) throw error;
    if (data.user && data.session) {
      this._apply(data.user);
      if (guestId) await this._mergeGuestCart(guestId, data.user.id);
      return this.user;
    }
    throw new Error("Check your inbox to confirm your email, then sign in.");
  }

  async signIn({ email, password }) {
    const guestId = this.user?.is_anonymous ? this.user.id : null;
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this._apply(data.user);
    if (guestId) await this._mergeGuestCart(guestId, data.user.id);
    return this.user;
  }

  async _mergeGuestCart(fromUserId, toUserId) {
    await this.client.rpc("merge_cart", { p_from_user: fromUserId, p_to_user: toUserId });
  }

  async updateProfile({ displayName }) {
    const { data, error } = await this.client.auth.updateUser({ data: { display_name: displayName } });
    if (error) throw error;
    this._apply(data.user);
    return this.user;
  }

  async deleteAccount() {
    throw new Error("Account deletion on a Supabase project belongs in an Edge Function using the service-role key.");
  }

  async signOut() {
    await this.client.auth.signOut();
    this.user = null;
    this.session = { userId: null, role: "anon" };
    this.db.session = this.session;
    this._emit();
    return this.signInAnonymously();
  }
}