import { z } from "zod";
import { parseJsonFromLLM } from "../parsers/json-parser";

export function stripMarkdownFence(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  return s;
}

export interface SafeParseResult<T> {
  data: T;
  ok: boolean;
  error?: string;
}

export function safeParseLLM<S extends z.ZodTypeAny>(
  schema: S,
  raw: string,
  context: string = "unknown",
): SafeParseResult<z.infer<S>> {
  const cleaned = stripMarkdownFence(raw);

  // Step 1: try direct JSON.parse
  let parsedJson: unknown;
  let hasRealContent = false;
  try {
    parsedJson = JSON.parse(cleaned);
    hasRealContent = true;
  } catch {
    // Step 2: use robust parser from json-parser.ts
    try {
      const salvaged = parseJsonFromLLM(cleaned);
      if (
        typeof salvaged === "object" &&
        salvaged !== null &&
        "raw" in salvaged &&
        Object.keys(salvaged).length === 1
      ) {
        // Only {raw:...} — no structured content recovered
        parsedJson = {};
      } else {
        parsedJson = salvaged;
        hasRealContent =
          typeof salvaged === "object" &&
          salvaged !== null &&
          Object.keys(salvaged).length > 0;
      }
    } catch {
      parsedJson = {};
    }
  }

  // Step 2.5: normalize — replace `null` with `undefined` so schema defaults
  // kick in. LLMs routinely emit `null` where our schemas declare strings
  // with `.default("")`, which Zod would otherwise reject.
  parsedJson = normalizeNulls(parsedJson);

  // Step 3: Zod validation
  const result = schema.safeParse(parsedJson);
  if (result.success) {
    // If we had no real content, the schema-accepted value is just defaults.
    // Report ok=false so callers can mark it as a fallback.
    return { data: result.data, ok: hasRealContent };
  }

  // Step 4: Try to salvage as much as possible by filtering out invalid fields
  // Instead of using pure defaults, merge valid parts of parsedJson with schema defaults
  const salvaged = salvagePartial(schema, parsedJson, context);
  if (salvaged) {
    console.warn(
      `[safeParseLLM ${context}] Schema validation failed but salvaged partial data:`,
      result.error.message.slice(0, 150),
    );
    return { data: salvaged, ok: false, error: result.error.message };
  }

  // Step 5: fallback to defaults
  const fallbackResult = schema.safeParse({});
  if (fallbackResult.success) {
    console.warn(
      `[safeParseLLM ${context}] Using defaults:`,
      result.error.message.slice(0, 150),
    );
    return { data: fallbackResult.data, ok: false, error: result.error.message };
  }

  console.error(`[safeParseLLM ${context}] FATAL:`, fallbackResult.error.message);
  return { data: {} as z.infer<S>, ok: false, error: result.error.message };
}

// Recursively replace `null` leaves with `undefined` so Zod `.default(...)`
// kicks in. Preserves object/array structure; does not descend into strings.
function normalizeNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(normalizeNulls);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizeNulls(v);
      if (normalized !== undefined) out[k] = normalized;
    }
    return out;
  }
  return value;
}

// Try to salvage valid parts by recursively applying schema to individual fields
function salvagePartial<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  context: string,
): z.infer<S> | null {
  if (typeof data !== "object" || data === null) return null;

  // Try parsing each field individually and keep what works
  const dataObj = data as Record<string, unknown>;

  // Get defaults from empty parse
  const defaultsResult = schema.safeParse({});
  if (!defaultsResult.success) return null;
  const defaults = defaultsResult.data as Record<string, unknown>;

  // Strategy: walk through zod shape and parse each field individually
  try {
    const def = (schema as unknown as { _def?: { shape?: () => Record<string, z.ZodTypeAny> } })._def;
    const shape = def?.shape?.();
    if (!shape) {
      // Not a ZodObject, just try direct parse with defaults
      return defaults as z.infer<S>;
    }

    const result: Record<string, unknown> = { ...defaults };
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (key in dataObj) {
        const fieldResult = (fieldSchema as z.ZodTypeAny).safeParse(dataObj[key]);
        if (fieldResult.success) {
          result[key] = fieldResult.data;
        } else {
          // Try salvaging nested arrays/objects
          const fieldValue = dataObj[key];
          if (Array.isArray(fieldValue)) {
            // For arrays, try to parse each element with the inner schema
            const inner = (fieldSchema as unknown as { _def?: { innerType?: z.ZodTypeAny; type?: z.ZodTypeAny } })._def;
            const innerType = inner?.innerType || inner?.type;
            if (innerType) {
              const validItems = fieldValue
                .map((item) => (innerType as z.ZodTypeAny).safeParse(item))
                .filter((r) => r.success)
                .map((r) => (r as { data: unknown }).data);
              result[key] = validItems;
            }
          }
          // Else: keep default
        }
      }
    }
    return result as z.infer<S>;
  } catch (e) {
    console.warn(`[salvagePartial ${context}] failed:`, e);
    return null;
  }
}
