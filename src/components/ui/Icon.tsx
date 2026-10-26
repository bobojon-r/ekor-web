import {
  CircleEllipsis, Droplets, GraduationCap, HardHat, Laptop, PaintRoller, PartyPopper, Scissors, Sparkle, Sparkles, Truck, WashingMachine, Wrench, Zap,
  type LucideIcon, type LucideProps,
} from 'lucide-react';

/** Иконки категорий приходят из API по имени Lucide */
const MAP: Record<string, LucideIcon> = { CircleEllipsis, Droplets, GraduationCap, HardHat, Laptop, PaintRoller, PartyPopper, Scissors, Sparkle, Sparkles, Truck, WashingMachine, Wrench, Zap };

export function Icon({ name, ...rest }: { name: string } & LucideProps) {
  const C = MAP[name] ?? Wrench;
  return <C aria-hidden {...rest} />;
}
