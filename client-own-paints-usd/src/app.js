// Storefront UI: hash router + views for the paint shop.

import {
  store,
  bootstrap,
  searchProducts,
  productMeta,
  colorUsage,
  productById,
  colorById,
  colorsForProduct,
  finishesForProduct,
  variantFor,
  stockFor,
  cartLines,
  cartCount,
  unitPriceFor,
  addToCart,
  setCartQuantity,
  removeCartItem,
  cartTotals,
  placeOrder,
  listOrders,
  getOrder,
  reorder,
  advanceOrderStatus,
  setPaymentStatus,
  orderTimeline,
  runSql,
  tableInfo,
  databaseStats,
  queryLog,
  reseedDatabase,
  truncateTable,
  refreshCatalog,
  loadDemoOrders,
  isRemoteBackend,
  DEMO_ACCOUNT,
  IMAGES,
  profileOf,
} from "./store.js";
import { probeSupabase } from "./supabase.js";
import { PAINT_TYPES, TABLES } from "./schema.js";

const appEl = document.getElementById("appEl");
const basketCountEl = document.getElementById("basketCountEl");
const accountBtnEl = document.getElementById("accountBtnEl");
const queryLogBtnEl = document.getElementById("queryLogBtnEl");
const queryLogPanelEl = document.getElementById("queryLogPanelEl");

const ui = {
  route: { name: "home", parts: [], params: new URLSearchParams() },
  filters: { paintType: "All", category: "All", size: "", finish: "", query: "", sort: "az", colorId: null },
  buy: { colorId: null, size: null, finish: null, quantity: 1 },
  sql: { text: "select id, title, base_price, paint_type from products where paint_type = 'Interior' order by base_price desc limit 5;", result: null, role: "client" },
  adminTable: "orders",
  connect: null,
  logOpen: false,
  busy: false,
};

// Tracks the last hash the shop view applied its query params from, so that
// in-page filter clicks are not immediately overwritten by stale URL params.
let lastShopHash = null;

const SAMPLES = [
  { label: "Interior products", sql: "select id, title, base_price, size_options from products where paint_type = 'Interior' order by base_price desc;" },
  { label: "Undertones of sage", sql: "select name, hex_code, category from colors where category = 'Greens' order by name;" },
  { label: "Deep colours with a gloss finish", sql: "select name, finish_types from colors where finish_types @> '{Gloss}' and category in ('Blues','Greens', 'Greys');" },
  { label: "Orders that are still moving", sql: "select id, status, payment_status, total_amount from orders where status in ('Pending','Confirmed','Processing','Shipped') order by created_at desc;" },
  { label: "Sold out colourways", sql: "select product_id, color_id, stock_status from product_variants where stock_status = 'Out of Stock';" },
  { label: "Recently edited products", sql: "select title, base_price, updated_at from products order by updated_at desc limit 4;" },
];

// --------------------------------------------------------------------- utils

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const money = (value) => store.money(value);

const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const dateTime = (iso) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const stockClass = (status) => (status === "In Stock" ? "ok" : status === "Low Stock" ? "warn" : "bad");

function focusRing(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

function toast(message, kind = "ok") {
  const box = document.createElement("div");
  box.className = `toast toast-${kind}`;
  box.innerHTML = message;
  document.getElementById("toastCtn").appendChild(box);
  setTimeout(() => box.classList.add("toast-out"), 4200);
  setTimeout(() => box.remove(), 4800);
}

function pgErrorMarkup(error) {
  if (!error) return "";
  const code = error.code ? `<span class="pg-code">${escapeHtml(error.code)}</span>` : "";
  const detail = error.detail ? `<span class="pg-detail">${escapeHtml(error.detail)}</span>` : "";
  return `${code}<span class="pg-msg">${escapeHtml(error.message || String(error))}</span>${detail}`;
}

function reportError(prefix, error) {
  toast(`${prefix ? `<b>${escapeHtml(prefix)}</b><br>` : ""}${pgErrorMarkup(error)}`, "bad");
}

function tin(product, color, size) {
  const meta = productMeta(product.title);
  return `
    <div class="tin" style="--swatch:${escapeHtml(color?.hex_code || "#EFE7D8")}">
      <img src="${escapeHtml(meta.image || IMAGES.interiorTin)}" alt="${escapeHtml(product.title)} in ${escapeHtml(color?.name || "")}" loading="lazy">
      <div class="tin-label">
        <span class="tin-brand">(CLIENT OWN)</span>
        <span class="tin-product">${escapeHtml(product.title.replace(" Interior", ""))}</span>
        <span class="tin-stripe"></span>
        <span class="tin-colour">${escapeHtml(color?.name || "")} · ${escapeHtml(size || "")}</span>
      </div>
    </div>`;
}

function swatch(color, size = "md") {
  const light = focusRing(color.hex_code);
  return `<span class="swatch swatch-${size}${light ? " swatch-light" : ""}" style="background:${escapeHtml(color.hex_code)}" title="${escapeHtml(color.name)}"></span>`;
}

// ------------------------------------------------------------------ chrome

function setRouteFromHash() {
  const raw = location.hash || "";
  const hash = raw.startsWith("#/") ? raw.slice(2) : "";
  const [path, search] = hash.split("?");
  const parts = path.split("/").filter(Boolean);
  let name = parts[0] || "home";
  if (name === "orders" && parts[1]) name = "order";
  ui.route = { name, parts, params: new URLSearchParams(search || "") };
  return ui.route;
}

async function syncChrome() {
  const count = await cartCount();
  basketCountEl.textContent = count;
  basketCountEl.hidden = count === 0;
  const profile = store.profile;
  accountBtnEl.innerHTML = profile
    ? profile.isAnonymous
      ? "Guest"
      : escapeHtml(profile.displayName)
    : "Account";
  queryLogBtnEl.hidden = store.backend !== "local";
  if (!queryLogPanelEl.hidden) renderQueryLog();
}

function renderQueryLog() {
  const entries = queryLog();
  queryLogPanelEl.innerHTML = `
    <header>
      <div>
        <strong>Query log</strong>
        <span class="muted">${entries.length} recent · ${store.persistence}</span>
      </div>
      <button class="chip" data-action="close-log">close</button>
    </header>
    ${
      entries.length
        ? `<ul>${entries
            .map(
              (entry) => `<li class="${entry.error ? "bad" : ""}">
                <div class="log-meta">
                  <span class="pill pill-${entry.source}">${escapeHtml(entry.source)}</span>
                  <span class="pill">${escapeHtml(entry.kind)}</span>
                  <span class="muted">${escapeHtml(entry.role || "")} · ${entry.rows} row${entry.rows === 1 ? "" : "s"} · ${entry.ms}ms</span>
                  <button class="chip" data-action="sql-from-log" data-sql="${escapeHtml(entry.sql)}">open in console</button>
                </div>
                <code>${escapeHtml(entry.sql)}</code>
                ${entry.error ? `<div class="log-error">${escapeHtml(entry.error)}</div>` : ""}
              </li>`,
            )
            .join("")}</ul>`
        : `<p class="muted pad">No queries yet — browse the shop and they will appear here.</p>`
    }`;
}

// ------------------------------------------------------------------- router

async function render() {
  const route = setRouteFromHash();
  stopHeroSlideshow();
  if (!store.ready) {
    appEl.innerHTML = bootScreen();
    return;
  }
  document.body.dataset.route = route.name;
  const view = VIEWS[route.name] || VIEWS.notfound;
  appEl.innerHTML = await view(route);
  if (route.name === "home") startHeroSlideshow();
  await syncChrome();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

function bootScreen(message = "Mixing the first tin…") {
  return `<div class="boot">
    <div class="boot-swatch"></div>
    <p>${escapeHtml(message)}</p>
    <span class="muted">starting the storefront database</span>
  </div>`;
}

let heroTimer = null;
function stopHeroSlideshow() {
  if (heroTimer) {
    clearInterval(heroTimer);
    heroTimer = null;
  }
}
function showHeroSlide(index) {
  const slides = [...document.querySelectorAll(".hero-slide")];
  if (!slides.length) return;
  const safe = ((index % slides.length) + slides.length) % slides.length;
  slides.forEach((slide, i) => slide.classList.toggle("active", i === safe));
  [...document.querySelectorAll(".hero-dot")].forEach((dot, i) => dot.classList.toggle("active", i === safe));
  return safe;
}
function startHeroSlideshow() {
  stopHeroSlideshow();
  if (!document.querySelector(".hero-slide")) return;
  let index = 0;
  [...document.querySelectorAll(".hero-dot")].forEach((dot) => {
    dot.addEventListener("click", () => {
      index = showHeroSlide(Number(dot.dataset.heroDot)) ?? index;
    });
  });
  heroTimer = setInterval(() => {
    if (!document.querySelector(".hero-slide")) {
      stopHeroSlideshow();
      return;
    }
    index = showHeroSlide(index + 1) ?? index + 1;
  }, 3000);
}

// --------------------------------------------------------------------- home

async function homeView() {
  const featured = store.products.filter((product) => productMeta(product.title).featured);
  const counts = (await databaseStats()).reduce((acc, table) => ({ ...acc, [table.key]: table.rows ?? "—" }), {});
  const systemCards = PAINT_TYPES.map((type) => {
    const products = store.products.filter((product) => product.paint_type === type);
    const from = products.length ? Math.min(...products.map((product) => Number(product.base_price))) : 0;
    return `<a class="system-card" href="#/shop?paint_type=${type}">
      <span class="system-count">${products.length} product${products.length === 1 ? "" : "s"}</span>
      <h3>${escapeHtml(type)}</h3>
      <p>${escapeHtml(SYSTEM_BLURB[type])}</p>
      <span class="link">Shop ${escapeHtml(type.toLowerCase())} paint from ${money(from)}</span>
    </a>`;
  }).join("");

  const swatches = store.colors
    .map(
      (color) => `<a class="swatch-link" href="#/shop?color=${color.id}" title="${escapeHtml(color.name)}">
        ${swatch(color, "lg")}
        <span class="swatch-name">${escapeHtml(color.name)}</span>
        <span class="swatch-cat">${escapeHtml(color.category)}</span>
      </a>`,
    )
    .join("");

  const heroSlides = (IMAGES.heroSlides && IMAGES.heroSlides.length ? IMAGES.heroSlides : [IMAGES.hero]).map(
    (src, i) => `<img class="hero-slide${i === 0 ? " active" : ""}" src="${src}" alt="(CLIENT OWN) showcase ${i + 1}"${i ? ' loading="lazy"' : ""}>`
  ).join("");
  const heroDots = (IMAGES.heroSlides && IMAGES.heroSlides.length ? IMAGES.heroSlides : [IMAGES.hero]).map(
    (_, i) => `<button class="hero-dot${i === 0 ? " active" : ""}" data-hero-dot="${i}" aria-label="Image ${i + 1}"></button>`
  ).join("");
  return `
  <section class="hero">
    ${heroSlides}
    <div class="hero-dots" role="tablist" aria-label="Hero images">
      ${heroDots}
    </div>
    <div class="hero-overlay">
      <p class="eyebrow">Nationwide · mixed to order · low VOC</p>
      <h1>${escapeHtml(store.settings.tagline)}</h1>
      <p class="hero-sub">${escapeHtml(store.settings.blurb)}</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/shop">Shop the paint</a>
        <a class="btn btn-ghost" href="#/colours">Browse 18 colours</a>
      </div>
      <dl class="hero-stats">
        <div><dt>${counts.products}</dt><dd>paint systems</dd></div>
        <div><dt>${counts.product_variants}</dt><dd>colourways in stock</dd></div>
        <div><dt>${counts.orders}</dt><dd>orders shipped</dd></div>
        <div><dt>${counts.colors}</dt><dd>curated colours</dd></div>
      </dl>
    </div>
  </section>

  <section class="strip">
    ${[
      ["Free delivery over " + money(store.settings.freeShippingThreshold), "Delivered nationwide in 2–3 working days."],
      ["Low VOC, low odour", "Water-based formulas you can sleep next to the same evening."],
      ["Mixed to order", "Every tin is tinted in our workshop."],
      ["Trade accounts", `Invoicing and 30-day terms — call ${store.settings.phone}.`],
    ]
      .map(([title, copy]) => `<div><h4>${escapeHtml(title)}</h4><p>${escapeHtml(copy)}</p></div>`)
      .join("")}
  </section>

  <section class="band">
    <header class="band-head">
      <h2>Three paint systems, one colour library</h2>
      <p>Interior, exterior and masonry products are all mixed from the same 18 colours, so a scheme can run from the skirting boards to the garden wall.</p>
    </header>
    <div class="system-grid">${systemCards}</div>
  </section>

  <section class="band colour-band">
    <div class="colour-band-media"><img src="${IMAGES.colourDeck}" alt="Paint colour swatch deck"></div>
    <div class="colour-band-copy">
      <p class="eyebrow">The colour library</p>
      <h2>Eighteen colours, chosen so they work together</h2>
      <p>Neutrals that don't go grey, greens with grey in their bones, a navy that behaves, and warm clay tones for brick. Tap any colour to see which products it is mixed in.</p>
      <div class="swatch-grid">${swatches}</div>
      <a class="btn btn-outline" href="#/colours">Open the colour studio</a>
    </div>
  </section>

  <section class="band">
    <header class="band-head">
      <h2>What people are buying</h2>
      <p>Live from <code>public.products</code> — four of our ten paint systems, ordered by rating.</p>
    </header>
    <div class="product-grid">${featured.map(productCard).join("")}</div>
  </section>

  <section class="band split">
    <div class="split-media">
      <img src="${IMAGES.painter}" alt="Painter rolling paint onto a wall">
      <img src="${IMAGES.renovation}" alt="Room mid-repaint with ladders and drop cloths">
    </div>
    <div class="split-copy">
      <p class="eyebrow">The workshop</p>
      <h2>Handcrafted colour from (CLIENT OWN)</h2>
      <p>We mix every order by hand, colour-match to anything you bring us, and test each batch on primed board before it leaves the door.</p>
      <ul class="tick-list">
        <li>Colour matching from a photo, a chip or a cushion</li>
        <li>Sample pots posted the same day</li>
        <li>Trade pricing from 10 litres upwards</li>
      </ul>
      <div class="split-actions">
        <a class="btn btn-primary" href="#/shop">Start shopping</a>
        <a class="btn btn-ghost" href="#/orders">Track an order</a>
      </div>
    </div>
  </section>

  <section class="cta-band">
    <div>
      <h2>Need a whole house painted?</h2>
      <p>Our decorating team covers the whole country. Book a survey and we'll bring the colour deck.</p>
    </div>
    <div class="cta-actions">
      <a class="btn btn-primary" href="tel:${escapeHtml(store.settings.phone.replace(/[^\d+]/g, ""))}">Call ${escapeHtml(store.settings.phone)}</a>
      <a class="btn btn-ghost" href="mailto:${escapeHtml(store.settings.email)}">${escapeHtml(store.settings.email)}</a>
    </div>
  </section>`;
}

const SYSTEM_BLURB = {
  Interior: "Dense, wipeable emulsions for walls, ceilings, trim and cabinetry.",
  Exterior: "Flexible, UV-stable coatings for render, timber, doors and metalwork.",
  Masonry: "Breathable, dirt-shedding systems for brick, block and weathered render.",
};

// ---------------------------------------------------------------- components

function productCard(product) {
  const meta = productMeta(product.title);
  const colourways = colorsForProduct(product.id);
  const inStock = colourways.filter((entry) => entry.variant.stock_status !== "Out of Stock").length;
  return `<article class="product-card">
    <a class="product-media" href="#/product/${product.id}">
      ${tin(product, colourways[0]?.color, "5L")}
      ${meta.badge ? `<span class="badge">${escapeHtml(meta.badge)}</span>` : ""}
    </a>
    <div class="product-body">
      <div class="product-top">
        <span class="pill">${escapeHtml(product.paint_type)}</span>
        <span class="muted">${meta.reviews ? `★ ${meta.rating} (${meta.reviews})` : ""}</span>
      </div>
      <h3><a href="#/product/${product.id}">${escapeHtml(product.title)}</a></h3>
      <p class="product-desc">${escapeHtml((product.description || "").slice(0, 108))}…</p>
      <div class="colour-dots">${colourways.slice(0, 12).map((entry) => swatch(entry.color, "sm")).join("")}${
        colourways.length > 12 ? `<span class="muted">+${colourways.length - 12}</span>` : ""
      }</div>
      <div class="product-foot">
        <div>
          <span class="price">${money(product.base_price)}</span>
          <span class="muted">/ ${escapeHtml(product.size_options[product.size_options.length - 2] || product.size_options[0])}</span>
        </div>
        <span class="stock stock-${inStock ? "ok" : "bad"}">${inStock} of ${colourways.length} colourways</span>
      </div>
      <button class="btn btn-primary btn-block" data-action="quick-add" data-product="${product.id}">Add to basket</button>
    </div>
  </article>`;
}

function orderStatusPill(status) {
  const map = {
    Pending: "warn",
    Confirmed: "info",
    Processing: "info",
    Shipped: "info",
    Delivered: "ok",
    Cancelled: "bad",
    Paid: "ok",
    Failed: "bad",
    Refunded: "warn",
  };
  return `<span class="pill pill-${map[status] || ""}">${escapeHtml(status)}</span>`;
}

async function shopView(route) {
  const params = route.params;

  // Only re-apply URL parameters when the hash itself changed — otherwise a
  // filter click would be undone on the very next render by stale params.
  if (location.hash !== lastShopHash) {
    lastShopHash = location.hash;
    if (params.get("paint_type")) ui.filters.paintType = params.get("paint_type");
    if (params.has("color")) ui.filters.colorId = params.get("color") || null;
    if (params.has("q")) ui.filters.query = params.get("q") || "";
  }

  const products = await searchProducts(ui.filters);
  const color = ui.filters.colorId ? colorById(ui.filters.colorId) : null;

  return `
<section class="page-head">
  <h1>Shop paint</h1>
  <p class="muted">${store.products.length} paint systems · ${store.variants.length} colourways · every price mixes in our workshop</p>
</section>

<section class="shop">
  <aside class="filters">
    <form id="filterForm">
      <label class="filter-block">
        <span>Paint system</span>
        <div class="segmented">
          ${["All", ...PAINT_TYPES].map(
            (type) =>
              `<button type="button" class="${ui.filters.paintType === type ? "active" : ""}" data-action="filter" data-key="paintType" data-value="${type}">${type}</button>`
          ).join("")}
        </div>
      </label>

      <label class="filter-block">
        <span>Colour family</span>
        <select data-action="filter-select" data-key="category">
          ${["All", ...new Set(store.colors.map((entry) => entry.category))]
            .map(
              (category) =>
                `<option ${ui.filters.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="filter-block">
        <span>Tin size</span>
        <select data-action="filter-select" data-key="size">
          ${["", ...new Set(store.products.flatMap((product) => product.size_options))]
            .map(
              (size) =>
                `<option value="${escapeHtml(size)}" ${ui.filters.size === size ? "selected" : ""}>${size ? escapeHtml(size) : "Any size"}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="filter-block">
        <span>Finish</span>
        <select data-action="filter-select" data-key="finish">
          ${["", ...new Set(store.colors.flatMap((entry) => entry.finish_types))]
            .map(
              (finish) =>
                `<option value="${escapeHtml(finish)}" ${ui.filters.finish === finish ? "selected" : ""}>${finish ? escapeHtml(finish) : "Any finish"}</option>`
            )
            .join("")}
        </select>
      </label>

      <label class="filter-block">
        <span>Sort</span>
        <select data-action="filter-select" data-key="sort">
          ${[
            ["az", "A–Z"],
            ["price-asc", "Price: low to high"],
            ["price-desc", "Price: high to low"],
            ["newest", "Recently added"],
          ]
            .map(
              ([value, label]) =>
                `<option value="${value}" ${ui.filters.sort === value ? "selected" : ""}>${label}</option>`
            )
            .join("")}
        </select>
      </label>

      <button type="button" class="btn btn-outline btn-block" data-action="reset-filters">
        Reset filters
      </button>
    </form>

    ${
      color
        ? `<div class="active-colour">
            ${swatch(color, "lg")}
            <div>
              <strong>${escapeHtml(color.name)}</strong>
              <span class="muted">${escapeHtml(color.category)} · ${escapeHtml(color.finish_types.join(", "))}</span>
            </div>
            <button class="chip" data-action="clear-colour">clear</button>
          </div>`
        : ""
    }
  </aside>

  <div class="shop-main">
    <div class="shop-toolbar">
      <form class="search" id="searchForm">
        <input
          type="search"
          id="searchInput"
          placeholder="Search paint systems…"
          value="${escapeHtml(ui.filters.query)}"
        >
        <button class="btn btn-outline" type="submit">Search</button>
      </form>

      <div class="muted" id="resultCountEl">
        ${products.length} result${products.length === 1 ? "" : "s"}
      </div>
    </div>

    <div class="product-grid" id="gridEl">
      ${
        products.length
          ? products.map(productCard).join("")
          : `<p class="empty">
              Nothing matched those filters.
              <button class="link" data-action="reset-filters">Reset them?</button>
            </p>`
      }
    </div>

    <div class="query-note">
      <div>
        <strong>Backed by SQL.</strong>
        <span class="muted">This page just ran:</span>
      </div>
      <code>${escapeHtml(lastSql())}</code>
    </div>
  </div>
</section>`;
}

function lastSql() {
  const entry = queryLog().find((item) => item.table === "products" || item.table === "product_variants");
  return entry ? entry.sql : "select * from products;";
}

// ------------------------------------------------------------------ product

async function productView(route) {
  const product = productById(route.parts[1]);
  if (!product) return notFoundView();
  const meta = productMeta(product.title);
  const colourways = colorsForProduct(product.id);
  if (!ui.buy.colorId || !colourways.some((entry) => entry.color.id === ui.buy.colorId)) {
    ui.buy.colorId = colourways.find((entry) => entry.variant.stock_status !== "Out of Stock")?.color.id || colourways[0]?.color.id;
  }
  const selected = colourways.find((entry) => entry.color.id === ui.buy.colorId) || colourways[0];
  const color = selected?.color || null;
  if (!ui.buy.size || !product.size_options.includes(ui.buy.size)) ui.buy.size = product.size_options[Math.min(1, product.size_options.length - 1)];
  const finishes = color ? color.finish_types : [];
  if (!ui.buy.finish || !finishes.includes(ui.buy.finish)) ui.buy.finish = finishes[0];
  const unit = unitPriceFor(product, ui.buy.size);
  const variantRows = await store.db
    .from("product_variants")
    .select("*, colors(*)")
    .eq("product_id", product.id)
    .order("created_at");

  return `
  <nav class="crumbs"><a href="#/shop">Shop</a> <span>/</span> <a href="#/shop?paint_type=${product.paint_type}">${escapeHtml(product.paint_type)}</a> <span>/</span> <strong>${escapeHtml(product.title)}</strong></nav>

  <section class="product-detail">
    <div class="detail-media">
      ${tin(product, color, ui.buy.size)}
      <div class="detail-thumbs">
        ${colourways
          .slice(0, 8)
          .map(
            (entry) => `<button class="thumb" data-action="quick-colour" data-product="${product.id}" data-color="${entry.color.id}" style="background:${entry.color.hex_code}" title="${escapeHtml(entry.color.name)}"></button>`,
          )
          .join("")}
      </div>
    </div>

    <div class="detail-buy">
      <div class="pill-row">
        <span class="pill">${escapeHtml(product.paint_type)}</span>
        ${meta.badge ? `<span class="pill pill-ok">${escapeHtml(meta.badge)}</span>` : ""}
        <span class="muted">★ ${meta.rating} · ${meta.reviews} reviews · ${escapeHtml(meta.sku)}</span>
      </div>
      <h1>${escapeHtml(product.title)}</h1>
      <p class="lede">${escapeHtml(product.description || "")}</p>

      <div class="price-line">
        <span class="price-lg">${money(unit)}</span>
        <span class="muted">for ${escapeHtml(ui.buy.size)} <span class="hint">(price scales with tin size)</span></span>
        <span class="stock stock-${stockClass(selected?.variant.stock_status)}">${escapeHtml(selected?.variant.stock_status || "Out of Stock")}</span>
      </div>

      <div class="option-block">
        <div class="option-head"><span>Colour</span><strong>${escapeHtml(color?.name || "")}</strong></div>
        <div class="colour-grid">
          ${colourways
            .map(
              (entry) => `<button class="colour-choice ${entry.color.id === ui.buy.colorId ? "active" : ""} ${entry.variant.stock_status === "Out of Stock" ? "sold-out" : ""}"
                  data-action="choose-colour" data-color="${entry.color.id}" title="${escapeHtml(entry.color.name)} · ${escapeHtml(entry.variant.stock_status)}">
                  ${swatch(entry.color, "lg")}
                  <span>${escapeHtml(entry.color.name)}</span>
                </button>`,
            )
            .join("")}
        </div>
        <p class="muted small">${escapeHtml(color?.description || "")} · mixed in ${colourways.length} of our ${store.colors.length} colours for this product.</p>
      </div>

      <div class="option-block">
        <div class="option-head"><span>Tin size</span></div>
        <div class="pill-row">
          ${product.size_options
            .map(
              (size) => `<button class="size-choice ${size === ui.buy.size ? "active" : ""}" data-action="choose-size" data-size="${escapeHtml(size)}">
                <b>${escapeHtml(size)}</b><span>${money(unitPriceFor(product, size))}</span></button>`,
            )
            .join("")}
        </div>
      </div>

      <div class="option-block">
        <div class="option-head"><span>Finish</span></div>
        <div class="pill-row">
          ${finishes
            .map((finish) => `<button class="finish-choice ${finish === ui.buy.finish ? "active" : ""}" data-action="choose-finish" data-finish="${escapeHtml(finish)}">${escapeHtml(finish)}</button>`)
            .join("")}
        </div>
      </div>

      <div class="buy-row">
        <div class="stepper">
          <button data-action="buy-qty" data-delta="-1" aria-label="Decrease quantity">−</button>
          <span>${ui.buy.quantity}</span>
          <button data-action="buy-qty" data-delta="1" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn-primary btn-lg" data-action="add-to-basket" ${selected?.variant.stock_status === "Out of Stock" ? "disabled" : ""}>
          Add to basket · ${money(unit * ui.buy.quantity)}
        </button>
      </div>
      ${
        selected?.variant.stock_status === "Out of Stock"
          ? `<p class="stock stock-bad">This colourway is sold out — pick another colour, or <a href="#/colours">browse the library</a>.</p>`
          : ""
      }

      <ul class="assurance">
        <li>Free delivery over ${money(store.settings.freeShippingThreshold)} · otherwise ${money(store.settings.shippingFlat)}</li>
        <li>Dispatched within one working day</li>
        <li>${escapeHtml(meta.coverage)} · recoat in ${escapeHtml(meta.recoat)} · ${escapeHtml(meta.coats)} coats</li>
      </ul>
    </div>
  </section>

  <section class="band detail-specs">
    <div>
      <h2>How it goes on</h2>
      <table class="spec-table">
        <tbody>
          ${[
            ["Coverage", meta.coverage],
            ["Recoat time", meta.recoat],
            ["Recommended coats", meta.coats],
            ["Finish range", finishes.join(", ")],
            ["Volatile organic compounds", meta.voc],
            ["SKU", meta.sku],
          ]
            .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || "")}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
    <div>
      <h2>Every colourway in stock</h2>
      <p class="muted small">Straight from <code>public.product_variants</code> joined to <code>public.colors</code> — ${variantRows.data?.length || 0} rows for this product.</p>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Colour</th><th>Hex</th><th>Finish options</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            ${(variantRows.data || [])
              .map(
                (row) => `<tr>
                  <td><span class="inline-swatch" style="background:${escapeHtml(row.colors?.hex_code || "#eee")}"></span>${escapeHtml(row.colors?.name || "—")}</td>
                  <td><code>${escapeHtml(row.colors?.hex_code || "")}</code></td>
                  <td>${escapeHtml((row.colors?.finish_types || []).join(", "))}</td>
                  <td>${orderStatusPill(row.stock_status)}</td>
                  <td><button class="chip" data-action="quick-colour" data-product="${product.id}" data-color="${row.color_id}">select</button></td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="band">
    <header class="band-head"><h2>Pairs well with</h2><p>Other systems from the same colour library.</p></header>
    <div class="product-grid">${store.products
      .filter((candidate) => candidate.id !== product.id)
      .slice(0, 3)
      .map(productCard)
      .join("")}</div>
  </section>`;
}

// ------------------------------------------------------------------ colours

async function coloursView() {
  const categories = [...new Set(store.colors.map((color) => color.category))];
  const usageByColor = new Map();
  for (const variant of store.variants) {
    if (!usageByColor.has(variant.color_id)) usageByColor.set(variant.color_id, []);
    const product = productById(variant.product_id);
    if (product && variant.stock_status !== "Out of Stock") usageByColor.get(variant.color_id).push(product.title);
  }
  return `
  <section class="page-head">
    <h1>The colour studio</h1>
    <p class="muted">${store.colors.length} colours · ${store.variants.length} colourways · every one mixed by hand</p>
  </section>
  <section class="band colour-studio">
    <div class="studio-hero">
      <img src="${IMAGES.colourDeck}" alt="Paint colour cards fanned out">
      <div>
        <h2>Not sure? Start with the swatch deck.</h2>
        <p>Order a sample pot to test the colour in your own light, then browse the full library below.</p>
        <a class="btn btn-primary" href="#/shop">Browse paints</a>
      </div>
    </div>
  </section>

  ${categories
    .map(
      (category) => `
  <section class="band colour-category">
    <header class="band-head">
      <h2>${escapeHtml(category)}</h2>
      <p>${store.colors.filter((color) => color.category === category).length} colours to explore.</p>
    </header>
    <div class="colour-grid">
      ${store.colors
        .filter((color) => color.category === category)
        .map(
          (color) => `<article class="colour-card">
            <div class="colour-card-swatch" style="background:${escapeHtml(color.hex_code)}"></div>
            <div class="colour-card-body">
              <h3>${escapeHtml(color.name)}</h3>
              <p class="muted small">${escapeHtml(color.hex_code)} · ${escapeHtml((usageByColor.get(color.id) || []).join(", ") || "Available across the library")}</p>
              <a class="link" href="#/shop?color=${color.id}">Shop this colour</a>
            </div>
          </article>`,
        )
        .join("")}
    </div>
  </section>`
    )
    .join("")}
  `;
}

// ------------------------------------------------------------------- basket

// The cart shape lives in store.js; these helpers accept either hydrated
// objects or bare ids so the views keep working whichever way it hands back.
function normaliseLine(line, index) {
  const product = line.product || productById(line.product_id ?? line.productId) || null;
  const color = line.color || colorById(line.color_id ?? line.colorId) || null;
  const size = line.size || (product ? product.size_options[0] : "");
  const finish = line.finish || (color ? color.finish_types[0] : "");
  const quantity = Number(line.quantity ?? line.qty ?? 1);
  const unit = Number(line.unit_price ?? line.unitPrice ?? (product ? unitPriceFor(product, size) : 0));
  const key = line.key ?? line.id ?? line.cart_item_id ?? String(index);
  return { product, color, size, finish, quantity, unit, key };
}

function normaliseTotals(totals, lines) {
  const subtotal = Number(totals?.subtotal ?? lines.reduce((sum, line) => sum + line.unit * line.quantity, 0));
  const shipping = Number(
    totals?.shipping ??
      totals?.shipping_amount ??
      (subtotal >= store.settings.freeShippingThreshold ? 0 : store.settings.shippingFlat),
  );
  const tax = Number(totals?.tax ?? totals?.tax_amount ?? 0);
  const total = Number(totals?.total ?? totals?.total_amount ?? subtotal + shipping + tax);
  return { subtotal, shipping, tax, total };
}

async function basketView() {
  const raw = (await cartLines()) || [];
  const lines = raw.map(normaliseLine);
  const totals = normaliseTotals(await cartTotals(lines), lines);

  if (!lines.length) {
    return `
    <section class="page-head">
      <h1>Your basket</h1>
      <p class="muted">Nothing mixed yet.</p>
    </section>
    <section class="band">
      <p class="empty">Your basket is empty. <a class="link" href="#/shop">Browse the paint?</a></p>
    </section>`;
  }

  return `
  <section class="page-head">
    <h1>Your basket</h1>
    <p class="muted">${lines.length} line${lines.length === 1 ? "" : "s"} · tinted in the workshop after you order</p>
  </section>

  <section class="band basket">
    <div class="table-scroll">
      <table class="data-table basket-table">
        <thead>
          <tr><th>Paint</th><th>Colour</th><th>Size</th><th>Finish</th><th>Qty</th><th>Line</th><th></th></tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line) => `<tr>
                <td>
                  <a href="#/product/${escapeHtml(line.product?.id || "")}">${escapeHtml(line.product?.title || "Unknown product")}</a>
                </td>
                <td>${line.color ? `${swatch(line.color, "sm")} ${escapeHtml(line.color.name)}` : "—"}</td>
                <td>${escapeHtml(line.size)}</td>
                <td>${escapeHtml(line.finish)}</td>
                <td>
                  <div class="stepper stepper-sm">
                    <button data-action="cart-qty" data-key="${escapeHtml(line.key)}" data-delta="-1" aria-label="Decrease">−</button>
                    <span>${line.quantity}</span>
                    <button data-action="cart-qty" data-key="${escapeHtml(line.key)}" data-delta="1" aria-label="Increase">+</button>
                  </div>
                </td>
                <td>${money(line.unit * line.quantity)}</td>
                <td><button class="chip" data-action="cart-remove" data-key="${escapeHtml(line.key)}">remove</button></td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <aside class="summary">
      <h2>Summary</h2>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(totals.subtotal)}</dd></div>
        <div><dt>Delivery</dt><dd>${totals.shipping ? money(totals.shipping) : "Free"}</dd></div>
        ${totals.tax ? `<div><dt>Tax</dt><dd>${money(totals.tax)}</dd></div>` : ""}
        <div class="grand"><dt>Total</dt><dd>${money(totals.total)}</dd></div>
      </dl>
      <a class="btn btn-primary btn-block" href="#/checkout">Checkout</a>
      <a class="btn btn-ghost btn-block" href="#/shop">Keep shopping</a>
      ${
        totals.shipping
          ? `<p class="muted small">Spend ${money(store.settings.freeShippingThreshold - totals.subtotal)} more for free delivery.</p>`
          : `<p class="muted small">Free delivery unlocked.</p>`
      }
    </aside>
  </section>`;
}

// ----------------------------------------------------------------- checkout

async function checkoutView() {
  const raw = (await cartLines()) || [];
  const lines = raw.map(normaliseLine);
  const totals = normaliseTotals(await cartTotals(lines), lines);

  if (!lines.length) {
    return `
    <section class="page-head"><h1>Checkout</h1><p class="muted">There is nothing to check out.</p></section>
    <section class="band"><p class="empty">Your basket is empty. <a class="link" href="#/shop">Browse the paint?</a></p></section>`;
  }

  const profile = store.profile || {};

  return `
  <section class="page-head">
    <h1>Checkout</h1>
    <p class="muted">${lines.length} line${lines.length === 1 ? "" : "s"} · ${money(totals.total)} due</p>
  </section>

  <section class="band checkout">
    <form id="checkoutForm" class="checkout-form">
      <fieldset>
        <legend>Delivery details</legend>
        <label>Full name<input name="customer_name" required value="${escapeHtml(profile.displayName || "")}"></label>
        <label>Email<input name="customer_email" type="email" required value="${escapeHtml(profile.email || "")}"></label>
        <label>Phone<input name="customer_phone" required></label>
        <label class="wide">Address<textarea name="shipping_address" rows="3" required></textarea></label>
        <label>City<input name="shipping_city" required></label>
        <label>State<input name="shipping_state" required></label>
      </fieldset>

      <fieldset>
        <legend>Payment</legend>
        <label class="wide">
          Method
          <select name="payment_method">
            <option value="Card">Card</option>
            <option value="Transfer">Bank transfer</option>
            <option value="Cash on delivery">Cash on delivery</option>
          </select>
        </label>
        <label class="wide">Order notes<textarea name="notes" rows="2" placeholder="Gate code, preferred delivery window…"></textarea></label>
      </fieldset>

      <button class="btn btn-primary btn-lg btn-block" type="submit" ${ui.busy ? "disabled" : ""}>
        Place order · ${money(totals.total)}
      </button>
    </form>

    <aside class="summary">
      <h2>Your order</h2>
      <ul class="summary-lines">
        ${lines
          .map(
            (line) => `<li>
              <span>${line.quantity} × ${escapeHtml(line.product?.title || "Paint")} · ${escapeHtml(line.color?.name || "")} · ${escapeHtml(line.size)}</span>
              <span>${money(line.unit * line.quantity)}</span>
            </li>`,
          )
          .join("")}
      </ul>
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(totals.subtotal)}</dd></div>
        <div><dt>Delivery</dt><dd>${totals.shipping ? money(totals.shipping) : "Free"}</dd></div>
        <div class="grand"><dt>Total</dt><dd>${money(totals.total)}</dd></div>
      </dl>
    </aside>
  </section>`;
}

// ------------------------------------------------------------------- orders

async function ordersView() {
  const orders = (await listOrders()) || [];

  return `
  <section class="page-head">
    <h1>Your orders</h1>
    <p class="muted">${orders.length} order${orders.length === 1 ? "" : "s"} · track, reorder or cancel</p>
  </section>

  <section class="band">
    ${
      orders.length
        ? `<div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Order</th><th>Placed</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr></thead>
              <tbody>
                ${orders
                  .map(
                    (order) => `<tr>
                      <td><a href="#/orders/${escapeHtml(order.id)}"><code>${escapeHtml(String(order.id).slice(0, 8))}</code></a></td>
                      <td>${escapeHtml(order.created_at ? shortDate(order.created_at) : "—")}</td>
                      <td>${escapeHtml(String(order.item_count ?? order.items?.length ?? "—"))}</td>
                      <td>${money(order.total_amount ?? order.total ?? 0)}</td>
                      <td>${orderStatusPill(order.status)}</td>
                      <td>${orderStatusPill(order.payment_status)}</td>
                      <td>
                        <button class="chip" data-action="reorder" data-order="${escapeHtml(order.id)}">reorder</button>
                      </td>
                    </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        : `<p class="empty">No orders yet. <a class="link" href="#/shop">Start shopping?</a></p>`
    }
  </section>`;
}

async function orderView(route) {
  const order = await getOrder(route.parts[1]);
  if (!order) return notFoundView();

  const steps = (orderTimeline(order) || []).map((step) => {
    if (typeof step === "string") return { label: step, at: null, done: true };
    const at = step.at || step.created_at || step.timestamp || null;
    return {
      label: step.label || step.step || step.status || step.title || "Update",
      at,
      done: step.done ?? step.complete ?? (step.state ? step.state === "done" || step.state === "current" : Boolean(at)),
    };
  });

  const items = order.items || order.order_items || [];

  return `
  <nav class="crumbs"><a href="#/orders">Orders</a> <span>/</span> <strong>${escapeHtml(String(order.id).slice(0, 8))}</strong></nav>

  <section class="page-head">
    <h1>Order ${escapeHtml(String(order.id).slice(0, 8))}</h1>
    <div class="pill-row">
      ${orderStatusPill(order.status)}
      ${orderStatusPill(order.payment_status)}
      <span class="muted">Placed ${escapeHtml(order.created_at ? dateTime(order.created_at) : "—")}</span>
    </div>
  </section>

  <section class="band order-detail">
    <div>
      <h2>Items</h2>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Paint</th><th>Colour</th><th>Size</th><th>Qty</th><th>Line</th></tr></thead>
          <tbody>
            ${items
              .map(
                (item) => `<tr>
                  <td>${escapeHtml(item.title || item.product_title || productById(item.product_id)?.title || "Paint")}</td>
                  <td>${escapeHtml(item.color_name || colorById(item.color_id)?.name || "—")}</td>
                  <td>${escapeHtml(item.size || "—")}</td>
                  <td>${escapeHtml(String(item.quantity ?? 1))}</td>
                  <td>${money(item.line_total ?? (item.unit_price ?? 0) * (item.quantity ?? 1))}</td>
                </tr>`,
              )
              .join("") || `<tr><td colspan="5" class="muted">No line items recorded.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <aside class="summary">
      <h2>Summary</h2>
      <dl class="totals">
        <div><dt>Total</dt><dd>${money(order.total_amount ?? order.total ?? 0)}</dd></div>
      </dl>
      <div class="split-actions">
        <button class="btn btn-outline btn-block" data-action="reorder" data-order="${escapeHtml(order.id)}">Reorder</button>
        ${
          ["Pending", "Confirmed", "Processing"].includes(order.status)
            ? `<button class="btn btn-ghost btn-block" data-action="cancel-order" data-order="${escapeHtml(order.id)}">Cancel order</button>`
            : ""
        }
        ${
          order.payment_status !== "Paid"
            ? `<button class="btn btn-primary btn-block" data-action="pay-order" data-order="${escapeHtml(order.id)}">Mark as paid</button>`
            : ""
        }
      </div>
    </aside>
  </section>

  <section class="band">
    <header class="band-head"><h2>Timeline</h2><p>Every status change on this order.</p></header>
    <ol class="timeline">
      ${steps
        .map(
          (step) => `<li class="${step.done ? "done" : ""}">
            <span class="dot"></span>
            <div>
              <strong>${escapeHtml(step.label)}</strong>
              ${step.at ? `<span class="muted">${escapeHtml(dateTime(step.at))}</span>` : ""}
            </div>
          </li>`,
        )
        .join("") || `<li class="muted">No timeline entries yet.</li>`}
    </ol>
  </section>`;
}

// ------------------------------------------------------------------ account

async function accountView() {
  const profile = store.profile || {};
  const remote = typeof isRemoteBackend === "function" ? isRemoteBackend() : false;
  let connection = ui.connect;
  if (!connection) {
    if (!remote) {
      connection = ui.connect = { ok: true, detail: "Local in-browser database — no Supabase project connected." };
    } else {
      try {
        connection = ui.connect = { ok: true, detail: "Supabase backend connected." };
      } catch (error) {
        connection = ui.connect = { ok: false, detail: error?.message || String(error) };
      }
    }
  }

  return `
  <section class="page-head">
    <h1>Account</h1>
    <p class="muted">${escapeHtml(profile.displayName || "Guest")} · ${escapeHtml(store.persistence || "local")} persistence</p>
  </section>

  <section class="band split">
    <div class="split-copy">
      <h2>Who you are</h2>
      <table class="spec-table">
        <tbody>
          <tr><th>Name</th><td>${escapeHtml(profile.displayName || "Guest")}</td></tr>
          <tr><th>Email</th><td>${escapeHtml(profile.email || "—")}</td></tr>
          <tr><th>Anonymous</th><td>${profile.isAnonymous ? "Yes" : "No"}</td></tr>
          <tr><th>Backend</th><td>${escapeHtml(store.backend || "local")}${remote ? " (remote)" : ""}</td></tr>
        </tbody>
      </table>
      <div class="split-actions">
        <a class="btn btn-primary" href="#/orders">Your orders</a>
        <a class="btn btn-ghost" href="#/basket">Your basket</a>
      </div>
    </div>

    <div class="split-copy">
      <h2>Demo account</h2>
      <p class="muted small">Use these details to explore the shop without signing up.</p>
      <table class="spec-table">
        <tbody>
          <tr><th>Email</th><td><code>${escapeHtml(DEMO_ACCOUNT?.email || "demo@(CLIENT OWN).test")}</code></td></tr>
          <tr><th>Password</th><td><code>${escapeHtml(DEMO_ACCOUNT?.password || "demo")}</code></td></tr>
        </tbody>
      </table>
      <h2>Connection</h2>
      <p class="${connection.ok ? "stock stock-ok" : "stock stock-bad"}">
        ${connection.ok ? "Supabase reachable" : "Supabase unavailable"}
      </p>
      <p class="muted small">${escapeHtml(typeof connection.detail === "string" ? connection.detail : JSON.stringify(connection.detail))}</p>
    </div>
  </section>`;
}

// -------------------------------------------------------------------- admin

const columnName = (column) =>
  typeof column === "string" ? column : column.name || column.column_name || String(column);

async function adminView() {
  const stats = (await databaseStats()) || [];
  const tables = TABLES ? (Array.isArray(TABLES) ? TABLES : Object.keys(TABLES)) : [];
  const tableNames = tables.map((table) => (typeof table === "string" ? table : table.name || table.key)).filter(Boolean);

  let info = null;
  try {
    info = await tableInfo(ui.adminTable);
  } catch (error) {
    info = { error };
  }

  const columns = (info?.columns || info?.fields || []).map(columnName);
  const rows = info?.rows || info?.data || [];

  return `
  <section class="page-head">
    <h1>Database console</h1>
    <p class="muted">${escapeHtml(store.backend || "local")} · ${escapeHtml(store.persistence || "")} · ${escapeHtml(store.backend === "local" ? "in-browser Postgres" : "remote")}</p>
  </section>

  <section class="band">
    <header class="band-head"><h2>Row counts</h2><p>Live from every table in the shop schema.</p></header>
    <dl class="hero-stats admin-stats">
      ${stats
        .map((table) => `<div><dt>${escapeHtml(String(table.rows ?? "—"))}</dt><dd>${escapeHtml(table.label || table.key || "")}</dd></div>`)
        .join("")}
    </dl>
    <div class="split-actions">
      <button class="btn btn-outline" data-action="refresh-catalog">Refresh catalog</button>
      <button class="btn btn-outline" data-action="load-demo-orders">Load demo orders</button>
      <button class="btn btn-ghost" data-action="reseed">Reseed database</button>
      <a class="btn btn-primary" href="#/sql">Open SQL console</a>
    </div>
  </section>

  <section class="band">
    <header class="band-head">
      <h2>Inspect a table</h2>
      <p>Read-only preview of the rows behind the storefront.</p>
    </header>

    <label class="filter-block">
      <span>Table</span>
      <select data-action="admin-table">
        ${tableNames
          .map((name) => `<option value="${escapeHtml(name)}" ${ui.adminTable === name ? "selected" : ""}>${escapeHtml(name)}</option>`)
          .join("")}
      </select>
    </label>

    ${
      info?.error
        ? `<p class="stock stock-bad">${pgErrorMarkup(info.error)}</p>`
        : `<div class="table-scroll">
            <table class="data-table">
              <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
              <tbody>
                ${rows
                  .slice(0, 50)
                  .map(
                    (row) => `<tr>${columns
                      .map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`)
                      .join("")}</tr>`,
                  )
                  .join("") || `<tr><td class="muted" colspan="${Math.max(columns.length, 1)}">No rows.</td></tr>`}
              </tbody>
            </table>
          </div>
          <p class="muted small">Showing ${Math.min(rows.length, 50)} of ${rows.length} rows.</p>
          <button class="btn btn-ghost" data-action="truncate" data-table="${escapeHtml(ui.adminTable)}">
            Truncate ${escapeHtml(ui.adminTable)}
          </button>`
    }
  </section>`;
}

function formatCell(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// -------------------------------------------------------------- sql console

async function sqlView() {
  const result = ui.sql.result;
  const rows = result?.rows || result?.data || [];
  const columns = result?.fields || result?.columns || (rows[0] ? Object.keys(rows[0]) : []);
  const error = result?.error;

  return `
  <section class="page-head">
    <h1>SQL console</h1>
    <p class="muted">Run read-only queries against <code>public.*</code> as the ${escapeHtml(ui.sql.role)} role.</p>
  </section>

  <section class="band">
    <form id="sqlForm">
      <label class="filter-block">
        <span>Query</span>
        <textarea name="sql" id="sqlInput" rows="6" spellcheck="false">${escapeHtml(ui.sql.text)}</textarea>
      </label>

      <div class="split-actions">
        <label class="filter-block">
          <span>Role</span>
          <select data-action="sql-role">
            ${["client", "admin"]
              .map((role) => `<option value="${role}" ${ui.sql.role === role ? "selected" : ""}>${role}</option>`)
              .join("")}
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Run query</button>
        <button class="btn btn-ghost" type="button" data-action="clear-sql">Clear</button>
      </div>
    </form>

    <div class="samples">
      <span class="muted small">Samples:</span>
      ${SAMPLES.map(
        (sample) => `<button class="chip" data-action="use-sample" data-sql="${escapeHtml(sample.sql)}">${escapeHtml(sample.label)}</button>`,
      ).join("")}
    </div>
  </section>

  <section class="band">
    <header class="band-head">
      <h2>Result</h2>
      <p class="muted">${
        error ? "The query failed." : result ? `${rows.length} row${rows.length === 1 ? "" : "s"} returned.` : "Nothing run yet."
      }</p>
    </header>

    ${
      error
        ? `<p class="stock stock-bad">${pgErrorMarkup(error)}</p>`
        : rows.length
          ? `<div class="table-scroll">
              <table class="data-table">
                <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
                <tbody>
                  ${rows
                    .slice(0, 200)
                    .map(
                      (row) => `<tr>${columns
                        .map((column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`)
                        .join("")}</tr>`,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : `<p class="muted pad">No rows to show.</p>`
    }
  </section>`;
}

// ------------------------------------------------------------------- views

function notFoundView() {
  return `
  <section class="page-head">
    <h1>Nothing here</h1>
    <p class="muted">That page doesn't exist — or the paint has been discontinued.</p>
  </section>
  <section class="band">
    <p class="empty">
      Try the <a class="link" href="#/shop">shop</a>,
      the <a class="link" href="#/colours">colour studio</a>,
      or <a class="link" href="#/">home</a>.
    </p>
  </section>`;
}

const VIEWS = {
  home: homeView,
  shop: shopView,
  products: shopView,
  product: productView,
  colours: coloursView,
  basket: basketView,
  cart: basketView,
  checkout: checkoutView,
  orders: ordersView,
  order: orderView,
  account: accountView,
  admin: adminView,
  sql: sqlView,
  notfound: notFoundView,
};

// ------------------------------------------------------------------- events

async function addSelectionToBasket() {
  if (ui.route.name !== "product") return;
  const product = productById(ui.route.parts[1]);
  if (!product) return;
  const color = colorById(ui.buy.colorId);
  if (!color) return reportError("Pick a colour", new Error("No colour selected."));

  try {
    const { error } = await addToCart({
      variantId: variantFor(product.id, color.id)?.id,
      productId: product.id,
      colorId: color.id,
      size: ui.buy.size,
      finish: ui.buy.finish,
      quantity: ui.buy.quantity,
    });
    if (error) throw error;
    toast(`Added <b>${escapeHtml(product.title)}</b> in ${escapeHtml(color.name)} · ${escapeHtml(ui.buy.size)}.`);
    ui.buy.quantity = 1;
    await syncChrome();
  } catch (error) {
    reportError("Could not add to basket", error);
  }
}

async function quickAdd(productId) {
  const product = productById(productId);
  if (!product) return;
  const colourways = colorsForProduct(productId);
  const entry = colourways.find((item) => item.variant.stock_status !== "Out of Stock") || colourways[0];
  if (!entry) return reportError("No colourways", new Error("This product has no colours."));

  const size = product.size_options[Math.min(1, product.size_options.length - 1)] || product.size_options[0];
  const finish = entry.color.finish_types[0];

  try {
    const { error } = await addToCart({ variantId: entry.variant.id, productId, colorId: entry.color.id, size, finish, quantity: 1 });
    if (error) throw error;
    toast(`Added <b>${escapeHtml(product.title)}</b> in ${escapeHtml(entry.color.name)}.`);
    await syncChrome();
  } catch (error) {
    reportError("Could not add to basket", error);
  }
}

async function runQuery() {
  const input = document.getElementById("sqlInput");
  if (input) ui.sql.text = input.value;
  ui.busy = true;
  try {
    ui.sql.result = await runSql(ui.sql.text, ui.sql.role);
  } catch (error) {
    ui.sql.result = { error };
    reportError("Query failed", error);
  } finally {
    ui.busy = false;
  }
  await render();
}

document.addEventListener("click", async (event) => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled) return;

  const { action } = el.dataset;

  switch (action) {
    case "close-log":
      ui.logOpen = false;
      queryLogPanelEl.hidden = true;
      return;

    case "sql-from-log":
      ui.sql.text = el.dataset.sql || ui.sql.text;
      location.hash = "#/sql";
      return;

    case "filter":
      ui.filters[el.dataset.key] = el.dataset.value;
      break;

    case "reset-filters": {
      ui.filters = { paintType: "All", category: "All", size: "", finish: "", query: "", sort: "az", colorId: null };
      lastShopHash = null;
      if (location.hash && location.hash !== "#/shop") {
        location.hash = "#/shop";
        return;
      }
      break;
    }

    case "clear-colour":
      ui.filters.colorId = null;
      break;

    case "quick-add":
      await quickAdd(el.dataset.product);
      return;

    case "quick-colour":
      ui.buy.colorId = el.dataset.color;
      if (ui.route.name !== "product") {
        location.hash = `#/product/${el.dataset.product}`;
        return;
      }
      break;

    case "choose-colour":
      ui.buy.colorId = el.dataset.color;
      ui.buy.finish = null; // finishes depend on the colour
      break;

    case "choose-size":
      ui.buy.size = el.dataset.size;
      break;

    case "choose-finish":
      ui.buy.finish = el.dataset.finish;
      break;

    case "buy-qty":
      ui.buy.quantity = Math.min(99, Math.max(1, ui.buy.quantity + Number(el.dataset.delta)));
      break;

    case "add-to-basket":
      await addSelectionToBasket();
      return;

    case "cart-qty": {
      const lines = ((await cartLines()) || []).map(normaliseLine);
      const line = lines.find((item) => String(item.key) === String(el.dataset.key));
      if (!line) return;
      const quantity = Math.min(99, Math.max(0, line.quantity + Number(el.dataset.delta)));
      try {
        if (quantity === 0) await removeCartItem(line.key);
        else await setCartQuantity(line.key, quantity);
        await syncChrome();
      } catch (error) {
        reportError("Could not update the basket", error);
      }
      break;
    }

    case "cart-remove":
      try {
        await removeCartItem(el.dataset.key);
        await syncChrome();
      } catch (error) {
        reportError("Could not remove the item", error);
      }
      break;

    case "reorder":
      try {
        await reorder(el.dataset.order);
        toast("Items added back to your basket.");
        location.hash = "#/basket";
        return;
      } catch (error) {
        reportError("Could not reorder", error);
      }
      break;

    case "cancel-order":
      try {
        await advanceOrderStatus(el.dataset.order, "Cancelled");
        toast("Order cancelled.");
      } catch (error) {
        reportError("Could not cancel the order", error);
      }
      break;

    case "pay-order":
      try {
        await setPaymentStatus(el.dataset.order, "Paid");
        toast("Payment recorded.");
      } catch (error) {
        reportError("Could not update payment", error);
      }
      break;

    case "refresh-catalog":
      try {
        await refreshCatalog();
        toast("Catalog refreshed.");
      } catch (error) {
        reportError("Could not refresh the catalog", error);
      }
      break;

    case "load-demo-orders":
      try {
        await loadDemoOrders();
        toast("Demo orders loaded.");
      } catch (error) {
        reportError("Could not load demo orders", error);
      }
      break;

    case "reseed":
      if (!confirm("Reseed the database? Every local change will be lost.")) return;
      try {
        await reseedDatabase();
        ui.connect = null;
        toast("Database reseeded.");
      } catch (error) {
        reportError("Could not reseed", error);
      }
      break;

    case "truncate":
      if (!confirm(`Delete every row in ${el.dataset.table}?`)) return;
      try {
        await truncateTable(el.dataset.table);
        toast(`${el.dataset.table} emptied.`);
      } catch (error) {
        reportError("Could not truncate", error);
      }
      break;

    case "use-sample":
      ui.sql.text = el.dataset.sql || ui.sql.text;
      break;

    case "clear-sql":
      ui.sql.text = "";
      ui.sql.result = null;
      break;

    default:
      return;
  }

  await render();
});

document.addEventListener("change", async (event) => {
  const filter = event.target.closest("[data-action='filter-select']");
  if (filter) {
    ui.filters[filter.dataset.key] = filter.value;
    await render();
    return;
  }

  const adminTable = event.target.closest("[data-action='admin-table']");
  if (adminTable) {
    ui.adminTable = adminTable.value;
    await render();
    return;
  }

  const role = event.target.closest("[data-action='sql-role']");
  if (role) {
    ui.sql.role = role.value;
    await render();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;

  if (form.id === "searchForm") {
    event.preventDefault();
    ui.filters.query = (document.getElementById("searchInput")?.value || "").trim();
    await render();
    return;
  }

  if (form.id === "sqlForm") {
    event.preventDefault();
    await runQuery();
    return;
  }

  if (form.id === "checkoutForm") {
    event.preventDefault();
    if (ui.busy) return;
    ui.busy = true;
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;

    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await placeOrder(payload);
      const order = result?.data || result;
      ui.busy = false;
      toast("Order placed — thank you.");
      await syncChrome();
      location.hash = order?.id ? `#/orders/${order.id}` : "#/orders";
      return;
    } catch (error) {
      ui.busy = false;
      if (submit) submit.disabled = false;
      reportError("Could not place the order", error);
      return;
    }
  }
});

accountBtnEl.addEventListener("click", () => {
  location.hash = "#/account";
});

queryLogBtnEl.addEventListener("click", () => {
  ui.logOpen = !ui.logOpen;
  queryLogPanelEl.hidden = !ui.logOpen;
  if (ui.logOpen) renderQueryLog();
});

window.addEventListener("hashchange", () => {
  render();
});

// --------------------------------------------------------------------- boot

async function init() {
  appEl.innerHTML = bootScreen();
  try {
    await bootstrap();
  } catch (error) {
    appEl.innerHTML = `<div class="boot">
      <p>Could not start the storefront.</p>
      <code>${escapeHtml(error?.message || String(error))}</code>
    </div>`;
    return;
  }
  await render();
}

init();