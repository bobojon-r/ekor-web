import { Section } from '@/features/admin/AdminShell';
import { Audit } from '@/features/admin/screens/Audit';

export default function Page() {
  return (
    <Section k="audit">
      <Audit />
    </Section>
  );
}
