import { listTeachingMaterials } from "@/lib/pipeline/storage-list";

export const runtime = "nodejs";

// Listing has no access control. It is enabled by default in dev (single-user
// local tool) and disabled by default in production until an auth/ownership
// model exists. Override with TEACHING_MATERIAL_LIST_ENABLED.
function listEnabled(): boolean {
  const flag = process.env.TEACHING_MATERIAL_LIST_ENABLED;
  if (flag !== undefined) return flag !== "false" && flag !== "0";
  return process.env.NODE_ENV !== "production";
}

export async function GET() {
  if (!listEnabled()) {
    return Response.json(
      {
        error:
          "listing disabled. Set TEACHING_MATERIAL_LIST_ENABLED=true to enable.",
      },
      { status: 403 },
    );
  }
  const items = listTeachingMaterials();
  return Response.json({ items });
}
