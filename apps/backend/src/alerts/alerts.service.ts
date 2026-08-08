import { AlertMetric, AlertOperator, Prisma, Role } from '@prisma/client';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { AlertEventsQueryDto } from './dto/alert-events-query.dto';

const METRIC_LABEL: Record<AlertMetric, string> = {
  TEMPERATURE: 'Temperature',
  WIND_SPEED: 'Wind speed',
  HUMIDITY: 'Humidity',
  PRECIPITATION: 'Precipitation',
  PM25: 'PM2.5',
  PM10: 'PM10',
};

const METRIC_UNIT: Record<AlertMetric, string> = {
  TEMPERATURE: 'C',
  WIND_SPEED: 'km/h',
  HUMIDITY: '%',
  PRECIPITATION: 'mm',
  PM25: 'ug/m3',
  PM10: 'ug/m3',
};

const OPERATOR_LABEL: Record<AlertOperator, string> = {
  GT: '>',
  GTE: '>=',
  LT: '<',
  LTE: '<=',
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly weatherService: WeatherService,
  ) {}

  async listRules(userId: string) {
    return this.prisma.alertRule.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        city: {
          select: { id: true, name: true, countryCode: true, timezone: true },
        },
      },
    });
  }

  async createRule(userId: string, dto: CreateAlertRuleDto) {
    await this.ensureCityOnWatchlist(userId, dto.cityId);

    return this.prisma.alertRule.create({
      data: {
        userId,
        cityId: dto.cityId,
        metric: dto.metric,
        operator: dto.operator,
        threshold: dto.threshold,
      },
      include: {
        city: {
          select: { id: true, name: true, countryCode: true, timezone: true },
        },
      },
    });
  }

  async updateRule(
    userId: string,
    role: Role,
    ruleId: string,
    dto: UpdateAlertRuleDto,
  ) {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }

    if (rule.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('You can update only your own alert rules');
    }

    return this.prisma.alertRule.update({
      where: { id: ruleId },
      data: {
        metric: dto.metric,
        operator: dto.operator,
        threshold: dto.threshold,
        isActive: dto.isActive,
      },
      include: {
        city: {
          select: { id: true, name: true, countryCode: true, timezone: true },
        },
      },
    });
  }

  async deleteRule(userId: string, role: Role, ruleId: string) {
    const rule = await this.prisma.alertRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }

    if (rule.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException('You can delete only your own alert rules');
    }

    await this.prisma.alertRule.delete({ where: { id: ruleId } });

    return { success: true };
  }

  async listEvents(userId: string, query: AlertEventsQueryDto) {
    const limit = query.limit ?? 20;
    const unreadOnly = query.unreadOnly ?? true;

    return this.prisma.alertEvent.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: {
        city: {
          select: { id: true, name: true, countryCode: true, timezone: true },
        },
        rule: { select: { id: true, isActive: true } },
      },
    });
  }

  async markEventRead(userId: string, eventId: string) {
    const event = await this.prisma.alertEvent.findUnique({
      where: { id: eventId },
    });
    if (!event || event.userId !== userId) {
      throw new NotFoundException('Alert event not found');
    }

    return this.prisma.alertEvent.update({
      where: { id: eventId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllEventsRead(userId: string) {
    const result = await this.prisma.alertEvent.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { success: true, updated: result.count };
  }

  async evaluateRules() {
    const rules = await this.prisma.alertRule.findMany({
      where: { isActive: true },
      include: {
        city: { select: { id: true, name: true } },
      },
    });

    if (!rules.length) {
      return;
    }

    const cityIds = [...new Set(rules.map((rule) => rule.cityId))];
    const dashboardMap = new Map<
      string,
      Awaited<ReturnType<WeatherService['getDashboard']>>
    >();

    for (const cityId of cityIds) {
      try {
        const dashboard = await this.weatherService.getDashboard(cityId);
        dashboardMap.set(cityId, dashboard);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Skipping alert evaluation for city ${cityId}: ${message}`,
        );
      }
    }

    for (const rule of rules) {
      const dashboard = dashboardMap.get(rule.cityId);
      if (!dashboard) {
        continue;
      }

      try {
        await this.evaluateRule(rule, dashboard);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Skipping alert rule ${rule.id} for city ${rule.city.name}: ${message}`,
        );
      }
    }
  }

  private async evaluateRule(
    rule: Prisma.AlertRuleGetPayload<{
      include: { city: { select: { id: true; name: true } } };
    }>,
    dashboard: Awaited<ReturnType<WeatherService['getDashboard']>>,
  ) {
    const observedValue = this.extractMetricValue(dashboard, rule.metric);
    const evaluatedAt = new Date();

    if (observedValue == null || Number.isNaN(observedValue)) {
      await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          lastEvaluationValue: null,
          lastEvaluatedAt: evaluatedAt,
        },
      });
      return;
    }

    const conditionMet = this.evaluateOperator(
      observedValue,
      rule.operator,
      rule.threshold,
    );

    await this.prisma.$transaction(async (tx) => {
      if (!conditionMet) {
        await tx.alertRule.update({
          where: { id: rule.id },
          data: {
            lastEvaluationValue: observedValue,
            lastEvaluatedAt: evaluatedAt,
            lastConditionMet: false,
          },
        });
        return;
      }

      const transition = await tx.alertRule.updateMany({
        where: {
          id: rule.id,
          isActive: true,
          lastConditionMet: false,
        },
        data: {
          lastEvaluationValue: observedValue,
          lastEvaluatedAt: evaluatedAt,
          lastConditionMet: true,
          lastTriggeredAt: evaluatedAt,
        },
      });

      if (transition.count === 1) {
        await tx.alertEvent.create({
          data: {
            ruleId: rule.id,
            userId: rule.userId,
            cityId: rule.cityId,
            metric: rule.metric,
            operator: rule.operator,
            threshold: rule.threshold,
            observedValue,
            message: this.buildMessage(
              rule.city.name,
              rule.metric,
              rule.operator,
              rule.threshold,
              observedValue,
            ),
          },
        });
        return;
      }

      await tx.alertRule.update({
        where: { id: rule.id },
        data: {
          lastEvaluationValue: observedValue,
          lastEvaluatedAt: evaluatedAt,
        },
      });
    });
  }

  private async ensureCityOnWatchlist(userId: string, cityId: string) {
    const relation = await this.prisma.userCity.findUnique({
      where: { userId_cityId: { userId, cityId } },
      select: { userId: true },
    });

    if (!relation) {
      throw new ForbiddenException(
        'Alert can be created only for cities in your watchlist',
      );
    }
  }

  private evaluateOperator(
    value: number,
    operator: AlertOperator,
    threshold: number,
  ): boolean {
    if (operator === AlertOperator.GT) {
      return value > threshold;
    }
    if (operator === AlertOperator.GTE) {
      return value >= threshold;
    }
    if (operator === AlertOperator.LT) {
      return value < threshold;
    }

    return value <= threshold;
  }

  private extractMetricValue(
    dashboard: Awaited<ReturnType<WeatherService['getDashboard']>>,
    metric: AlertMetric,
  ): number | null {
    if (metric === AlertMetric.TEMPERATURE) {
      return dashboard.current.temperature ?? null;
    }

    if (metric === AlertMetric.WIND_SPEED) {
      return dashboard.current.windSpeed ?? null;
    }

    if (metric === AlertMetric.HUMIDITY) {
      return dashboard.current.humidity ?? null;
    }

    if (metric === AlertMetric.PRECIPITATION) {
      return dashboard.current.precipitation ?? null;
    }

    if (metric === AlertMetric.PM25) {
      return this.lastKnownValue(dashboard.airQuality.pm25);
    }

    if (metric === AlertMetric.PM10) {
      return this.lastKnownValue(dashboard.airQuality.pm10);
    }

    return null;
  }

  private lastKnownValue(values?: number[]): number | null {
    if (!values?.length) {
      return null;
    }

    for (let i = values.length - 1; i >= 0; i -= 1) {
      const value = values[i];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  private buildMessage(
    cityName: string,
    metric: AlertMetric,
    operator: AlertOperator,
    threshold: number,
    observedValue: number,
  ) {
    return `${cityName}: ${METRIC_LABEL[metric]} ${observedValue.toFixed(1)} ${METRIC_UNIT[metric]} (${OPERATOR_LABEL[operator]} ${threshold.toFixed(1)} ${METRIC_UNIT[metric]})`;
  }
}
