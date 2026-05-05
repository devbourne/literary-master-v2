import {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
} from "fs";
import { join } from "path";
import type { TeachingMaterial } from "../schemas/teaching-material";
import { getStorageDir, type SavedRecord } from "./storage";

// Split out from storage.ts so the dynamic-directory listing op
// (readdirSync over a runtime-resolved path) doesn't get pulled into the
// NFT trace of routes that only need load / save / delete by id.
export function listTeachingMaterials(): SavedRecord[] {
  const dir = getStorageDir();
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const records: SavedRecord[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const id = entry.slice(0, -5);
    const path = join(dir, entry);
    try {
      const stat = statSync(path);
      const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<TeachingMaterial>;
      records.push({
        id,
        title: raw?.metadata?.title ?? "Untitled",
        author: raw?.metadata?.author ?? "(unknown)",
        savedAt: stat.mtime.toISOString(),
        generatedAt: raw?.metadata?.generated_at ?? "",
        blockCount: raw?.blocks?.length ?? 0,
        verified: raw?.verification?.verified ?? false,
        sizeBytes: stat.size,
      });
    } catch (e) {
      console.warn(
        `[storage] skipping unreadable record ${id}:`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  records.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  return records;
}
