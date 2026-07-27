/**
 * Shared bucket management for hook registries.
 *
 * Mirrors the PHP `ManagesHookBuckets` trait: callbacks are stored per hook
 * name, then per priority, then as `[seq, callback]` tuples so same-priority
 * callbacks fire in stable FIFO insertion order.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HookCallback = (...args: any[]) => any;

type Entry = readonly [seq: number, cb: HookCallback];
type Bucket = Map<number, Entry[]>;

export interface HookRegistry {
  add(hook: string, callback: HookCallback, priority?: number): void;
  remove(hook: string, callback: HookCallback, priority?: number): boolean;
  removeAll(hook: string, priority?: number | false): boolean;
  has(hook: string): boolean;
  collect(hook: string): HookCallback[];
  /**
   * Merge callbacks across multiple hook names into a single dispatch list.
   * Entries are sorted globally by (priority asc, seq asc) and deduplicated
   * by callable identity — a callback registered under more than one of the
   * given names still fires exactly once.
   */
  collectMany(hooks: readonly string[]): HookCallback[];
  version(hook: string): number;
  subscribe(hook: string, listener: () => void): () => void;
  reset(): void;
}

export function createRegistry(): HookRegistry {
  const callbacks = new Map<string, Bucket>();
  const versions = new Map<string, number>();
  const listeners = new Map<string, Set<() => void>>();
  let sequence = 0;

  function bump(hook: string): void {
    versions.set(hook, (versions.get(hook) ?? 0) + 1);
    const hookListeners = listeners.get(hook);
    if (hookListeners) {
      for (const listener of hookListeners) {
        listener();
      }
    }
  }

  const registry: HookRegistry = {
    add(hook, callback, priority = 10) {
      let bucket = callbacks.get(hook);
      if (!bucket) {
        bucket = new Map();
        callbacks.set(hook, bucket);
      }
      const entries = bucket.get(priority);
      const entry: Entry = [sequence++, callback];
      if (entries) {
        entries.push(entry);
      } else {
        bucket.set(priority, [entry]);
      }
      bump(hook);
    },

    remove(hook, callback, priority = 10) {
      const bucket = callbacks.get(hook);
      if (!bucket) return false;
      const entries = bucket.get(priority);
      if (!entries) return false;

      for (let i = 0; i < entries.length; i++) {
        // Non-null: index is in bounds by construction.
        if (entries[i]![1] === callback) {
          entries.splice(i, 1);
          if (entries.length === 0) {
            bucket.delete(priority);
          }
          if (bucket.size === 0) {
            callbacks.delete(hook);
          }
          bump(hook);
          return true;
        }
      }
      return false;
    },

    removeAll(hook, priority = false) {
      const bucket = callbacks.get(hook);
      if (!bucket) return false;

      if (priority !== false) {
        if (!bucket.has(priority)) return false;
        bucket.delete(priority);
        if (bucket.size === 0) {
          callbacks.delete(hook);
        }
        bump(hook);
        return true;
      }

      callbacks.delete(hook);
      bump(hook);
      return true;
    },

    has(hook) {
      // Every mutation prunes empty priorities and empty buckets, so bucket
      // presence in the outer map is equivalent to having at least one entry.
      return callbacks.has(hook);
    },

    reset() {
      callbacks.clear();
      versions.clear();
      listeners.clear();
      sequence = 0;
    },

    collect(hook) {
      const bucket = callbacks.get(hook);
      if (!bucket) return [];

      const priorities = [...bucket.keys()].sort((a, b) => a - b);
      const out: HookCallback[] = [];
      for (const priority of priorities) {
        const entries = bucket.get(priority)!;
        // Snapshot: copy the reference-slice up front so callbacks added to
        // this same bucket during dispatch are deferred to the next call.
        for (const [, cb] of entries.slice()) {
          out.push(cb);
        }
      }
      return out;
    },

    collectMany(hooks) {
      if (hooks.length === 1) {
        return registry.collect(hooks[0]!);
      }

      // Merge every priority bucket from every hook name, then sort by
      // (priority asc, seq asc). Snapshot each entries[] up front so
      // mid-dispatch mutations do not leak into this pass.
      const merged: Array<{ priority: number; entry: Entry }> = [];
      for (const hook of hooks) {
        const bucket = callbacks.get(hook);
        if (!bucket) continue;
        for (const [priority, entries] of bucket) {
          for (const entry of entries.slice()) {
            merged.push({ priority, entry });
          }
        }
      }

      merged.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.entry[0] - b.entry[0];
      });

      const seen = new Set<HookCallback>();
      const out: HookCallback[] = [];
      for (const { entry } of merged) {
        const cb = entry[1];
        if (seen.has(cb)) continue;
        seen.add(cb);
        out.push(cb);
      }
      return out;
    },

    version(hook) {
      return versions.get(hook) ?? 0;
    },

    subscribe(hook, listener) {
      let hookListeners = listeners.get(hook);
      if (!hookListeners) {
        hookListeners = new Set();
        listeners.set(hook, hookListeners);
      }
      hookListeners.add(listener);
      return () => {
        const set = listeners.get(hook);
        if (!set) return;
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(hook);
        }
      };
    },
  };

  return registry;
}
