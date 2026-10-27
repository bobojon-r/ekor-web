import { Section } from '@/features/admin/AdminShell';
import { Users } from '@/features/admin/screens/Users';

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <Section k="users">
      <Users initialId={id ? +id : undefined} />
    </Section>
  );
}
