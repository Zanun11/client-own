// Client-side auth for the storefront.
//
// The schema's `cart_items.user_id` and `orders.user_id` are NOT NULL foreign keys
// into `auth.users(id)`, so a basket needs a real user row. We mirror Supabase's
// anonymous sign-in: a fresh visitor gets an anonymous `auth.users` row, shops as
// themselves, and when they sign up (or sign in) their basket is merged into the
// permanent account with the `merge_cart` function — exactly the guest → account
// flow you'd build against a real Supabase project.

import { uuid } from "./db.js";
import { PgError } from "./pg-error.js";

const ITERATIONS = 120000;

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2_sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts[0] !== "pbkdf2_sha256" || parts.length !== 4) return false;
  const candidate = await hashPassword(password, fromBase64(parts[2]));
  if (candidate.length !== stored.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i += 1) mismatch |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  return mismatch === 0;
}

export function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAnonymous(user) {
  return !user || !user.encrypted_password || user.encrypted_password === "anonymous";
}

export function profileOf(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || (isAnonymous(user) ? "Guest" : user.email.split("@")[0]),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    isAnonymous: isAnonymous(user),
  };
}

export class Auth {
  constructor({ db, sessionStore }) {
    this.db = db;
    this.sessionStore = sessionStore;
    this.user = null;
    this.session = { userId: null, role: "anon" };
    this._listeners = new Set();
  }

  get service() {
    return this.db.asService();
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    for (const fn of this._listeners) fn(this);
  }

  async restore() {
    const saved = await this.sessionStore.get("session");
    if (saved && saved.userId) {
      const { data } = await this.service.from("users").select("*").eq("id", saved.userId).maybeSingle();
      if (data) {
        this._apply(data);
        return this.user;
      }
    }
    return this.signInAnonymously({ email: saved?.email });
  }

  async signInAnonymously({ email } = {}) {
    const row = {
      email: email || `guest-${uid()}@spectrum.local`,
      encrypted_password: "anonymous",
      display_name: "Guest shopper",
      last_sign_in_at: new Date().toISOString(),
    };
    const { data, error } = await this.service.from("users").insert(row).select().single();
    if (error) throw error;
    this._apply(data);
    return this.user;
  }

  async signUp({ email, password, displayName, mergeGuestCart = true }) {
    const clean = normaliseEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) throw new PgError("that email address doesn't look right", "22023");
    if (String(password || "").length < 8) throw new PgError("choose a password with at least 8 characters", "22023");
    const guestId = this.user && isAnonymous(this.user) ? this.user.id : null;
    const { data: existing } = await this.service.from("users").select("*").eq("email", clean).maybeSingle();
    if (existing) throw new PgError("an account with that email already exists — try signing in instead", "23505");
    const { data, error } = await this.service
      .from("users")
      .insert({
        email: clean,
        encrypted_password: await hashPassword(password),
        display_name: String(displayName || "").trim() || clean.split("@")[0],
        last_sign_in_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    if (mergeGuestCart && guestId && guestId !== data.id) await this._mergeGuestCart(guestId, data.id);
    this._apply(data);
    return this.user;
  }

  async signIn({ email, password }) {
    const clean = normaliseEmail(email);
    const guestId = this.user && isAnonymous(this.user) ? this.user.id : null;
    const { data } = await this.service.from("users").select("*").eq("email", clean).maybeSingle();
    if (!data || !(await verifyPassword(password, data.encrypted_password)))
      throw new PgError("email or password is incorrect", "28P01");
    const { data: touched } = await this.service
      .from("users")
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (guestId && guestId !== data.id) await this._mergeGuestCart(guestId, data.id);
    this._apply(touched || data);
    return this.user;
  }

  async _mergeGuestCart(fromUserId, toUserId) {
    const { data } = await this.db.rpc("merge_cart", { p_from_user: fromUserId, p_to_user: toUserId }, {
      session: { userId: toUserId, role: "authenticated" },
    });
    void data;
    const { error } = await this.service.from("users").delete().eq("id", fromUserId);
    // The guest account's orders block its deletion (orders_user_id_fkey is ON DELETE
    // RESTRICT), so an anonymous account that placed orders simply stays behind — the
    // same husk you get with real anonymous sign-ins.
    if (error && error.code !== "23503") throw error;
  }

  async updateProfile({ displayName }) {
    if (!this.user) throw new PgError("not signed in", "42501");
    const { data, error } = await this.db
      .from("users")
      .update({ display_name: String(displayName || "").trim() || this.user.display_name })
      .eq("id", this.user.id)
      .select()
      .single();
    if (error) throw error;
    this._apply(data);
    return this.user;
  }

  async deleteAccount() {
    if (!this.user) throw new PgError("not signed in", "42501");
    const { error } = await this.db.from("users").delete().eq("id", this.user.id);
    if (error) throw error;
    this.user = null;
    this.session = { userId: null, role: "anon" };
    this.db.session = this.session;
    await this.sessionStore.delete("session");
    this._emit();
  }

  async signOut() {
    const wasAnonymous = this.user && isAnonymous(this.user);
    const previous = this.user;
    this.user = null;
    this.session = { userId: null, role: "anon" };
    this.db.session = this.session;
    await this.sessionStore.delete("session");
    if (wasAnonymous && previous) await this.service.from("users").delete().eq("id", previous.id);
    this._emit();
    return this.signInAnonymously();
  }

  _apply(row) {
  this.user = row;

  const anonymous = isAnonymous(row);

  this.session = {
    userId: row.id,
    role: anonymous ? "anon" : "authenticated",
  };

  this.db.session = this.session;

  this.sessionStore.set("session", {
    userId: row.id,
    email: row.email,
  });

  this._emit();
}
}

function uid() {
  return uuid().slice(0, 8);
}
