import { Section } from '@/features/admin/AdminShell';
import { TasksQueue } from '@/features/admin/screens/TasksQueue';

export default function Page() {
  return (
    <Section k="tasks">
      <TasksQueue />
    </Section>
  );
}
