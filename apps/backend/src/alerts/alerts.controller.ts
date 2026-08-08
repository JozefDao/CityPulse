import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { AlertEventsQueryDto } from './dto/alert-events-query.dto';

type RequestUser = {
  id: string;
  email: string;
  role: Role;
};

type RequestWithUser = Request & { user?: RequestUser };

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('rules')
  async listRules(@Req() req: RequestWithUser) {
    const user = req.user as RequestUser;
    return this.alertsService.listRules(user.id);
  }

  @Post('rules')
  async createRule(
    @Req() req: RequestWithUser,
    @Body() dto: CreateAlertRuleDto,
  ) {
    const user = req.user as RequestUser;
    return this.alertsService.createRule(user.id, dto);
  }

  @Patch('rules/:ruleId')
  async updateRule(
    @Req() req: RequestWithUser,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    const user = req.user as RequestUser;
    return this.alertsService.updateRule(user.id, user.role, ruleId, dto);
  }

  @Delete('rules/:ruleId')
  async deleteRule(
    @Req() req: RequestWithUser,
    @Param('ruleId') ruleId: string,
  ) {
    const user = req.user as RequestUser;
    return this.alertsService.deleteRule(user.id, user.role, ruleId);
  }

  @Get('events')
  async listEvents(
    @Req() req: RequestWithUser,
    @Query() query: AlertEventsQueryDto,
  ) {
    const user = req.user as RequestUser;
    return this.alertsService.listEvents(user.id, query);
  }

  @Patch('events/:eventId/read')
  async markEventRead(
    @Req() req: RequestWithUser,
    @Param('eventId') eventId: string,
  ) {
    const user = req.user as RequestUser;
    return this.alertsService.markEventRead(user.id, eventId);
  }

  @Post('events/read-all')
  async markAllRead(@Req() req: RequestWithUser) {
    const user = req.user as RequestUser;
    return this.alertsService.markAllEventsRead(user.id);
  }
}
