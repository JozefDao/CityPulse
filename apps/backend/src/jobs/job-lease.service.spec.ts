import { JobLeaseService } from './job-lease.service';

type JobLeaseCreateManyInput = {
  data: { name: string };
  skipDuplicates: boolean;
};

type JobLeaseUpdateManyInput = {
  where: {
    name: string;
    token?: string;
    OR?: Array<{ expiresAt: null } | { expiresAt: { lte: Date } }>;
  };
  data: { token: string | null; expiresAt: Date | null };
};

describe('JobLeaseService', () => {
  const createHarness = () => {
    const createMany = jest.fn<Promise<unknown>, [JobLeaseCreateManyInput]>();
    const updateMany = jest.fn<
      Promise<{ count: number }>,
      [JobLeaseUpdateManyInput]
    >();
    const prisma = {
      jobLease: { createMany, updateMany },
    };

    return {
      prisma,
      service: new JobLeaseService(prisma as never),
    };
  };

  it('runs a task while owning a lease and releases only its own token', async () => {
    const { prisma, service } = createHarness();
    prisma.jobLease.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const task = jest.fn<Promise<string>, []>().mockResolvedValue('done');

    await expect(
      service.runExclusive('weather-refresh', task),
    ).resolves.toEqual({
      acquired: true,
      value: 'done',
    });

    expect(prisma.jobLease.createMany).toHaveBeenCalledWith({
      data: { name: 'weather-refresh' },
      skipDuplicates: true,
    });
    expect(task).toHaveBeenCalledTimes(1);

    const [acquireInput] = prisma.jobLease.updateMany.mock.calls[0];
    const [releaseInput] = prisma.jobLease.updateMany.mock.calls[1];

    expect(typeof acquireInput.data.token).toBe('string');
    expect(releaseInput).toEqual({
      where: { name: 'weather-refresh', token: acquireInput.data.token },
      data: { token: null, expiresAt: null },
    });
  });

  it('does not run or release when another invocation owns the lease', async () => {
    const { prisma, service } = createHarness();
    prisma.jobLease.updateMany.mockResolvedValue({ count: 0 });
    const task = jest.fn<Promise<void>, []>();

    await expect(
      service.runExclusive('alerts-evaluate', task),
    ).resolves.toEqual({
      acquired: false,
    });

    expect(task).not.toHaveBeenCalled();
    expect(prisma.jobLease.updateMany).toHaveBeenCalledTimes(1);
  });
});
