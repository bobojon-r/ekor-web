import { TasksFeed } from '@/features/tasks/TasksFeed';

export const metadata = { title: 'Задание — eKor' };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TasksFeed selectedId={Number(id)} />;
}
