import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type EmptyStateCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
  footer?: ReactNode;
};

export function EmptyStateCard({ title, description, action, footer }: EmptyStateCardProps) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
        {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
