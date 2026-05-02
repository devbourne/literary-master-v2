import { TeachingMaterialSchema, type TeachingMaterial } from "../schemas/teaching-material";

export function validateTeachingMaterial(m: unknown): TeachingMaterial {
  const result = TeachingMaterialSchema.safeParse(m);
  if (!result.success) {
    throw new Error(`TeachingMaterial validation failed: ${result.error.message.slice(0, 300)}`);
  }
  return result.data;
}
