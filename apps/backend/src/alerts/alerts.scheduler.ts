import { Injectable, Logger } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Injectable()
export class AlertsScheduler {
  private readonly logger = new Logger(AlertsScheduler.name);

  constructor(private readonly alertsService: AlertsService) {}

  async evaluateRules() {
    try {
      await this.alertsService.evaluateRules();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Alert evaluation failed: ${message}`);
      throw error;
    }
  }
}
