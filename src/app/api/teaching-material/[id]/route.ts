import {
  deleteTeachingMaterial,
  loadTeachingMaterial,
} from "@/lib/pipeline/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tm = loadTeachingMaterial(id);
  if (!tm) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ teachingMaterial: tm });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = deleteTeachingMaterial(id);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
