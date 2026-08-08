import { cn } from '../../lib/utils';

type SeparatorProps = {
  className?: string;
};

export function Separator({ className }: SeparatorProps) {
  return <div aria-hidden className={cn('h-px w-full bg-border', className)} />;
}
