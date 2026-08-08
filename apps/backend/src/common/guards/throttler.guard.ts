import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard as BaseThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

@Injectable()
export class ThrottlerGuard extends BaseThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? request.url ?? '';
    if (path.startsWith('/api/docs')) {
      return true;
    }
    if (path.startsWith('/api/docs-json')) {
      return true;
    }
    return super.shouldSkip(context);
  }
}
