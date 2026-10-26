import { MasterProfile } from '@/features/masters/MasterProfile';

export default async function MasterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MasterProfile id={Number(id)} />;
}
