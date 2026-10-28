import { notFound } from 'next/navigation';
import { Section } from '@/features/admin/AdminShell';
import { Staff } from '@/features/admin/screens/Staff';

/** 21 — редактирование сотрудника */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return (
    <Section k="staff">
      <Staff open={id} />
    </Section>
  );
}
