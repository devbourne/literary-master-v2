export function escapeHtml(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ①②③④⑤⑥⑦⑧⑨⑩
export function circled(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCharCode(9311 + n);
  return String(n);
}
