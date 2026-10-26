import { ChatsView } from '@/features/chats/ChatsView';

export const metadata = { title: 'Чат — eKor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatsView openId={id} />;
}
