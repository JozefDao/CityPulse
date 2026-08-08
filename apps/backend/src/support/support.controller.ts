import {
  Body,
  Controller,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportService } from './support.service';

type RequestUser = {
  id: string;
  email: string;
  nickname: string;
  role: 'USER' | 'ADMIN';
};

type RequestWithUser = Request & { user?: RequestUser };

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateSupportRequestDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.supportService.create(user.id, dto);
  }
}
