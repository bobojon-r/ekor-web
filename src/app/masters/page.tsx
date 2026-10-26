import { MastersCatalog } from '@/features/masters/MastersCatalog';

export const metadata = { title: 'Мастера — eKor' };

export default async function MastersPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const { cat, q } = await searchParams;
  return <MastersCatalog key={`${cat ?? ''}|${q ?? ''}`} initialCat={cat} initialQ={q} />;
}
