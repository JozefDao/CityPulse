import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ScrollAreaProps = HTMLAttributes<HTMLDivElement>;

export function ScrollArea({ className, ...props }: ScrollAreaProps) {
  return <div className={cn('overflow-y-auto', className)} {...props} />;
}
