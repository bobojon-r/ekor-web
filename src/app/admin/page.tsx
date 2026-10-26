import { AdminPanel } from '@/features/admin/AdminPanel';

export const metadata = { title: 'Админ-панель — eKor', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminPanel />;
}
