import { ManageTask } from '@/features/manage/ManageTask';

export const metadata = { title: 'Моё задание — eKor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageTask id={Number(id)} />;
}
