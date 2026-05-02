export function parseJsonFromLLM(text: string): Record<string, unknown> {
  let cleaned = text.trim();

  // Remove markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    cleaned = cleaned.trim();
  }

  // Replace smart quotes
  cleaned = cleaned
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"');

  // Try direct parse
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Extract JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return { raw: cleaned };

  const jsonStr = match[0];
  const d2 = tryParse(jsonStr);
  if (d2) return d2;

  // Quote unquoted keys (common LLM mistake: `way: "..."` instead of `"way": "..."`)
  const keyQuoted = quoteUnquotedKeys(jsonStr);
  const k = tryParse(keyQuoted);
  if (k) return k;

  // Fix unescaped quotes inside JSON string values (common LLM mistake)
  const fixed = fixUnescapedQuotes(keyQuoted);
  const f = tryParse(fixed);
  if (f) return f;

  // Partial recovery: truncate at last valid point
  const partial = partialRecover(fixed);
  if (partial) return partial;

  return { raw: cleaned };
}

// Quote unquoted property keys. Only matches keys that appear directly after
// `{` or `,` (with optional whitespace/newline), so we don't rewrite colons
// inside string values.
function quoteUnquotedKeys(text: string): string {
  // Walk char-by-char to stay out of strings.
  let out = "";
  let inStr = false;
  let esc = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (esc) { esc = false; out += c; i++; continue; }
    if (c === "\\" && inStr) { esc = true; out += c; i++; continue; }
    if (c === '"') { inStr = !inStr; out += c; i++; continue; }
    if (inStr) { out += c; i++; continue; }
    // Outside a string: after `{` or `,`, optionally whitespace, then bareword:
    if (c === "{" || c === ",") {
      // Find position right after whitespace
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      const rest = text.slice(j);
      const m = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (m) {
        const ident = m[1];
        out += c + text.slice(i + 1, j) + `"${ident}"`;
        i = j + ident.length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

// Try to salvage whatever parses — walk backwards closing arrays/objects
function partialRecover(text: string): Record<string, unknown> | null {
  // Find last well-balanced point
  for (let end = text.length; end > 100; end -= 50) {
    // Try truncating and adding closing brackets
    const truncated = text.slice(0, end);
    // Count open/close
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (const c of truncated) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") depth--;
    }

    if (depth <= 0 || inStr) continue;

    // Trim to last complete key-value pair
    let safe = truncated.replace(/,\s*"[^"]*"\s*:\s*[^,{}\[\]]*$/, "");
    safe = safe.replace(/,\s*$/, "");
    safe = safe.replace(/"[^"]*$/, "");
    safe = safe.replace(/,\s*$/, "");

    // Close remaining open brackets
    let closed = safe;
    // Re-count after trim
    depth = 0;
    inStr = false;
    esc = false;
    const stack: string[] = [];
    for (const c of closed) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") stack.pop();
    }
    while (stack.length > 0) closed += stack.pop();

    const parsed = tryParse(closed);
    if (parsed) return parsed;
  }
  return null;
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const result = JSON.parse(text);
    if (typeof result === "object" && result !== null) return result;
  } catch { /* fall through */ }
  return null;
}

function fixUnescapedQuotes(text: string): string {
  const PLACEHOLDER = "\x00ESC\x00";
  const lines = text.split("\n");
  const fixed: string[] = [];

  for (const line of lines) {
    // Match: "key": "value",
    const m = line.match(/^(\s*"[^"]+"\s*:\s*)"(.+)"(\s*,?\s*)$/);
    if (m) {
      const [, pre, val, suf] = m;
      // Preserve already-escaped quotes, then escape unescaped ones
      const escaped = val
        .replace(/\\"/g, PLACEHOLDER)
        .replace(/"/g, '\\"')
        .replace(new RegExp(PLACEHOLDER.replace(/\x00/g, "\\x00"), "g"), '\\"');
      fixed.push(`${pre}"${escaped}"${suf}`);
    } else {
      fixed.push(line);
    }
  }

  let result = fixed.join("\n");
  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[\]}])/g, "$1");
  return result;
}
