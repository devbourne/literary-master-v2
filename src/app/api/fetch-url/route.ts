import { lookup } from "dns/promises";
import { isIP } from "net";
import {
  extractArticleFromHtml,
  looksLikeHtml,
} from "@/lib/parsers/html-article";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function allowLocalFetch(): boolean {
  return process.env.ALLOW_LOCAL_FETCH === "true";
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (/^fc|^fd/.test(lower)) return true;
  if (/^fe[89ab]/.test(lower)) return true;
  if (/^ff/.test(lower)) return true;
  return false;
}

async function validateUrl(
  urlStr: string,
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { ok: false, error: "올바르지 않은 URL 형식입니다." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: `지원하지 않는 프로토콜: ${url.protocol}` };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      error: "URL에 사용자 정보(user:pass@)는 허용되지 않습니다.",
    };
  }
  if (allowLocalFetch()) return { ok: true, url };

  const host = url.hostname.replace(/^\[|\]$/g, "");

  const ipVer = isIP(host);
  if (ipVer === 4) {
    if (isBlockedIPv4(host)) {
      return { ok: false, error: "사설/로컬 IP로의 요청은 차단되었습니다." };
    }
    return { ok: true, url };
  }
  if (ipVer === 6) {
    if (isBlockedIPv6(host)) {
      return { ok: false, error: "사설/로컬 IP로의 요청은 차단되었습니다." };
    }
    return { ok: true, url };
  }

  if (host.toLowerCase() === "localhost") {
    return { ok: false, error: "localhost로의 요청은 차단되었습니다." };
  }

  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch (e) {
    return {
      ok: false,
      error: `DNS 조회 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (addrs.length === 0) {
    return { ok: false, error: "DNS 조회 결과가 없습니다." };
  }
  for (const a of addrs) {
    const blocked =
      a.family === 4 ? isBlockedIPv4(a.address) : isBlockedIPv6(a.address);
    if (blocked) {
      return {
        ok: false,
        error: `사설/로컬 IP(${a.address})로의 요청은 차단되었습니다.`,
      };
    }
  }
  return { ok: true, url };
}

async function readBodyCapped(res: Response, limit: number): Promise<string> {
  const lenHeader = res.headers.get("content-length");
  if (lenHeader) {
    const len = parseInt(lenHeader, 10);
    if (Number.isFinite(len) && len > limit) {
      throw new Error(
        `응답 크기(${len} 바이트)가 한도(${limit} 바이트)를 초과했습니다.`,
      );
    }
  }
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`응답이 ${limit} 바이트를 초과했습니다.`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function fetchWithRevalidatedRedirects(
  initial: URL,
  timeoutMs: number,
): Promise<Response> {
  let currentUrl = initial.toString();
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TextAnalysis/1.0)",
        Accept: "text/plain,text/html,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.status !== 304) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      let next: URL;
      try {
        next = new URL(loc, currentUrl);
      } catch {
        throw new Error(`리다이렉트 대상이 올바르지 않습니다: ${loc}`);
      }
      const check = await validateUrl(next.toString());
      if (!check.ok) {
        throw new Error(`리다이렉트 차단: ${check.error}`);
      }
      currentUrl = next.toString();
      continue;
    }
    return res;
  }
  throw new Error(`리다이렉트 한도(${MAX_REDIRECTS}) 초과`);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { url } = (body ?? {}) as { url?: unknown };
  if (typeof url !== "string" || url.length === 0) {
    return Response.json({ error: "URL이 필요합니다." }, { status: 400 });
  }

  const check = await validateUrl(url);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  const timeouts = [30000, 60000, 90000];
  let response: Response | null = null;
  let lastError: unknown = null;
  for (const timeout of timeouts) {
    try {
      response = await fetchWithRevalidatedRedirects(check.url, timeout);
      if (response.ok) break;
      lastError = `HTTP ${response.status}`;
      response = null;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      response = null;
    }
  }

  if (!response) {
    const hint = url.includes("gutenberg.org")
      ? "\n\n💡 Gutenberg가 응답하지 않습니다. '파일' 탭에서 .txt 파일을 직접 업로드하거나, '붙여넣기' 탭에서 텍스트를 직접 입력해 주세요."
      : "\n\n💡 네트워크 차단이거나 서버 응답이 없습니다. 텍스트를 직접 붙여넣어 보세요.";
    return Response.json(
      { error: `URL 가져오기 실패: ${lastError}${hint}` },
      { status: 502 },
    );
  }

  try {
    const contentType = response.headers.get("content-type");
    const raw = await readBodyCapped(response, MAX_BYTES);
    const isHtml = looksLikeHtml(contentType, raw);
    let text = isHtml ? extractArticleFromHtml(raw) : raw;
    const format: "html" | "plain" = isHtml ? "html" : "plain";

    if (!isHtml) {
      const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
      const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
      const altStartMarker = "*** START OF THIS PROJECT GUTENBERG EBOOK";
      const altEndMarker = "*** END OF THIS PROJECT GUTENBERG EBOOK";

      for (const marker of [startMarker, altStartMarker]) {
        const startIdx = text.indexOf(marker);
        if (startIdx !== -1) {
          const lineEnd = text.indexOf("\n", startIdx);
          text = text.slice(lineEnd + 1);
          break;
        }
      }

      for (const marker of [endMarker, altEndMarker]) {
        const endIdx = text.indexOf(marker);
        if (endIdx !== -1) {
          text = text.slice(0, endIdx);
          break;
        }
      }
    }

    text = text.trim();

    return Response.json({
      text,
      source: url,
      format,
      charCount: text.length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "URL 가져오기 실패" },
      { status: 502 },
    );
  }
}
