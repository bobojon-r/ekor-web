import { Section } from '@/features/admin/AdminShell';
import { Complaints } from '@/features/admin/screens/Complaints';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Section k="chats">
      <Complaints openId={decodeURIComponent(id)} />
    </Section>
  );
}
