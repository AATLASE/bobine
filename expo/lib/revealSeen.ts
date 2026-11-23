import { storage, storageKey } from "@/lib/storage";

/**
 * Which reveals this device has already opened (see RevealGate). Kept on the
 * device: it only decides whether to replay a moment, nothing depends on it.
 */
const KEY = storageKey("reveal.seen.v1");
const MAX = 300;

async function read(): Promise<string[]> {
  try {
    const raw = await storage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export async function hasSeenReveal(episodeId: string): Promise<boolean> {
  return (await read()).includes(episodeId);
}

export async function markRevealSeen(episodeId: string): Promise<void> {
  try {
    const seen = await read();
    if (seen.includes(episodeId)) return;
    await storage.setItem(KEY, JSON.stringify([...seen, episodeId].slice(-MAX)));
  } catch {}
}
