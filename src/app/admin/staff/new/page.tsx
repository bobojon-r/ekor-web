import { Section } from '@/features/admin/AdminShell';
import { Staff } from '@/features/admin/screens/Staff';

/** 20 — добавить сотрудника */
export default function Page() {
  return (
    <Section k="staff">
      <Staff open="new" />
    </Section>
  );
}
