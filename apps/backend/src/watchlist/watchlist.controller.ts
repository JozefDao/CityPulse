import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';
import { ReorderWatchlistDto } from './dto/reorder-watchlist.dto';
import { WatchlistService } from './watchlist.service';

type RequestUser = {
  id: string;
  email: string;
  role: string;
};

@ApiTags('watchlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = req.user as RequestUser;
    return this.watchlistService.list(user.id);
  }

  @Post()
  async add(@Req() req: Request, @Body() dto: CreateWatchlistDto) {
    const user = req.user as RequestUser;
    return this.watchlistService.add(user.id, dto);
  }

  @Patch('reorder')
  async reorder(@Req() req: Request, @Body() dto: ReorderWatchlistDto) {
    const user = req.user as RequestUser;
    return this.watchlistService.reorder(user.id, dto.cityIds);
  }

  @Delete(':cityId')
  async remove(@Req() req: Request, @Param('cityId') cityId: string) {
    const user = req.user as RequestUser;
    return this.watchlistService.remove(user.id, cityId);
  }
}
