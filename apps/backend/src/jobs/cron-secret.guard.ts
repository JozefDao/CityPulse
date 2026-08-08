import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedSecret = this.config.get<string>('CRON_SECRET');
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    const providedSecret = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

    if (
      !expectedSecret ||
      !providedSecret ||
      !this.matchesSecret(providedSecret, expectedSecret)
    ) {
      throw new UnauthorizedException('Invalid cron credentials');
    }

    return true;
  }

  private matchesSecret(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }
}
