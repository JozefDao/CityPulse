import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSupportRequestDto) {
    return this.prisma.supportRequest.create({
      data: {
        senderId: userId,
        subject: dto.subject,
        message: dto.message,
      },
    });
  }
}
