import { JobsController } from './jobs.controller';

describe('JobsController', () => {
  it('runs the weather job through its dedicated lease', async () => {
    const jobLease = {
      runExclusive: jest.fn(
        async (_name: string, task: () => Promise<void>) => ({
          acquired: true as const,
          value: await task(),
        }),
      ),
    };
    const weatherScheduler = {
      refreshSnapshots: jest.fn().mockResolvedValue(undefined),
    };
    const alertsScheduler = { evaluateRules: jest.fn() };
    const controller = new JobsController(
      jobLease as never,
      weatherScheduler as never,
      alertsScheduler as never,
    );

    await expect(controller.refreshWeather()).resolves.toEqual({
      status: 'completed',
    });

    expect(jobLease.runExclusive).toHaveBeenCalledWith(
      'weather-refresh',
      expect.any(Function),
    );
    expect(weatherScheduler.refreshSnapshots).toHaveBeenCalledTimes(1);
    expect(alertsScheduler.evaluateRules).not.toHaveBeenCalled();
  });

  it('reports an occupied alert lease as skipped', async () => {
    const jobLease = {
      runExclusive: jest.fn().mockResolvedValue({ acquired: false }),
    };
    const weatherScheduler = { refreshSnapshots: jest.fn() };
    const alertsScheduler = { evaluateRules: jest.fn() };
    const controller = new JobsController(
      jobLease as never,
      weatherScheduler as never,
      alertsScheduler as never,
    );

    await expect(controller.evaluateAlerts()).resolves.toEqual({
      status: 'skipped_locked',
    });
    expect(alertsScheduler.evaluateRules).not.toHaveBeenCalled();
  });
});
