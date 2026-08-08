import { AlertMetric, AlertOperator } from '@prisma/client';
import { AlertsService } from './alerts.service';

const rule = (id: string) => ({
  id,
  userId: 'user-1',
  cityId: 'city-1',
  metric: AlertMetric.TEMPERATURE,
  operator: AlertOperator.GTE,
  threshold: 20,
  isActive: true,
  lastConditionMet: false,
  lastEvaluationValue: null,
  lastEvaluatedAt: null,
  lastTriggeredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  city: { id: 'city-1', name: 'Bratislava' },
});

const dashboard = {
  current: {
    temperature: 22,
    windSpeed: null,
    humidity: null,
    precipitation: null,
  },
  hourly: {},
  daily: {},
  airQuality: {},
};

type AlertRuleUpdateManyInput = {
  where: {
    id: string;
    isActive: boolean;
    lastConditionMet: boolean;
  };
  data: {
    lastEvaluationValue: number;
    lastEvaluatedAt: Date;
    lastConditionMet: boolean;
    lastTriggeredAt?: Date;
  };
};

type AlertRuleUpdateInput = {
  where: { id: string };
  data: {
    lastEvaluationValue?: number | null;
    lastEvaluatedAt?: Date;
    lastConditionMet?: boolean;
  };
};

type AlertEventCreateInput = {
  data: { ruleId: string } & Record<string, unknown>;
};

describe('AlertsService.evaluateRules', () => {
  const createHarness = () => {
    const transactionClient = {
      alertRule: {
        update: jest.fn<Promise<unknown>, [AlertRuleUpdateInput]>(),
        updateMany: jest.fn<
          Promise<{ count: number }>,
          [AlertRuleUpdateManyInput]
        >(),
      },
      alertEvent: {
        create: jest.fn<Promise<unknown>, [AlertEventCreateInput]>(),
      },
    };
    const prisma = {
      alertRule: {
        findMany: jest.fn<Promise<Array<ReturnType<typeof rule>>>, []>(),
        update: jest.fn<Promise<unknown>, [AlertRuleUpdateInput]>(),
      },
      $transaction: jest.fn(
        (callback: (client: typeof transactionClient) => Promise<unknown>) =>
          callback(transactionClient),
      ),
    };
    const weatherService = {
      getDashboard: jest.fn<Promise<typeof dashboard>, [string]>(),
    };
    weatherService.getDashboard.mockResolvedValue(dashboard);

    return {
      service: new AlertsService(prisma as never, weatherService as never),
      prisma,
      transactionClient,
    };
  };

  it('creates one event inside the false-to-true transition transaction', async () => {
    const { service, prisma, transactionClient } = createHarness();
    prisma.alertRule.findMany.mockResolvedValue([rule('rule-1')]);
    transactionClient.alertRule.updateMany.mockResolvedValue({ count: 1 });

    await service.evaluateRules();

    const [transitionInput] =
      transactionClient.alertRule.updateMany.mock.calls[0];
    const [eventInput] = transactionClient.alertEvent.create.mock.calls[0];

    expect(transitionInput.where).toEqual({
      id: 'rule-1',
      isActive: true,
      lastConditionMet: false,
    });
    expect(eventInput.data.ruleId).toBe('rule-1');
  });

  it('does not create a duplicate event when another invocation already transitioned the rule', async () => {
    const { service, prisma, transactionClient } = createHarness();
    prisma.alertRule.findMany.mockResolvedValue([rule('rule-1')]);
    transactionClient.alertRule.updateMany.mockResolvedValue({ count: 0 });
    transactionClient.alertRule.update.mockResolvedValue({});

    await service.evaluateRules();

    const [evaluationUpdate] = transactionClient.alertRule.update.mock.calls[0];

    expect(transactionClient.alertEvent.create).not.toHaveBeenCalled();
    expect(evaluationUpdate).toMatchObject({
      where: { id: 'rule-1' },
      data: { lastEvaluationValue: 22 },
    });
  });

  it('continues evaluating remaining rules when one rule write fails', async () => {
    const { service, prisma, transactionClient } = createHarness();
    prisma.alertRule.findMany.mockResolvedValue([
      rule('rule-1'),
      rule('rule-2'),
    ]);
    transactionClient.alertRule.updateMany.mockImplementation(({ where }) => {
      if (where.id === 'rule-1') {
        return Promise.reject(new Error('write failed'));
      }

      return Promise.resolve({ count: 1 });
    });

    await expect(service.evaluateRules()).resolves.toBeUndefined();

    const [eventInput] = transactionClient.alertEvent.create.mock.calls[0];
    expect(eventInput.data.ruleId).toBe('rule-2');
  });
});
