import { Shell } from '@/components/layout';
import { FullState } from '@/features/system/SystemStates';

export default function NotFound() {
  return (
    <Shell>
      <FullState kind="notfound" />
    </Shell>
  );
}
