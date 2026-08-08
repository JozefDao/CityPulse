import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  ParseFilePipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMePasswordDto } from './dto/update-me-password.dto';

type RequestUser = {
  id: string;
  email: string;
  role: Role;
};

type RequestWithUser = Request & { user?: RequestUser };

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  async me(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.meService.getMe(user.id);
  }

  @Patch()
  async updateMe(@Req() req: RequestWithUser, @Body() dto: UpdateMeDto) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.meService.updateMe(user.id, dto);
  }

  @Patch('password')
  async updatePassword(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateMePasswordDto,
  ) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.meService.updatePassword(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  async uploadAvatar(
    @Req() req: RequestWithUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 4 * 1024 * 1024 })],
      }),
    )
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.meService.uploadAvatar(user.id, file);
  }

  @Delete('avatar')
  async removeAvatar(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.meService.removeAvatar(user.id);
  }
}
