// JavaScript mirror of src/schema.sql.
// Every table, column, default, check constraint, foreign key and index declared
// in the SQL file is described here, and src/db.js enforces them exactly like
// Postgres would. If you change src/schema.sql, change this file to match.

const HEX_CODE = /^#[0-9A-Fa-f]{6}$/;

export const TABLES = {
  users: {
    key: "users",
    label: "auth.users",
    schema: "auth",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      email: { type: "text", notNull: true },
      encrypted_password: { type: "text", notNull: true },
      display_name: { type: "text" },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
      last_sign_in_at: { type: "timestamptz" },
    },
    constraints: [],
    indexes: [{ name: "users_email_key", columns: ["email"], unique: true }],
    rls: { select: "own", insert: "service", update: "own", delete: "own", ownerColumn: "id" },
  },

  colors: {
    key: "colors",
    label: "public.colors",
    schema: "public",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      name: { type: "text", notNull: true },
      hex_code: { type: "text", notNull: true },
      category: { type: "text", notNull: true },
      description: { type: "text" },
      finish_types: { type: "text[]", notNull: true, default: [] },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
    },
    constraints: [
      {
        name: "colors_hex_code_format",
        definition: "check (hex_code ~ '^#[0-9A-Fa-f]{6}$')",
        test: (r) => HEX_CODE.test(r.hex_code),
      },
    ],
    indexes: [],
    rls: { select: "public", insert: "service", update: "service", delete: "service" },
  },

  products: {
    key: "products",
    label: "public.products",
    schema: "public",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      title: { type: "text", notNull: true },
      base_price: { type: "numeric", notNull: true },
      paint_type: { type: "text", notNull: true },
      size_options: { type: "text[]", notNull: true, default: [] },
      description: { type: "text" },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
      updated_at: { type: "timestamptz", notNull: true, default: "now()" },
    },
    constraints: [
      {
        name: "products_price_positive",
        definition: "check (base_price >= 0)",
        test: (r) => Number(r.base_price) >= 0,
      },
      {
        name: "products_paint_type",
        definition: "check (paint_type in ('Interior', 'Exterior', 'Masonry'))",
        test: (r) => ["Interior", "Exterior", "Masonry"].includes(r.paint_type),
      },
    ],
    indexes: [],
    rls: { select: "public", insert: "service", update: "service", delete: "service" },
  },

  product_variants: {
    key: "product_variants",
    label: "public.product_variants",
    schema: "public",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      product_id: {
        type: "uuid",
        notNull: true,
        references: { table: "products", column: "id", onDelete: "cascade" },
      },
      color_id: {
        type: "uuid",
        notNull: true,
        references: { table: "colors", column: "id", onDelete: "restrict" },
      },
      stock_status: { type: "text", notNull: true, default: "In Stock" },
      image_url: { type: "text" },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
    },
    constraints: [
      {
        name: "product_variants_stock_status",
        definition: "check (stock_status in ('In Stock', 'Out of Stock', 'Low Stock'))",
        test: (r) => ["In Stock", "Out of Stock", "Low Stock"].includes(r.stock_status),
      },
    ],
    indexes: [
      { name: "idx_product_variants_product_id", columns: ["product_id"] },
      { name: "idx_product_variants_color_id", columns: ["color_id"] },
    ],
    rls: { select: "public", insert: "service", update: "service", delete: "service" },
  },

  cart_items: {
    key: "cart_items",
    label: "public.cart_items",
    schema: "public",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      user_id: {
        type: "uuid",
        notNull: true,
        references: { table: "users", column: "id", onDelete: "cascade" },
      },
      variant_id: {
        type: "uuid",
        notNull: true,
        references: { table: "product_variants", column: "id", onDelete: "cascade" },
      },
      quantity: { type: "int4", notNull: true, default: 1 },
      selected_size: { type: "text", notNull: true },
      selected_finish: { type: "text", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
    },
    constraints: [
      {
        name: "cart_items_quantity_positive",
        definition: "check (quantity > 0)",
        test: (r) => Number(r.quantity) > 0,
      },
    ],
    indexes: [
      { name: "idx_cart_items_user_id", columns: ["user_id"] },
      { name: "idx_cart_items_variant_id", columns: ["variant_id"] },
    ],
    rls: { select: "own", insert: "own", update: "own", delete: "own", ownerColumn: "user_id" },
  },

  orders: {
    key: "orders",
    label: "public.orders",
    schema: "public",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      user_id: {
        type: "uuid",
        notNull: true,
        references: { table: "users", column: "id", onDelete: "restrict" },
      },
      total_amount: { type: "numeric", notNull: true },
      status: { type: "text", notNull: true, default: "Pending" },
      payment_status: { type: "text", notNull: true, default: "Pending" },
      delivery_address: { type: "text", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
    },
    constraints: [
      {
        name: "orders_total_positive",
        definition: "check (total_amount >= 0)",
        test: (r) => Number(r.total_amount) >= 0,
      },
      {
        name: "orders_status",
        definition:
          "check (status in ('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'))",
        test: (r) =>
          ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"].includes(
            r.status,
          ),
      },
      {
        name: "orders_payment_status",
        definition: "check (payment_status in ('Pending','Paid','Failed','Refunded'))",
        test: (r) => ["Pending", "Paid", "Failed", "Refunded"].includes(r.payment_status),
      },
    ],
    indexes: [
      { name: "idx_orders_user_id", columns: ["user_id"] },
      { name: "idx_orders_status", columns: ["status"] },
    ],
    rls: { select: "own", insert: "own", update: "own", delete: "own", ownerColumn: "user_id" },
  },

  order_items: {
    key: "order_items",
    label: "public.order_items",
    schema: "public",
    columns: {
      id: { type: "uuid", notNull: true, default: "gen_random_uuid()" },
      order_id: {
        type: "uuid",
        notNull: true,
        references: { table: "orders", column: "id", onDelete: "cascade" },
      },
      variant_id: {
        type: "uuid",
        notNull: true,
        references: { table: "product_variants", column: "id", onDelete: "restrict" },
      },
      quantity: { type: "int4", notNull: true },
      selected_size: { type: "text", notNull: true },
      selected_finish: { type: "text", notNull: true },
      unit_price: { type: "numeric", notNull: true },
      created_at: { type: "timestamptz", notNull: true, default: "now()" },
    },
    constraints: [
      {
        name: "order_items_quantity_positive",
        definition: "check (quantity > 0)",
        test: (r) => Number(r.quantity) > 0,
      },
      {
        name: "order_items_price_positive",
        definition: "check (unit_price >= 0)",
        test: (r) => Number(r.unit_price) >= 0,
      },
    ],
    indexes: [
      { name: "idx_order_items_order_id", columns: ["order_id"] },
      { name: "idx_order_items_variant_id", columns: ["variant_id"] },
    ],
    rls: {
      select: "own",
      insert: "service",
      update: "service",
      delete: "service",
      ownerColumn: null,
      inheritOwner: "order_id",
      ownerParent: "orders",
    },
  },
};

export const PUBLIC_TABLES = Object.values(TABLES).filter((t) => t.schema === "public");

export const PAINT_TYPES = ["Interior", "Exterior", "Masonry"];
export const STOCK_STATUSES = ["In Stock", "Low Stock", "Out of Stock"];
export const ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
export const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];

// Human-readable column type, as you'd read it back from information_schema.
export function columnType(def) {
  if (def.type === "numeric") return "numeric(12,2)";
  if (def.type === "int4") return "integer";
  if (def.type === "timestamptz") return "timestamptz";
  if (def.type === "text[]") return "text[]";
  return def.type;
}
