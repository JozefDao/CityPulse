import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateMePasswordDto } from './dto/update-me-password.dto';

const AVATAR_PUBLIC_ID_PREFIX = 'citypulse/avatars';
const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const LOCAL_AVATAR_URL_PREFIX = '/uploads/avatars/';
const LOCAL_AVATAR_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

type AvatarStorage = 'cloudinary' | 'local';

@Injectable()
export class MeService {
  private readonly avatarStorage: AvatarStorage;

  constructor(private readonly prisma: PrismaService) {
    this.avatarStorage = this.resolveAvatarStorage();
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!current) {
      throw new UnauthorizedException('User not found');
    }

    const data: {
      nickname?: string;
      bio?: string | null;
    } = {};

    if (typeof dto.nickname === 'string') {
      const normalizedNickname = dto.nickname.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { nickname: normalizedNickname },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Nickname already in use');
      }
      data.nickname = normalizedNickname;
    }

    if (typeof dto.bio === 'string') {
      const bio = dto.bio.trim();
      data.bio = bio.length > 0 ? bio : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async updatePassword(userId: string, dto: UpdateMePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordOk = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordOk) {
      throw new UnauthorizedException('Current password is invalid');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true };
  }

  async uploadAvatar(
    userId: string,
    file: { mimetype: string; buffer: Buffer },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only JPG, PNG or WEBP images are allowed');
    }

    const avatarUrl =
      this.avatarStorage === 'local'
        ? await this.uploadAvatarLocally(userId, file)
        : await this.uploadAvatarToCloudinary(userId, file.buffer);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        nickname: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (this.avatarStorage === 'local') {
      await this.removeLocalAvatar(userId);
    } else {
      await cloudinary.uploader.destroy(this.avatarPublicId(userId), {
        resource_type: 'image',
        invalidate: true,
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return { success: true };
  }

  private avatarPublicId(userId: string) {
    return `${AVATAR_PUBLIC_ID_PREFIX}/${userId}`;
  }

  private resolveAvatarStorage(): AvatarStorage {
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();

    if (!cloudinaryUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CLOUDINARY_URL is required when NODE_ENV=production');
      }

      if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
        throw new Error(
          'CLOUDINARY_URL is required unless NODE_ENV=development',
        );
      }

      return 'local';
    }

    this.configureCloudinary(cloudinaryUrl);

    return 'cloudinary';
  }

  private configureCloudinary(cloudinaryUrl: string) {
    this.assertValidCloudinaryUrl(cloudinaryUrl);

    // The Cloudinary SDK reads CLOUDINARY_URL while its modules are imported.
    // Reload it here, after Nest's ConfigModule has loaded .env.
    cloudinary.config(true);
  }

  private assertValidCloudinaryUrl(cloudinaryUrl: string) {
    let parsed: URL;

    try {
      parsed = new URL(cloudinaryUrl);
    } catch {
      throw new Error('CLOUDINARY_URL must be a valid Cloudinary URL');
    }

    if (
      parsed.protocol !== 'cloudinary:' ||
      !parsed.hostname ||
      !parsed.username ||
      !parsed.password
    ) {
      throw new Error(
        'CLOUDINARY_URL must include cloud name, API key and API secret',
      );
    }
  }

  private localAvatarDirectory() {
    return join(process.cwd(), 'uploads', 'avatars');
  }

  private localAvatarFilePath(userId: string, extension: string) {
    return join(this.localAvatarDirectory(), `${userId}.${extension}`);
  }

  private async uploadAvatarLocally(
    userId: string,
    file: { mimetype: string; buffer: Buffer },
  ) {
    const extension =
      LOCAL_AVATAR_EXTENSIONS[
        file.mimetype as keyof typeof LOCAL_AVATAR_EXTENSIONS
      ];

    await mkdir(this.localAvatarDirectory(), { recursive: true });
    await writeFile(this.localAvatarFilePath(userId, extension), file.buffer);

    await Promise.all(
      Object.values(LOCAL_AVATAR_EXTENSIONS)
        .filter((candidateExtension) => candidateExtension !== extension)
        .map((candidateExtension) =>
          this.removeLocalAvatarFile(userId, candidateExtension),
        ),
    );

    return `${LOCAL_AVATAR_URL_PREFIX}${userId}.${extension}`;
  }

  private async removeLocalAvatar(userId: string) {
    await Promise.all(
      Object.values(LOCAL_AVATAR_EXTENSIONS).map((extension) =>
        this.removeLocalAvatarFile(userId, extension),
      ),
    );
  }

  private async removeLocalAvatarFile(userId: string, extension: string) {
    try {
      await unlink(this.localAvatarFilePath(userId, extension));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async uploadAvatarToCloudinary(userId: string, buffer: Buffer) {
    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: this.avatarPublicId(userId),
          overwrite: true,
          invalidate: true,
        },
        (error, result) => {
          if (error) {
            const uploadError: Error =
              error instanceof Error ? error : new Error(error.message);
            reject(uploadError);
            return;
          }

          if (!result?.secure_url) {
            reject(new Error('Cloudinary upload did not return a secure URL'));
            return;
          }

          resolve(result.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }
}
