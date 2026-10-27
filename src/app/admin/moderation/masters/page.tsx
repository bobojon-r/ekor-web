import { Section } from '@/features/admin/AdminShell';
import { MastersQueue } from '@/features/admin/screens/MastersQueue';

export default function Page() {
  return (
    <Section k="masters">
      <MastersQueue />
    </Section>
  );
}
