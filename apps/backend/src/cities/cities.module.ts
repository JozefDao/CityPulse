import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';

@Module({
  imports: [HttpModule, PrismaModule],
  controllers: [CitiesController],
  providers: [CitiesService],
})
export class CitiesModule {}
