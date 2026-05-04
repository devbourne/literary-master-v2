// v2.5+ S5 — list jobs (running + recent terminal).

import { listJobs, type JobStatus } from "@/lib/jobs/registry";

export const runtime = "nodejs";

const VALID_STATUSES: JobStatus[] = [
  "running",
  "complete",
  "complete_with_warnings",
  "incomplete",
  "error",
  "cancelled",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam
    ? statusParam
        .split(",")
        .filter((s): s is JobStatus =>
          VALID_STATUSES.includes(s as JobStatus),
        )
    : undefined;
  const items = listJobs({ statuses });
  return Response.json({ items });
}
