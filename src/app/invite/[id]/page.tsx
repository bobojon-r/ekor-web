import { MasterProfile } from '@/features/masters/MasterProfile';

export const metadata = { title: 'Предложить работу — eKor' };

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MasterProfile id={Number(id)} inviteOpen />;
}
