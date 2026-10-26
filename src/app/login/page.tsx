import { LoginView } from '@/features/auth/LoginView';

export const metadata = { title: 'Вход — eKor' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginView next={next} />;
}
