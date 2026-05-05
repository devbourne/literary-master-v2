import type { TeachingMaterial } from "../schemas/teaching-material";
import { TeachingMaterialSchema } from "../schemas/teaching-material";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "fs";
import { randomUUID } from "crypto";
import { join } from "path";

function resolveStorageDir(): string {
  const fromEnv = process.env.TEACHING_MATERIAL_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return join(process.cwd(), "data", "teaching-materials");
}

let ensuredDir: string | null = null;

function ensureStorageDir(): string {
  const dir = resolveStorageDir();
  if (ensuredDir === dir) return dir;
  mkdirSync(dir, { recursive: true });
  ensuredDir = dir;
  return dir;
}

export interface SavedRecord {
  id: string;
  title: string;
  author: string;
  savedAt: string;
  generatedAt: string;
  blockCount: number;
  verified: boolean;
  sizeBytes: number;
}

export interface SaveOptions {
  titleOverride?: string;
}

export interface SaveResult {
  id: string;
  path: string;
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function pathFor(id: string): string {
  return join(ensureStorageDir(), `${id}.json`);
}

function atomicWrite(path: string, contents: string): void {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

export function saveTeachingMaterial(
  tm: TeachingMaterial,
  opts: SaveOptions = {},
): string {
  const result = saveTeachingMaterialDetailed(tm, opts);
  return result.id;
}

// IDs are always server-generated to prevent caller-controlled overwrites.
export function saveTeachingMaterialDetailed(
  tm: TeachingMaterial,
  opts: SaveOptions = {},
): SaveResult {
  const id = randomUUID();
  const payload: TeachingMaterial = opts.titleOverride
    ? {
        ...tm,
        metadata: { ...tm.metadata, title: opts.titleOverride },
      }
    : tm;
  const path = pathFor(id);
  atomicWrite(path, JSON.stringify(payload));
  return { id, path };
}

export function loadTeachingMaterial(id: string): TeachingMaterial | null {
  const safeId = sanitizeId(id);
  if (!safeId) return null;
  const path = pathFor(safeId);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const parsed = TeachingMaterialSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    console.warn(
      `[storage] schema validation failed for ${safeId}: ${parsed.error.message.slice(0, 200)}`,
    );
    return null;
  } catch (e) {
    console.warn(
      `[storage] failed to read ${safeId}:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

export function deleteTeachingMaterial(id: string): boolean {
  const safeId = sanitizeId(id);
  if (!safeId) return false;
  const path = pathFor(safeId);
  if (!existsSync(path)) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

export function getStorageDir(): string {
  return resolveStorageDir();
}
