import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CronSecretGuard } from './cron-secret.guard';

describe('CronSecretGuard', () => {
  const contextWithAuthorization = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          header: (name: string) =>
            name === 'authorization' ? authorization : undefined,
        }),
      }),
    }) as ExecutionContext;

  it('accepts an exact Bearer CRON_SECRET', () => {
    const guard = new CronSecretGuard({
      get: jest.fn().mockReturnValue('cron-secret'),
    } as never);

    expect(
      guard.canActivate(contextWithAuthorization('Bearer cron-secret')),
    ).toBe(true);
  });

  it('rejects missing, invalid, and unconfigured credentials', () => {
    const guard = new CronSecretGuard({
      get: jest.fn().mockReturnValue('cron-secret'),
    } as never);

    expect(() => guard.canActivate(contextWithAuthorization())).toThrow(
      UnauthorizedException,
    );
    expect(() =>
      guard.canActivate(contextWithAuthorization('Bearer wrong-secret')),
    ).toThrow(UnauthorizedException);

    const unconfiguredGuard = new CronSecretGuard({
      get: jest.fn().mockReturnValue(undefined),
    } as never);
    expect(() =>
      unconfiguredGuard.canActivate(
        contextWithAuthorization('Bearer cron-secret'),
      ),
    ).toThrow(UnauthorizedException);
  });
});
