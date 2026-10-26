import { ClientInviteView } from '@/features/invite/InviteViews';

export const metadata = { title: 'Моё задание — eKor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientInviteView id={Number(id)} />;
}
