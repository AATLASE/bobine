import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Device storage for Bobine's own keys (preferences, snoozes, upload queue…).
 *
 * Every key lives under the "bobine." prefix. Earlier builds wrote the same
 * values under the app's former prefix; they are moved over once, on first launch
 * of this build, so nobody loses a setting or a pending upload:
 *  - web: AsyncStorage is plain localStorage there, so the move is done
 *    synchronously when this module loads, before any screen reads a key;
 *  - native: the move is async, and every read/write below waits for it.
 * A value already present under the new key always wins over the old one.
 */
const PREFIX = "bobine.";
const LEGACY_PREFIXES = ["gather."];

/** Full storage key for a Bobine setting, e.g. storageKey("themeMode.v1"). */
export const storageKey = (name: string) => `${PREFIX}${name}`;

function renamed(key: string): string | null {
  const legacy = LEGACY_PREFIXES.find((p) => key.startsWith(p));
  return legacy ? PREFIX + key.slice(legacy.length) : null;
}

function migrateWeb(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    const ls = window.localStorage;
    const legacyKeys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && renamed(key)) legacyKeys.push(key);
    }
    for (const key of legacyKeys) {
      const target = renamed(key)!;
      const value = ls.getItem(key);
      if (value !== null && ls.getItem(target) === null) ls.setItem(target, value);
      ls.removeItem(key);
    }
  } catch {
    // Storage blocked (private browsing…): nothing to migrate.
  }
}

async function migrateNative(): Promise<void> {
  try {
    const legacyKeys = (await AsyncStorage.getAllKeys()).filter((k) => renamed(k));
    if (legacyKeys.length === 0) return;
    const targets = legacyKeys.map((k) => renamed(k)!);
    const [legacyValues, existing] = await Promise.all([
      AsyncStorage.multiGet(legacyKeys),
      AsyncStorage.multiGet(targets),
    ]);
    const toWrite: [string, string][] = [];
    legacyValues.forEach(([, value], i) => {
      if (value !== null && existing[i][1] === null) toWrite.push([targets[i], value]);
    });
    // Copy first, delete after: an interruption in between is simply resumed
    // next launch (the copy is skipped because the new key now exists).
    if (toWrite.length > 0) await AsyncStorage.multiSet(toWrite);
    await AsyncStorage.multiRemove(legacyKeys);
  } catch {
    // Old keys stay in place and the move is retried next launch.
  }
}

let ready: Promise<void>;
if (Platform.OS === "web") {
  migrateWeb();
  ready = Promise.resolve();
} else {
  ready = migrateNative();
}

/** AsyncStorage, but only once the legacy keys have been moved over. */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    await ready;
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    await ready;
    return AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await ready;
    return AsyncStorage.removeItem(key);
  },
};
