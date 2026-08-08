import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { Role } from '@prisma/client';
import type { StringValue } from 'ms';

type TokenUser = {
  id: string;
  email: string;
  nickname: string;
  role: Role;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  user: TokenUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingByEmail) {
      throw new ConflictException('Email already in use');
    }

    const normalizedNickname = dto.nickname.trim().toLowerCase();
    const existingByNickname = await this.prisma.user.findUnique({
      where: { nickname: normalizedNickname },
    });
    if (existingByNickname) {
      throw new ConflictException('Nickname already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        nickname: normalizedNickname,
        passwordHash,
        role: Role.USER,
      },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken?: string): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_REFRESH_SECRET is required to verify refresh tokens',
      );
    }
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, userId: payload.sub },
    });
    if (!stored) {
      throw new UnauthorizedException('Refresh token not found');
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  private async issueTokens(user: TokenUser): Promise<AuthResult> {
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is required to issue access tokens');
    }

    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is required to issue refresh tokens');
    }

    const accessExpiresIn = (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      '15m') as StringValue;

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
      { secret: accessSecret, expiresIn: accessExpiresIn },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      { secret: refreshSecret, expiresIn: '7d' },
    );

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.parseDurationToSeconds(accessExpiresIn),
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }

  private parseDurationToSeconds(value: string): number {
    const match = value.trim().match(/^(\d+)([smhd])?$/i);
    if (!match) {
      return 900;
    }

    const amount = Number(match[1]);
    const unit = (match[2] ?? 's').toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return amount * (multipliers[unit] ?? 1);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
