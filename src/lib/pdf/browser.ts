import puppeteer, { type Browser } from "puppeteer-core";
import { existsSync } from "fs";

const SYSTEM_CHROME_PATHS = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chrome",
  "/snap/bin/chromium",
];

export async function launchBrowser(): Promise<Browser> {
  const diagnostics: string[] = [];
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

  // 1. Explicit env override
  const envPath = process.env.CHROME_PATH;
  if (envPath && existsSync(envPath)) {
    return puppeteer.launch({ executablePath: envPath, headless: true, args });
  }
  if (envPath) diagnostics.push(`CHROME_PATH set but not found: ${envPath}`);

  // 2. System Chrome/Chromium (preferred on DGX Spark ARM64 Linux)
  for (const p of SYSTEM_CHROME_PATHS) {
    if (existsSync(p)) {
      return puppeteer.launch({ executablePath: p, headless: true, args });
    }
  }
  diagnostics.push(`No system Chrome at: ${SYSTEM_CHROME_PATHS.join(", ")}`);

  // 3. @sparticuz/chromium (last resort, serverless-focused)
  try {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default;
    const execPath = await chromium.executablePath();
    if (execPath && existsSync(execPath)) {
      return puppeteer.launch({ args: chromium.args, executablePath: execPath, headless: true });
    }
    diagnostics.push(`@sparticuz/chromium path invalid: ${execPath}`);
  } catch (e) {
    diagnostics.push(`@sparticuz/chromium failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(
    `Chromium not found. Install chromium-browser or set CHROME_PATH.\nDiagnostics: ${diagnostics.join("; ")}`
  );
}
