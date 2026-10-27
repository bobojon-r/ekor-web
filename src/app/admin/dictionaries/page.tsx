import { Section } from '@/features/admin/AdminShell';
import { Dictionaries } from '@/features/admin/screens/Dictionaries';

export default function Page() {
  return (
    <Section k="dicts">
      <Dictionaries />
    </Section>
  );
}
