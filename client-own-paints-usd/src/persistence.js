// Storage adapters.
//
// The storefront persists its database rows and the current auth session through
// the perchance kv-plugin (IndexedDB) when it is available, and falls back to
// localStorage otherwise. Both are wrapped behind the same tiny async interface,
// which is also exactly what src/supabase.js replaces when you connect a real project.

export function getRoot() {
  if (typeof root !== "undefined" && root) return root;
  if (typeof window !== "undefined" && window.root) return window.root;
  return null;
}

export function makeStore(namespace) {
  const r = getRoot();
  const folder = r && r.kv ? r.kv[namespace] : null;
  const backing = folder ? "kv-plugin (IndexedDB)" : "localStorage";
  const memory = new Map();

  const localKey = (key) => `${namespace}:${key}`;

  return {
    backing,
    namespace,
    async get(key) {
      if (folder) return (await folder.get(key)) ?? null;
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(localKey(key)) : memory.get(key) ?? null;
      if (raw === null || raw === undefined) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    async set(key, value) {
      if (folder) return folder.set(key, value);
      const raw = JSON.stringify(value);
      if (typeof localStorage !== "undefined") localStorage.setItem(localKey(key), raw);
      else memory.set(key, raw);
      return value;
    },
    async delete(key) {
      if (folder) return folder.delete(key);
      if (typeof localStorage !== "undefined") localStorage.removeItem(localKey(key));
      else memory.delete(key);
      return true;
    },
    async clear() {
      if (folder && folder.entries) {
        const entries = await folder.entries();
        for (const [key] of entries) await folder.delete(key);
        return;
      }
      if (typeof localStorage !== "undefined") {
        Object.keys(localStorage)
          .filter((key) => key.startsWith(`${namespace}:`))
          .forEach((key) => localStorage.removeItem(key));
      } else {
        memory.clear();
      }
    },
  };
}

export function tableAdapter(store, key = "tables") {
  return {
    async load() {
      return store.get(key);
    },
    async save(value) {
      await store.set(key, value);
      return true;
    },
    async wipe() {
      await store.delete(key);
    },
  };
}
