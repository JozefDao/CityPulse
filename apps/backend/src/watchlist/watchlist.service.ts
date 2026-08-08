import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWatchlistDto } from './dto/create-watchlist.dto';

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.userCity.findMany({
      where: { userId },
      include: { city: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async add(userId: string, dto: CreateWatchlistDto) {
    const cityId = await this.resolveCity(dto);

    const existing = await this.prisma.userCity.findUnique({
      where: { userId_cityId: { userId, cityId } },
      include: { city: true },
    });

    if (existing) {
      return existing;
    }

    const lastItem = await this.prisma.userCity.findFirst({
      where: { userId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    return this.prisma.userCity.create({
      data: { userId, cityId, sortOrder: (lastItem?.sortOrder ?? -1) + 1 },
      include: { city: true },
    });
  }

  async remove(userId: string, cityId: string) {
    await this.prisma.userCity.delete({
      where: { userId_cityId: { userId, cityId } },
    });
    return { ok: true };
  }

  async reorder(userId: string, cityIds: string[]) {
    const currentItems = await this.prisma.userCity.findMany({
      where: { userId },
      select: { cityId: true },
    });

    const currentCityIds = currentItems.map((item) => item.cityId).sort();
    const requestedCityIds = [...cityIds].sort();

    if (currentCityIds.length !== requestedCityIds.length || currentCityIds.some((cityId, index) => cityId !== requestedCityIds[index])) {
      throw new BadRequestException('Reorder payload must include exactly the current watchlist city IDs');
    }

    await this.prisma.$transaction(
      cityIds.map((cityId, index) =>
        this.prisma.userCity.update({
          where: { userId_cityId: { userId, cityId } },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.list(userId);
  }

  private async resolveCity(dto: CreateWatchlistDto) {
    if (dto.cityId) {
      const existing = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!existing) {
        throw new NotFoundException('City not found');
      }
      return existing.id;
    }

    if (
      !dto.name ||
      dto.lat === undefined ||
      dto.lon === undefined ||
      !dto.timezone
    ) {
      throw new BadRequestException('Missing city data');
    }

    const city = await this.prisma.city.create({
      data: {
        name: dto.name,
        countryCode: dto.countryCode,
        lat: dto.lat,
        lon: dto.lon,
        timezone: dto.timezone,
      },
    });

    return city.id;
  }
}
