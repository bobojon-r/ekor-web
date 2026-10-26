import { ClientCabinet } from '@/features/client/ClientCabinet';

export const metadata = { title: 'Моё задание — eKor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientCabinet selectedId={Number(id)} />;
}
