import { launchBrowser } from "@/lib/pdf/browser";
import { buildTeachingMaterialHtml } from "@/lib/pdf/pdf-renderer";
import { validateTeachingMaterial } from "@/lib/pdf/validate-teaching-material";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { teachingMaterial } = (body as { teachingMaterial: unknown }) || {};

  let validated;
  try {
    validated = validateTeachingMaterial(teachingMaterial);
  } catch (e) {
    return Response.json(
      { error: `Validation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 }
    );
  }

  const html = buildTeachingMaterialHtml(validated);

  let browser;
  try {
    browser = await launchBrowser();
  } catch (e) {
    return Response.json(
      { error: `Browser launch failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: ["networkidle0", "domcontentloaded"] });
    await page.evaluateHandle("document.fonts.ready");

    const title = escapeAttr(validated.metadata.title);
    const author = escapeAttr(validated.metadata.author);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      tagged: true,
      outline: true,
      margin: { top: "22mm", bottom: "22mm", left: "20mm", right: "20mm" },
      displayHeaderFooter: true,
      headerTemplate: `
        <style>
          .hdr {
            width: 100%;
            font-family: 'Crimson Pro', 'Noto Serif KR', Georgia, serif;
            font-size: 7.5pt;
            color: #8b7355;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            padding: 0 20mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .hdr .rule { flex:1; height:0.3pt; background:#d6cab0; margin:0 4mm; }
          .hdr .title { flex-shrink:0; font-weight:600; }
          .hdr .author { flex-shrink:0; font-style: italic; }
        </style>
        <div class="hdr">
          <span class="author">${author}</span>
          <span class="rule"></span>
          <span class="title">${title}</span>
        </div>`,
      footerTemplate: `
        <style>
          .ftr {
            width: 100%;
            font-family: 'Crimson Pro', 'Noto Serif KR', Georgia, serif;
            font-size: 8pt;
            color: #8b7355;
            letter-spacing: 0.14em;
            padding: 0 20mm;
            text-align: center;
          }
          .ftr .rule { margin: 0 auto 2mm; width: 20mm; height: 0.3pt; background: #d6cab0; }
        </style>
        <div class="ftr">
          <div class="rule"></div>
          <span class="pageNumber"></span>
        </div>`,
    });

    const filename = `${sanitize(validated.metadata.title)}-교재.pdf`;
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    return Response.json(
      { error: `PDF generation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

function sanitize(s: string): string {
  return s.replace(/[/\\?%*:|"<>]/g, "_");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
