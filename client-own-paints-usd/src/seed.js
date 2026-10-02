import { hashPassword } from "./auth.js";
import { sizeFactor } from "./db.js";

export const IMAGES = {
  hero: "src/asset/hero-palette.jpg",
  heroSlides: [
    "src/asset/hero-palette.jpg",
    "src/asset/hero-splash.jpg",
    "src/asset/hero-kids.jpg",
  ],
  colourDeck: "https://user.uploads.dev/file/05cf4eb50ecd07cd0cf18a7c7f4fbd92.jpg",
  painter: "https://user.uploads.dev/file/e28720f1037b091efc3e649ea21faa5e.jpg",
  renovation: "https://user.uploads.dev/file/1f8d0b2d7e6aded9a7b8c65c485ff9a9.jpg",
  interiorTin: "https://user.uploads.dev/file/07a4027bd8f44f4157b83002e9acdc0e.jpg",
  interiorTinAlt: "https://user.uploads.dev/file/aa49397b7172f2e045f70f8b018a5d99.jpg",
  exteriorTin: "https://user.uploads.dev/file/b393f66e717c678ef0a1919446a4ecf7.jpg",
  masonryTub: "https://user.uploads.dev/file/9014327b5aadbf1b38e1f204a53188cc.jpg",
  masonryTubAlt: "https://user.uploads.dev/file/34617d0c153b8681923b720db8360a15.jpg",
};

export const DEMO_ACCOUNT = {
  email: "demo@spectrumcoatings.co",
  password: "spectrum123",
  display_name: "Jordan Blake",
};

export const COLORS = [
  { name: "Ivory White", hex_code: "#F5F1E8", category: "Neutrals", description: "Our brightest off-white.", finish_types: ["Matte", "Eggshell", "Satin", "Gloss"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Warm Alabaster", hex_code: "#EFE7D8", category: "Neutrals", description: "Soft, chalky and forgiving.", finish_types: ["Matte", "Eggshell", "Satin", "Gloss"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Pure Linen", hex_code: "#E8E1D5", category: "Neutrals", description: "A gentle greige.", finish_types: ["Matte", "Eggshell", "Satin"], usage: ["Interior", "Exterior"] },
  { name: "Coastal Sage", hex_code: "#A8B49B", category: "Greens", description: "Sea-worn green.", finish_types: ["Matte", "Eggshell", "Satin", "Gloss"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Deep Forest", hex_code: "#2E4B3C", category: "Greens", description: "A proper heritage green.", finish_types: ["Matte", "Eggshell", "Satin"], usage: ["Interior", "Exterior"] },
  { name: "Sage Mist", hex_code: "#C9D3C2", category: "Greens", description: "Barely-there sage.", finish_types: ["Matte", "Eggshell", "Silk"], usage: ["Interior"] },
  { name: "Olive Grove", hex_code: "#6B7A57", category: "Greens", description: "Earthy olive.", finish_types: ["Matte", "Eggshell", "Satin"], usage: ["Interior", "Exterior"] },
  { name: "Midnight Navy", hex_code: "#1F2A44", category: "Blues", description: "Deep and luxurious.", finish_types: ["Matte", "Eggshell", "Satin", "Gloss"], usage: ["Interior", "Exterior"] },
  { name: "Harbour Blue", hex_code: "#4A6E8A", category: "Blues", description: "Grey morning blue.", finish_types: ["Matte", "Eggshell", "Satin"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Sky Wash", hex_code: "#A9C6D9", category: "Blues", description: "Pale and airy.", finish_types: ["Matte", "Eggshell", "Silk"], usage: ["Interior", "Masonry"] },
  { name: "Terracotta Clay", hex_code: "#C56A4B", category: "Warms", description: "Sun-baked clay.", finish_types: ["Matte", "Eggshell", "Textured"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Burnt Sienna", hex_code: "#9C4A2F", category: "Warms", description: "Duskier terracotta.", finish_types: ["Matte", "Textured"], usage: ["Exterior", "Masonry"] },
  { name: "Dusty Rose", hex_code: "#C68C8C", category: "Warms", description: "Muted, grown-up pink.", finish_types: ["Matte", "Eggshell", "Silk"], usage: ["Interior"] },
  { name: "Heritage Ochre", hex_code: "#D9A441", category: "Warms", description: "Golden ochre.", finish_types: ["Matte", "Eggshell", "Satin"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Amber Glow", hex_code: "#E0A96D", category: "Warms", description: "Soft apricot.", finish_types: ["Matte", "Eggshell", "Silk"], usage: ["Interior"] },
  { name: "Charcoal Slate", hex_code: "#3B3F42", category: "Greys", description: "Near-black.", finish_types: ["Matte", "Eggshell", "Satin", "Gloss"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Dove Grey", hex_code: "#B9BCB8", category: "Greys", description: "Neutral cool grey.", finish_types: ["Matte", "Eggshell", "Satin", "Gloss"], usage: ["Interior", "Exterior", "Masonry"] },
  { name: "Pewter Mist", hex_code: "#8A8F8C", category: "Greys", description: "Green-grey for fences.", finish_types: ["Matte", "Eggshell", "Textured"], usage: ["Interior", "Exterior", "Masonry"] },
];

export const PRODUCTS = [
  { title: "Signature Interior Emulsion", base_price: 42, paint_type: "Interior", size_options: ["1L", "2.5L", "5L", "10L"], description: "Flagship wall paint.", meta: { sku: "SC-INT-100", rating: 4.9, reviews: 412, badge: "Best seller", image: IMAGES.interiorTin, featured: true } },
  { title: "Ultra-Matte Ceiling Paint", base_price: 32.5, paint_type: "Interior", size_options: ["2.5L", "5L", "10L"], description: "Super-flat ceiling paint.", meta: { sku: "SC-INT-210", rating: 4.7, reviews: 188, featured: false } },
  { title: "Washable Silk Interior", base_price: 49, paint_type: "Interior", size_options: ["1L", "2.5L", "5L"], description: "Hard-wearing low-sheen finish.", meta: { sku: "SC-INT-330", rating: 4.8, reviews: 265, badge: "Wipeable", featured: true } },
  { title: "Multi-Surface Primer", base_price: 36, paint_type: "Interior", size_options: ["1L", "2.5L", "5L"], description: "Bonds to bare plaster.", meta: { sku: "SC-INT-010", rating: 4.6, reviews: 97, featured: false } },
  { title: "Weathershield Exterior Satin", base_price: 54, paint_type: "Exterior", size_options: ["1L", "2.5L", "5L"], description: "Flexible, rain-resistant.", meta: { sku: "SC-EXT-500", rating: 4.8, reviews: 231, badge: "15-year warranty", featured: true } },
  { title: "Exterior Gloss", base_price: 51, paint_type: "Exterior", size_options: ["1L", "2.5L", "5L"], description: "Traditional high-gloss.", meta: { sku: "SC-EXT-620", rating: 4.7, reviews: 143, featured: false } },
  { title: "Fence & Shed Stain", base_price: 38.5, paint_type: "Exterior", size_options: ["5L", "10L"], description: "Penetrating water-based stain.", meta: { sku: "SC-EXT-740", rating: 4.5, reviews: 76, featured: false } },
  { title: "Masonry Shield Smooth", base_price: 58, paint_type: "Masonry", size_options: ["5L", "10L"], description: "Tough, breathable coating.", meta: { sku: "SC-MAS-800", rating: 4.8, reviews: 164, badge: "Trade favourite", featured: true } },
  { title: "Masonry Shield Textured", base_price: 62, paint_type: "Masonry", size_options: ["5L", "10L"], description: "Roller-applied texture.", meta: { sku: "SC-MAS-820", rating: 4.6, reviews: 88, featured: false } },
  { title: "Damp-Block Primer", base_price: 55, paint_type: "Masonry", size_options: ["5L", "10L"], description: "Alkali-resistant primer.", meta: { sku: "SC-MAS-700", rating: 4.6, reviews: 61, featured: false } },
];

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function variantsFor(productRows, colorRows) {
  const rows = [];
  for (const product of productRows) {
    for (const color of colorRows) {
      if (!color.usage.includes(product.paint_type)) continue;
      const r = hash(`${product.title}|${color.name}`);
      rows.push({
        product_id: product.id,
        color_id: color.id,
        stock_status: r < 0.05 ? "Out of Stock" : r < 0.18 ? "Low Stock" : "In Stock",
        image_url: product.meta?.image || null,
      });
    }
  }
  return rows;
}

const DAY = 86400000;
function isoAgo(days) { return new Date(Date.now() - days * DAY).toISOString(); }

export function demoOrders(context) {
  const { products, colors, variants, userId } = context;
  const pick = (title, colorName) => {
    const product = products.find(p => p.title === title);
    const color = colors.find(c => c.name === colorName);
    return { product, color, variant: variants.find(v => v.product_id === product.id && v.color_id === color.id) };
  };
  const spec = [
    { days: 34, status: "Delivered", payment_status: "Paid", address: "18 Alder Row, Portland, OR 97214", lines: [["Signature Interior Emulsion", "Coastal Sage", "5L", "Eggshell", 3], ["Multi-Surface Primer", "Ivory White", "5L", "Matte", 1]] },
    { days: 12, status: "Shipped", payment_status: "Paid", address: "18 Alder Row, Portland, OR 97214", lines: [["Weathershield Exterior Satin", "Midnight Navy", "5L", "Satin", 2]] },
    { days: 3, status: "Processing", payment_status: "Paid", address: "2210 NE Fremont St, Portland, OR 97212", lines: [["Masonry Shield Smooth", "Terracotta Clay", "10L", "Matte", 4]] },
    { days: 0.4, status: "Pending", payment_status: "Pending", address: "2210 NE Fremont St, Portland, OR 97212", lines: [["Washable Silk Interior", "Heritage Ochre", "2.5L", "Eggshell", 1]] },
  ];
  return spec.map(order => {
    const lines = order.lines.map(([title, colorName, size, finish, quantity]) => {
      const { product, variant } = pick(title, colorName);
      return { variant_id: variant.id, quantity, selected_size: size, selected_finish: finish, unit_price: Math.round(Number(product.base_price) * sizeFactor(size) * 100) / 100, created_at: isoAgo(order.days) };
    });
    const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
    const tax = Math.round(subtotal * 0.0825 * 100) / 100;
    const shipping = subtotal >= 75 ? 0 : 6.95;
    return { user_id: userId, delivery_address: order.address, status: order.status, payment_status: order.payment_status, total_amount: Math.round((subtotal + tax + shipping) * 100) / 100, created_at: isoAgo(order.days), lines };
  });
}

export async function seedAll(db, { shopSettings = {} } = {}) {
  const service = db.asService();
  db.shopSettings = shopSettings;
  for (const key of ["order_items", "orders", "cart_items", "product_variants", "products", "colors", "users"]) db.data[key] = [];

  const { data: colorRows, error: colorError } = await service.from("colors").insert(COLORS.map(({ usage, ...row }) => row)).select();
  if (colorError) throw colorError;

  const { data: productRows, error: productError } = await service.from("products").insert(PRODUCTS.map(({ meta, ...row }) => row)).select();
  if (productError) throw productError;

  const products = productRows.map((row, i) => ({ ...row, meta: PRODUCTS[i].meta }));
  const colors = colorRows.map((row, i) => ({ ...row, usage: COLORS[i].usage }));

  const { data: variants, error: variantError } = await service.from("product_variants").insert(variantsFor(products, colors)).select();
  if (variantError) throw variantError;

  const { data: user, error: userError } = await service.from("users").insert({
    email: DEMO_ACCOUNT.email,
    encrypted_password: await hashPassword(DEMO_ACCOUNT.password),
    display_name: DEMO_ACCOUNT.display_name,
    last_sign_in_at: isoAgo(1),
    created_at: isoAgo(96),
  }).select().single();
  if (userError) throw userError;

  await db.persist();
  return { colors: colors.length, products: products.length, product_variants: variants.length, users: 1, orders: 0, order_items: 0, cart_items: 0 };
}