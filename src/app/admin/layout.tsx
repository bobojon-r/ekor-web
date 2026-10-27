import type { Metadata } from 'next';
// JetBrains Mono — ID, время и числа в таблицах админки
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import { AdminShell } from '@/features/admin/AdminShell';

export const metadata: Metadata = { title: 'eKor admin', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
