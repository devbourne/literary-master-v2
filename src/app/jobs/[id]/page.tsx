import { JobDetail } from "@/components/job-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  return <JobDetail jobId={id} />;
}
