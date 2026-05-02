import { SavedDetail } from "@/components/saved-detail";

export default async function SavedItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedDetail id={id} />;
}
