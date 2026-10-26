import { MasterInviteView } from '@/features/invite/InviteViews';

export const metadata = { title: 'Приглашение — eKor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MasterInviteView id={Number(id)} />;
}
