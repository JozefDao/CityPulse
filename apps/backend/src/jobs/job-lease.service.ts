import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type JobLeaseName = 'weather-refresh' | 'alerts-evaluate';

export type JobLeaseResult<T> =
  | { acquired: true; value: T }
  | { acquired: false };

@Injectable()
export class JobLeaseService {
  private static readonly LEASE_MS = 330_000;

  constructor(private readonly prisma: PrismaService) {}

  async runExclusive<T>(
    name: JobLeaseName,
    task: () => Promise<T>,
  ): Promise<JobLeaseResult<T>> {
    const token = randomUUID();
    const acquired = await this.tryAcquire(name, token);

    if (!acquired) {
      return { acquired: false };
    }

    try {
      return { acquired: true, value: await task() };
    } finally {
      await this.release(name, token);
    }
  }

  private async tryAcquire(
    name: JobLeaseName,
    token: string,
  ): Promise<boolean> {
    await this.prisma.jobLease.createMany({
      data: { name },
      skipDuplicates: true,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + JobLeaseService.LEASE_MS);
    const result = await this.prisma.jobLease.updateMany({
      where: {
        name,
        OR: [{ expiresAt: null }, { expiresAt: { lte: now } }],
      },
      data: { token, expiresAt },
    });

    return result.count === 1;
  }

  private async release(name: JobLeaseName, token: string): Promise<void> {
    await this.prisma.jobLease.updateMany({
      where: { name, token },
      data: { token: null, expiresAt: null },
    });
  }
}
