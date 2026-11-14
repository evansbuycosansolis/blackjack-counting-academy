import type { RoundEvent } from "@/engine/replay";
import type { StateStorage } from "zustand/middleware";
import type { RoundRecord } from "./analytics";
export interface ArchivedRound {
  id: string;
  session: string;
  record: RoundRecord;
  events: RoundEvent[];
}
export interface StorageHealth {
  indexedDB: "unknown" | "ready" | "unavailable" | "failed";
  mirror: "ready" | "unavailable" | "full";
  message: string;
}
let health: StorageHealth = {
  indexedDB: "unknown",
  mirror: "ready",
  message: "",
};
const listeners = new Set<() => void>();
let database: Promise<IDBDatabase> | undefined;
const memory = new Map<string, string>(),
  roundMemory = new Map<string, ArchivedRound>();
let queue: Promise<unknown> = Promise.resolve();
export const storageHealth = () => health;
export const subscribeStorage = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function update(change: Partial<StorageHealth>) {
  if (
    Object.entries(change).every(
      ([k, v]) => health[k as keyof StorageHealth] === v,
    )
  )
    return;
  health = { ...health, ...change };
  for (const fn of listeners) fn();
}
function db() {
  if (typeof indexedDB === "undefined") {
    update({
      indexedDB: "unavailable",
      message:
        "IndexedDB is unavailable; the browser mirror and memory fallback are in use.",
    });
    return Promise.reject(Error("IndexedDB unavailable"));
  }
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("blackjack-academy-v2", 1);
      request.onupgradeneeded = () => {
        const d = request.result;
        if (!d.objectStoreNames.contains("state")) d.createObjectStore("state");
        if (!d.objectStoreNames.contains("rounds"))
          d.createObjectStore("rounds", { keyPath: "id" });
      };
      request.onsuccess = () => {
        update({ indexedDB: "ready" });
        resolve(request.result);
      };
      request.onerror = () => {
        database = undefined;
        update({
          indexedDB: "failed",
          message:
            "IndexedDB could not open. Current changes remain in memory; export a backup.",
        });
        reject(request.error);
      };
      request.onblocked = () => {
        update({
          indexedDB: "failed",
          message:
            "Storage upgrade is blocked by another tab. Close older tabs and retry storage.",
        });
        reject(Error("IndexedDB upgrade blocked"));
      };
    });
  return database;
}
async function read<T>(store: string, key?: IDBValidKey): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, "readonly"),
      req =
        key === undefined
          ? tx.objectStore(store).getAll()
          : tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}
async function write(store: string, value: unknown, key?: IDBValidKey) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(store, "readwrite");
    if (key === undefined) tx.objectStore(store).put(value);
    else tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? Error("Storage transaction aborted"));
  });
}
function failed(e: unknown) {
  update({
    indexedDB: "failed",
    message: `Persistent storage failed (${e instanceof Error ? e.name : "write error"}). Current changes stay in memory. Export a backup before closing this tab.`,
  });
}
export const durableStorage: StateStorage = {
  getItem: async (name) => {
    let mirror: string | null = null;
    try {
      mirror = localStorage.getItem(name);
    } catch {
      update({ mirror: "unavailable" });
    }
    let primary: string | null = null;
    try {
      primary = (await read<string>("state", name)) ?? null;
    } catch {
      /* Status is reported by the storage layer. */
    }
    const options = [memory.get(name), mirror, primary].filter(
      (x): x is string => !!x,
    );
    let best: string | null = null,
      bestTime = -1;
    for (const data of options) {
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed !== "object" || !parsed || !parsed.state) continue;
        const time = typeof parsed._savedAt === "number" ? parsed._savedAt : 0;
        if (time >= bestTime) {
          best = data;
          bestTime = time;
        }
      } catch {
        update({
          message:
            "An invalid saved-state copy was skipped. A valid mirror or new session will be used.",
        });
      }
    }
    if (best) memory.set(name, best);
    return best;
  },
  setItem: (name, value) => {
    let stamped = value;
    try {
      const previous = memory.get(name),
        prior = previous ? (JSON.parse(previous)._savedAt ?? 0) : 0;
      stamped = JSON.stringify({
        ...JSON.parse(value),
        _savedAt: Math.max(Date.now(), prior + 1),
      });
    } catch {
      /* Zustand normally supplies JSON; keep raw fallback if serialization changes. */
    }
    memory.set(name, stamped);
    try {
      localStorage.setItem(name, stamped);
      update({ mirror: "ready" });
    } catch {
      update({
        mirror: "full",
        message:
          "The localStorage mirror is full or blocked; IndexedDB and the memory copy continue to retain changes when available.",
      });
    }
    queue = queue.then(() => write("state", stamped, name)).catch(failed);
    return queue.then(() => undefined);
  },
  removeItem: async (name) => {
    memory.delete(name);
    try {
      localStorage.removeItem(name);
    } catch {
      /* Optional mirror. */
    }
    try {
      const d = await db();
      await new Promise<void>((resolve, reject) => {
        const tx = d.transaction("state", "readwrite");
        tx.objectStore("state").delete(name);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      failed(e);
    }
  },
};
export function archiveRound(round: ArchivedRound) {
  roundMemory.set(round.id, structuredClone(round));
  queue = queue
    .then(() => write("rounds", round))
    .then(() => {
      roundMemory.delete(round.id);
    })
    .catch(failed);
  return queue.then(() => undefined);
}
export async function loadRound(id: string) {
  if (roundMemory.has(id)) return structuredClone(roundMemory.get(id)!);
  try {
    return await read<ArchivedRound | undefined>("rounds", id);
  } catch (e) {
    failed(e);
    return undefined;
  }
}
export async function allRounds() {
  let rows: ArchivedRound[] = [];
  try {
    rows = await read<ArchivedRound[]>("rounds");
  } catch {
    /* memory fallback is merged below. */
  }
  const result = new Map(rows.map((r) => [r.id, r]));
  for (const [id, r] of roundMemory) result.set(id, r);
  return [...result.values()];
}
export async function flushStorage() {
  await queue;
}
export async function retryStorage() {
  database = undefined;
  try {
    await db();
    for (const [name, value] of memory) await write("state", value, name);
    for (const round of roundMemory.values()) {
      await write("rounds", round);
      roundMemory.delete(round.id);
    }
    update({
      indexedDB: "ready",
      message: "Pending in-memory data has been saved to IndexedDB.",
    });
    return true;
  } catch (e) {
    failed(e);
    return false;
  }
}
export async function estimateStorage() {
  try {
    return (await navigator.storage?.estimate?.()) ?? {};
  } catch {
    return {};
  }
}
export async function allRoundRecords() {
  const result = new Map<string, RoundRecord>();
  try {
    const d = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("rounds", "readonly"),
        request = tx.objectStore("rounds").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const r = cursor.value as ArchivedRound;
          result.set(r.id, r.record);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* Pending records remain available below. */
  }
  for (const r of roundMemory.values()) result.set(r.id, r.record);
  return [...result.values()].sort((a, b) => a.date.localeCompare(b.date));
}
