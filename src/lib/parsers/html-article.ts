// Lightweight, dependency-free HTML → readable text extractor.
// Purpose: turn article pages (e.g. newyorker.com, theatlantic.com, Gutenberg
// HTML editions) into plain prose suitable for literary analysis. Not a full
// Readability implementation; it trades accuracy for zero deps.

const HTML_CONTENT_TYPE = /\b(text\/html|application\/xhtml)/i;

export function looksLikeHtml(contentType: string | null | undefined, text: string): boolean {
  if (contentType && HTML_CONTENT_TYPE.test(contentType)) return true;
  const head = text.slice(0, 1024).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html");
}

// Extract readable article text from raw HTML.
// Strategy:
//   1. Drop script/style/noscript/template/svg/iframe with their content.
//   2. Prefer inner text of <article> → <main> → <body>.
//   3. Inside that region, drop nav/header/footer/aside/form blocks.
//   4. Convert block-level tags to paragraph boundaries, strip remaining tags.
//   5. Decode HTML entities, collapse whitespace.
export function extractArticleFromHtml(html: string): string {
  // 1. Remove tags whose content is never prose.
  let s = html.replace(
    /<(script|style|noscript|template|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );

  // 2. Narrow to the most article-shaped container we can find.
  const article = firstInnerBlock(s, "article") || firstInnerBlock(s, "main");
  if (article) s = article;

  // 3. Drop chrome blocks that commonly leak into <article>/<main>.
  s = s.replace(
    /<(nav|header|footer|aside|form|dialog|menu)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );

  // Drop figure/figcaption (image captions, pull-quotes with share buttons, etc.).
  // Literary prose sites typically repeat the quote in the paragraph stream anyway.
  s = s.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, " ");

  // Drop HTML comments.
  s = s.replace(/<!--[\s\S]*?-->/g, " ");

  // 4. Block-level tags become paragraph breaks before we strip everything else.
  s = s.replace(
    /<\/?(p|div|section|article|br\s*\/?|h[1-6]|li|ul|ol|blockquote|pre|tr|table)\b[^>]*>/gi,
    "\n",
  );
  s = s.replace(/<[^>]+>/g, "");

  // 5. Decode entities and normalize whitespace.
  s = decodeEntities(s);
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");

  return s;
}

// Return the inner HTML of the first <tag>...</tag> block, or null if missing.
// Uses a brace-style depth walker to handle nested same-name tags safely.
function firstInnerBlock(html: string, tag: string): string | null {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "i");
  const openMatch = openRe.exec(html);
  if (!openMatch) return null;

  const contentStart = openMatch.index + openMatch[0].length;
  const openTokenRe = new RegExp(`<${tag}\\b[^>]*>`, "gi");
  const closeTokenRe = new RegExp(`<\\/${tag}\\s*>`, "gi");
  openTokenRe.lastIndex = contentStart;
  closeTokenRe.lastIndex = contentStart;

  let depth = 1;
  while (depth > 0) {
    const nextOpen = openTokenRe.exec(html);
    const nextClose = closeTokenRe.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      closeTokenRe.lastIndex = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) return html.slice(contentStart, nextClose.index);
      openTokenRe.lastIndex = nextClose.index + nextClose[0].length;
    }
  }
  return null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201C",
  rdquo: "\u201D",
  laquo: "\u00AB",
  raquo: "\u00BB",
  copy: "\u00A9",
  reg: "\u00AE",
  trade: "\u2122",
  middot: "\u00B7",
  bull: "\u2022",
  deg: "\u00B0",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => {
      try {
        return String.fromCodePoint(Number(d));
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return "";
      }
    })
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => {
      const v = NAMED_ENTITIES[name.toLowerCase()];
      return v ?? match;
    });
}
