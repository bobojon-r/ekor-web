import { Section } from '@/features/admin/AdminShell';
import { Complaints } from '@/features/admin/screens/Complaints';

export default function Page() {
  return (
    <Section k="chats">
      <Complaints />
    </Section>
  );
}
