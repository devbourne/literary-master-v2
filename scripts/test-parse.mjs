import { readFileSync } from "fs";
import * as blockSchemas from "../src/lib/schemas/block.ts";
const { BatchResponseSchema, AnnotatedBlockSchema } = blockSchemas;

const raw = readFileSync("/tmp/analysis_logs/pass2_batch_0_raw.txt", "utf8");

try {
  const parsed = JSON.parse(raw);
  console.log("Direct JSON parse OK");
  console.log("Top keys:", Object.keys(parsed));
  console.log("Translations length:", parsed.translations?.length);

  // Try parsing first block
  const blockResult = AnnotatedBlockSchema.safeParse(parsed.translations[0]);
  console.log("Block 0 Zod:", blockResult.success ? "OK" : "FAIL");
  if (!blockResult.success) {
    console.log("Block errors:");
    for (const issue of blockResult.error.issues.slice(0, 10)) {
      console.log(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }

  // Try full batch
  const batchResult = BatchResponseSchema.safeParse(parsed);
  console.log("Batch Zod:", batchResult.success ? "OK" : "FAIL");
  if (batchResult.success) {
    console.log("Batch translations length:", batchResult.data.translations.length);
  } else {
    console.log("Batch errors:");
    for (const issue of batchResult.error.issues.slice(0, 10)) {
      console.log(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }
} catch (e) {
  console.log("Direct parse failed:", e.message);
}
