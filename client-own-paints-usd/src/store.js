// Storefront service layer: one place that owns the database client, the auth
// session and every read/write the UI performs. Views never touch `db` directly,
// so switching to a real Supabase project (src/supabase.js) is a one-line change.

import { Database, PgError } from "./db.js";
import { makeStore, tableAdapter, getRoot } from "./persistence.js";
import { Auth, isAnonymous, profileOf } from "./auth.js";
import { seedAll, DEMO_ACCOUNT, IMAGES, COLORS as COLOR_SEED, PRODUCTS as PRODUCT_SEED } from "./seed.js";

const money = (value, symbol = "$") => {
  const number = Number(value || 0);
  const formatted = Math.abs(number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${number < 0 ? "-" : ""}${symbol}${formatted}`;
};

export const store = {
  db: null,
  auth: null,
  user: null,
  settings: {},
  backend: "local",
  ready: false,
  bootError: null,
  seedReport: null,
  products: [],
  colors: [],
  variants: [],
  _listeners: new Set(),
  _persistTimer: null,

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  notify(detail = {}) {
    for (const fn of this._listeners) fn(detail);
  },

  money(value) {
    return money(value, this.settings.currencySymbol || "$");
  },

  get signedIn() {
    return !!this.user && !isAnonymous(this.user);
  },

  get profile() {
    return profileOf(this.user);
  },

  userDisplayName() {
    const profile = this.profile;
    return profile ? profile.displayName : "Guest shopper";
  },
};

export async function bootstrap({ supabaseConfig = null } = {}) {
  const dbStore = makeStore("spectrum_db");
  const sessionStore = makeStore("spectrum_session");
  const settings = buildSettings();
  store.settings = settings;

  let db;
  let backend = "local";
  let makeRemoteAuth = null;
  if (supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey) {
    const { connectSupabase } = await import("./supabase.js");
    const remote = await connectSupabase(supabaseConfig);
    db = remote.db;
    db.shopSettings = settings;
    db.config = supabaseConfig;
    makeRemoteAuth = remote.makeAuth;
    backend = "supabase";
  } else {
    db = new Database({ adapter: tableAdapter(dbStore), session: { userId: null, role: "anon" }, shopSettings: settings });
    await db.load();
  }
  store.db = db;
  store.backend = backend;
  store.persistence = db.backing || dbStore.backing;

  const auth = makeRemoteAuth ? makeRemoteAuth(sessionStore) : new Auth({ db, sessionStore });
  store.auth = auth;
  auth.onChange(() => {
    store.user = auth.user;
    store.notify({ reason: "auth" });
  });

  if (backend === "local" && db.data.products.length === 0) {
    store.seedReport = await seedAll(db, { shopSettings: settings });
  }

  await auth.restore();
  store.user = auth.user;

  if (backend === "local") {
    db.onChange((table) => {
      store.notify({ reason: "db", table });
      schedulePersist();
    });
    await refreshCatalog();
    await db.persist();
  } else {
    await refreshCatalog();
  }

  store.ready = true;
  store.notify({ reason: "boot" });
  return store;
}

function schedulePersist() {
  if (store.backend !== "local") return;
  clearTimeout(store._persistTimer);
  store._persistTimer = setTimeout(() => {
    store.db.persist().catch(() => {});
  }, 120);
}

function buildSettings() {
  // Normally these come from the perchance `store` block in main.pjs. Served as a plain
  // static site there is no main.pjs, so define `window.spectrumSettings` before
  // src/app.js loads (see the "Running it on your own machine" notes in README.md) —
  // or just edit the defaults below. Keys are the same as the main.pjs block.
  const pjs = getRoot()?.store || (typeof window !== "undefined" ? window.spectrumSettings : null) || {};
  const pick = (key, fallback) => (pjs[key] === undefined || pjs[key] === null ? fallback : pjs[key]);
  return {
    name: pick("name", "(CLIENT OWN) paints"),
    shortName: pick("shortName", "(CLIENT OWN)"),
    tagline: pick("tagline", "Paint worth living in"),
    blurb: pick("blurb", "Premium water-based paint, mixed in (CLIENT OWN) and delivered to your door."),
    phone: pick("phone", "(CLIENT OWN)"),
    email: pick("email", "(CLIENT OWN)"),
    addressLine: pick("addressLine", "(CLIENT OWN)"),
    currencySymbol: pick("currencySymbol", "$"),
    taxRate: Number(pick("taxRate", 0.0825)),
    freeShippingThreshold: Number(pick("freeShippingThreshold", 75)),
    shippingFlat: Number(pick("shippingFlat", 6.95)),
    vatLabel: pick("vatLabel", "Sales tax"),
  };
}

export async function refreshCatalog() {
  const { data: products } = await store.db.from("products").select("*").order("title");
  const { data: colors } = await store.db.from("colors").select("*").order("name");
  const { data: variants } = await store.db.from("product_variants").select("*");
  store.products = products || [];
  store.colors = colors || [];
  store.variants = variants || [];
}

// ------------------------------------------------------------------ catalogue

export function productMeta(title) {
  return PRODUCT_SEED.find((product) => product.title === title)?.meta || {};
}

export function colorUsage(name) {
  return COLOR_SEED.find((color) => color.name === name)?.usage || [];
}

export function productById(id) {
  return store.products.find((product) => product.id === id) || null;
}

export function colorById(id) {
  return store.colors.find((color) => color.id === id) || null;
}

export function variantsForProduct(productId) {
  return store.variants.filter((variant) => variant.product_id === productId);
}

export function colorsForProduct(productId) {
  return variantsForProduct(productId)
    .map((variant) => ({ variant, color: colorById(variant.color_id) }))
    .filter((entry) => entry.color)
    .sort((a, b) => a.color.name.localeCompare(b.color.name));
}

export function finishesForProduct(productId) {
  const set = new Set();
  for (const { color } of colorsForProduct(productId)) for (const finish of color.finish_types) set.add(finish);
  return [...set];
}

export function variantFor(productId, colorId) {
  return store.variants.find((variant) => variant.product_id === productId && variant.color_id === colorId) || null;
}

export function stockFor(productId, colorId) {
  return variantFor(productId, colorId)?.stock_status || "Out of Stock";
}

export async function searchProducts({ paintType, category, colorId, size, finish, query, sort } = {}) {
  let filter = store.db.from("products").select("*");
  if (paintType && paintType !== "All") filter = filter.eq("paint_type", paintType);
  if (size) filter = filter.contains("size_options", [size]);
  let candidateIds = null;
  if (colorId) {
    const { data } = await store.db.from("product_variants").select("product_id").eq("color_id", colorId);
    candidateIds = [...new Set((data || []).map((row) => row.product_id))];
  }
  if (category && category !== "All") {
    const categoryColors = store.colors.filter((color) => color.category === category);
    const { data } = await store.db
      .from("product_variants")
      .select("product_id")
      .in("color_id", categoryColors.map((color) => color.id));
    const ids = new Set((data || []).map((row) => row.product_id));
    candidateIds = candidateIds ? candidateIds.filter((id) => ids.has(id)) : [...ids];
  }
  if (candidateIds) {
    if (!candidateIds.length) return [];
    filter = filter.in("id", candidateIds);
  }
  if (query) filter = filter.ilike("title", `%${query}%`);
  const orders = {
    "price-asc": ["base_price", true],
    "price-desc": ["base_price", false],
    newest: ["created_at", false],
    az: ["title", true],
  }[sort || "az"];
  if (orders) filter = filter.order(orders[0], { ascending: orders[1] });
  const { data, error } = await filter;
  if (error) return [];
  let products = data || [];
  if (finish) {
    const { data: variantRows } = await store.db.from("product_variants").select("product_id, color_id");
    const allowed = new Set(
      (variantRows || [])
        .filter((row) => (colorById(row.color_id)?.finish_types || []).includes(finish))
        .map((row) => row.product_id),
    );
    products = products.filter((product) => allowed.has(product.id));
  }
  return products;
}

// ---------------------------------------------------------------------- cart

export async function cartLines() {
  if (!store.user) return [];
  const { data, error } = await store.db
    .from("cart_items")
    .select("*, product_variants(*, products(*), colors(*))")
    .order("created_at");
  if (error || !data) return [];
  return data.map((row) => {
    const variant = row.product_variants || {};
    return {
      ...row,
      variant,
      product: variant.products || null,
      color: variant.colors || null,
      unitPrice: unitPriceFor(variant.products, row.selected_size),
    };
  });
}

export async function cartCount() {
  const { data } = await store.db.from("cart_items").select("quantity");
  return (data || []).reduce((sum, row) => sum + row.quantity, 0);
}

export function unitPriceFor(product, size) {
  const base = Number(product?.base_price || 0);
  return Math.round(base * sizeFactorLocal(size) * 100) / 100;
}

function sizeFactorLocal(size) {
  const factors = { "500ml": 0.28, "1L": 0.38, "2.5L": 0.72, "5L": 1, "10L": 1.78 };
  if (size in factors) return factors[size];
  const match = String(size).match(/^([\d.]+)\s*(ml|l)$/i);
  if (!match) return 1;
  const litres = match[2].toLowerCase() === "ml" ? Number(match[1]) / 1000 : Number(match[1]);
  return Math.max(0.2, Math.round((litres / 5) * 1.15 * 100) / 100);
}

export async function addToCart({ variantId, productId, colorId, size, finish, quantity = 1 }) {
  if (!store.user) return { error: new Error("not signed in") };
  if (!variantId && productId && colorId) variantId = variantFor(productId, colorId)?.id || null;
  if (!variantId) return { error: new Error("pick a colour first") };
  const { data: existing } = await store.db
    .from("cart_items")
    .select("*")
    .eq("variant_id", variantId)
    .eq("selected_size", size)
    .eq("selected_finish", finish)
    .maybeSingle();
  if (existing) {
    const { data, error } = await store.db
      .from("cart_items")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id)
      .select()
      .maybeSingle();
    return { data, error };
  }
  const { data, error } = await store.db
    .from("cart_items")
    .insert({ user_id: store.user.id, variant_id: variantId, quantity, selected_size: size, selected_finish: finish })
    .select()
    .maybeSingle();
  return { data, error };
}

export async function setCartQuantity(id, quantity) {
  if (quantity <= 0) return removeCartItem(id);
  const { data, error } = await store.db.from("cart_items").update({ quantity }).eq("id", id).select().maybeSingle();
  return { data, error };
}

export async function removeCartItem(id) {
  const { error } = await store.db.from("cart_items").delete().eq("id", id);
  return { error };
}

export async function clearCart() {
  if (!store.user) return { error: null };
  const { error } = await store.db.from("cart_items").delete().eq("user_id", store.user.id);
  return { error };
}

export function cartTotals(lines = []) {
  const subtotal = (lines || []).reduce((sum, line) => sum + Number(line.unitPrice ?? line.unit ?? 0) * Number(line.quantity ?? 0), 0);
  return store.db.totalsFor(subtotal);
}

// -------------------------------------------------------------------- orders

export async function placeOrder({ address, paymentMethod = "card", payment_method, shipping_address, shipping_city, shipping_state, customer_name, customer_phone } = {}) {
  if (!store.user) throw new Error("not signed in");
  const built = address || [shipping_address, shipping_city, shipping_state].filter(Boolean).join(", ");
  const contact = [customer_name, customer_phone].filter(Boolean).join(" — ");
  const delivery = [contact, built].filter(Boolean).join(", ").trim();
  const method = paymentMethod || payment_method || "card";
  const { data, error } = await store.db.rpc("place_order", {
    p_user_id: store.user.id,
    p_delivery_address: delivery,
    p_payment_method: method,
  });
  if (error) throw error;
  await refreshCatalog();
  // The local engine returns the inserted order row; the SQL function returns the new
  // id plus the totals it computed. Normalise both to the order row the checkout view
  // routes to (#/orders/<id>).
  if (data && data.id) return { data };
  const id = data?.order_id || null;
  if (!id) return { data };
  const { data: row } = await store.db.from("orders").select("*").eq("id", id).maybeSingle();
  return { data: { ...(row || {}), ...data, id, total_amount: data.total_amount ?? row?.total_amount ?? 0 } };
}

export async function listOrders() {
  const { data, error } = await store.db
    .from("orders")
    .select("*, order_items(*, product_variants(*, products(*), colors(*)))")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((order) => ({
    ...order,
    items: (order.order_items || []).map((item) => ({
      ...item,
      variant: item.product_variants || {},
      product: item.product_variants?.products || null,
      color: item.product_variants?.colors || null,
    })),
  }));
}

export async function getOrder(id) {
  const { data, error } = await store.db
    .from("orders")
    .select("*, order_items(*, product_variants(*, products(*), colors(*)))")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    ...data,
    items: (data.order_items || []).map((item) => ({
      ...item,
      variant: item.product_variants || {},
      product: item.product_variants?.products || null,
      color: item.product_variants?.colors || null,
    })),
  };
}

export async function reorder(orderId) {
  if (!store.user) return { error: new Error("not signed in") };
  return store.db.rpc("reorder_to_cart", { p_order_id: orderId, p_user_id: store.user.id });
}

export async function advanceOrderStatus(orderId, status) {
  return store.db.rpc("advance_order_status", { p_order_id: orderId, p_status: status }, {
    session: { role: "service_role", userId: null },
  });
}

export async function setPaymentStatus(orderId, paymentStatus) {
  return store.db.rpc("set_payment_status", { p_order_id: orderId, p_payment_status: paymentStatus }, {
    session: { role: "service_role", userId: null },
  });
}

export function orderTimeline(order) {
  const steps = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered"];
  if (order.status === "Cancelled") return steps.map((step) => ({ step, state: "cancelled" }));
  const index = steps.indexOf(order.status);
  return steps.map((step, position) => ({ step, state: position < index ? "done" : position === index ? "current" : "todo" }));
}

// ------------------------------------------------------------------ database

export async function runSql(text, { asService = false } = {}) {
  return store.db.sqlText(text, asService ? { role: "service_role", userId: null } : store.db.session);
}

export function sqlRoles() {
  return ["client", "service_role"];
}

export async function tableInfo(key) {
  return store.db.info(key);
}

export async function databaseStats() {
  return store.db.stats();
}

export function queryLog() {
  return store.db.queryLog || [];
}

/** True when the writes the local engine performs for you (seeding, truncation,
 *  service-role reads) have no remote equivalent — the browser only holds an anon key. */
export function isRemoteBackend() {
  return store.backend === "supabase";
}

export async function reseedDatabase() {
  if (isRemoteBackend()) {
    throw new PgError(
      "This project is a real Supabase database, so the browser can't wipe and re-seed it. Run src/seed.sql in the Supabase SQL editor, then reload. To give yourself order history, use \"Load demo orders\" below.",
      "0A000",
    );
  }
  const report = await seedAll(store.db, { shopSettings: store.settings });
  store.seedReport = report;
  await refreshCatalog();
  store.notify({ reason: "reseed" });
  return report;
}

/** Remote-only: fills the signed-in account's history with the four demo orders
 *  using the `seed_demo_orders` function in src/sql/functions.sql. */
export async function loadDemoOrders() {
  if (!store.user) throw new PgError("sign in first — demo orders belong to an account", "42501");
  const { data, error } = await store.db.rpc("seed_demo_orders", {});
  if (error) throw error;
  store.notify({ reason: "reseed" });
  return data;
}

export async function truncateTable(key) {
  if (isRemoteBackend()) {
    return {
      error: new PgError(
        "Deleting rows is a service-role operation, and the browser only holds the anon key. Use the Supabase table editor, or run a `delete` in the Supabase SQL editor.",
        "42501",
      ),
    };
  }
  const order = ["order_items", "orders", "cart_items", "product_variants", "products", "colors"];
  const start = order.indexOf(key);
  const targets = start === -1 ? [key] : order.slice(start);
  try {
    for (const table of targets) {
      const { error } = await store.db.asService().from(table).delete();
      if (error) throw error;
    }
    await refreshCatalog();
    store.notify({ reason: "truncate" });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export { DEMO_ACCOUNT, IMAGES, isAnonymous, profileOf };
