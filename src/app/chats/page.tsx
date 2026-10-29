import { redirect } from 'next/navigation';
import { ChatsView } from '@/features/chats/ChatsView';
import { CHAT } from '@/lib/features';

export const metadata = { title: 'Чаты — eKor' };

export default function Page() {
  if (!CHAT) redirect('/');
  return <ChatsView />;
}
