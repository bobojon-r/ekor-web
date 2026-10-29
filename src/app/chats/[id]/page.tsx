import { redirect } from 'next/navigation';
import { ChatsView } from '@/features/chats/ChatsView';
import { CHAT } from '@/lib/features';

export const metadata = { title: 'Чат — eKor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!CHAT) redirect('/');
  const { id } = await params;
  return <ChatsView openId={id} />;
}
