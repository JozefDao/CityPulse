jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

import { v2 as cloudinary } from 'cloudinary';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MeService } from './me.service';

type UserFindUniqueInput = {
  where: { id: string };
  select?: Record<string, boolean>;
};

type UserUpdateInput = {
  where: { id: string };
  data: { avatarUrl?: string | null };
  select?: Record<string, boolean>;
};

type CloudinaryUploadOptions = {
  resource_type: 'image';
  public_id: string;
  overwrite: boolean;
  invalidate: boolean;
};

type CloudinaryUploadCallback = (
  error?: Error,
  result?: { secure_url?: string },
) => void;

type CloudinaryUploadStream = { end: (buffer: Buffer) => void };

const uploader = cloudinary.uploader as unknown as {
  upload_stream: jest.Mock<
    CloudinaryUploadStream,
    [CloudinaryUploadOptions, CloudinaryUploadCallback]
  >;
  destroy: jest.Mock<
    Promise<{ result: string }>,
    [string, { resource_type: 'image'; invalidate: boolean }]
  >;
};
const configureCloudinary = cloudinary.config as jest.Mock;

describe('MeService avatar storage', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCloudinaryUrl = process.env.CLOUDINARY_URL;
  let testDirectory: string | undefined;
  let cwdSpy: jest.SpyInstance<string, []> | undefined;

  const createHarness = () => {
    const prisma = {
      user: {
        findUnique: jest.fn<Promise<unknown>, [UserFindUniqueInput]>(),
        update: jest.fn<Promise<unknown>, [UserUpdateInput]>(),
      },
    };

    return {
      prisma,
      service: new MeService(prisma as never),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'development';
    delete process.env.CLOUDINARY_URL;
  });

  afterEach(async () => {
    cwdSpy?.mockRestore();
    cwdSpy = undefined;
    if (testDirectory) {
      await rm(testDirectory, { recursive: true, force: true });
      testDirectory = undefined;
    }

    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalCloudinaryUrl === undefined) {
      delete process.env.CLOUDINARY_URL;
    } else {
      process.env.CLOUDINARY_URL = originalCloudinaryUrl;
    }
  });

  it('uploads the memory buffer under the deterministic public ID and persists secure_url', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@citypulse';
    const { prisma, service } = createHarness();
    const buffer = Buffer.from('avatar-image');
    const secureUrl =
      'https://res.cloudinary.com/citypulse/image/upload/v1/citypulse/avatars/user-1.webp';
    let uploadCallback!: CloudinaryUploadCallback;
    const end = jest.fn<void, [Buffer]>(() => {
      uploadCallback(undefined, { secure_url: secureUrl });
    });

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      avatarUrl: secureUrl,
    });
    uploader.upload_stream.mockImplementation((_options, callback) => {
      uploadCallback = callback;
      return { end };
    });

    await expect(
      service.uploadAvatar('user-1', { mimetype: 'image/webp', buffer }),
    ).resolves.toEqual({ id: 'user-1', avatarUrl: secureUrl });

    expect(uploader.upload_stream).toHaveBeenCalledWith(
      {
        resource_type: 'image',
        public_id: 'citypulse/avatars/user-1',
        overwrite: true,
        invalidate: true,
      },
      expect.any(Function),
    );
    expect(end).toHaveBeenCalledWith(buffer);
    expect(configureCloudinary).toHaveBeenCalledWith(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { avatarUrl: secureUrl },
      }),
    );
  });

  it('destroys the deterministic asset before clearing the database URL', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@citypulse';
    const { prisma, service } = createHarness();
    const callOrder: string[] = [];

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    uploader.destroy.mockImplementation(() => {
      callOrder.push('destroy');
      return Promise.resolve({ result: 'ok' });
    });
    prisma.user.update.mockImplementation(() => {
      callOrder.push('update');
      return Promise.resolve({});
    });

    await expect(service.removeAvatar('user-1')).resolves.toEqual({
      success: true,
    });

    expect(uploader.destroy).toHaveBeenCalledWith('citypulse/avatars/user-1', {
      resource_type: 'image',
      invalidate: true,
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: null },
    });
    expect(callOrder).toEqual(['destroy', 'update']);
  });

  it('does not update the database when Cloudinary upload fails', async () => {
    process.env.CLOUDINARY_URL = 'cloudinary://key:secret@citypulse';
    const { prisma, service } = createHarness();
    const uploadError = new Error('Cloudinary unavailable');

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    uploader.upload_stream.mockImplementation((_options, callback) => ({
      end: () => {
        callback(uploadError);
      },
    }));

    await expect(
      service.uploadAvatar('user-1', {
        mimetype: 'image/png',
        buffer: Buffer.from('avatar-image'),
      }),
    ).rejects.toThrow(uploadError);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('stores avatars locally in development when CLOUDINARY_URL is absent', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'citypulse-avatar-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(testDirectory);
    const avatarsDirectory = join(testDirectory, 'uploads', 'avatars');
    await mkdir(avatarsDirectory, { recursive: true });
    await writeFile(join(avatarsDirectory, 'user-1.jpg'), 'old-avatar');
    const { prisma, service } = createHarness();
    const buffer = Buffer.from('avatar-image');

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      avatarUrl: '/uploads/avatars/user-1.png',
    });

    await expect(
      service.uploadAvatar('user-1', { mimetype: 'image/png', buffer }),
    ).resolves.toEqual({
      id: 'user-1',
      avatarUrl: '/uploads/avatars/user-1.png',
    });

    await expect(
      readFile(join(testDirectory, 'uploads', 'avatars', 'user-1.png')),
    ).resolves.toEqual(buffer);
    await expect(
      readFile(join(avatarsDirectory, 'user-1.jpg')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(uploader.upload_stream).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { avatarUrl: '/uploads/avatars/user-1.png' },
      }),
    );
  });

  it('removes local avatar files before clearing the database URL', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'citypulse-avatar-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(testDirectory);
    const avatarsDirectory = join(testDirectory, 'uploads', 'avatars');
    await mkdir(avatarsDirectory, { recursive: true });
    await writeFile(join(avatarsDirectory, 'user-1.jpg'), 'old-avatar');
    const { prisma, service } = createHarness();

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prisma.user.update.mockResolvedValue({});

    await expect(service.removeAvatar('user-1')).resolves.toEqual({
      success: true,
    });

    await expect(
      readFile(join(avatarsDirectory, 'user-1.jpg')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(uploader.destroy).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: null },
    });
  });

  it('never enables local avatar storage in production without CLOUDINARY_URL', () => {
    process.env.NODE_ENV = 'production';

    expect(() => createHarness()).toThrow(
      'CLOUDINARY_URL is required when NODE_ENV=production',
    );
  });

  it('fails fast in production when CLOUDINARY_URL is malformed', () => {
    process.env.NODE_ENV = 'production';
    process.env.CLOUDINARY_URL = 'not-a-cloudinary-url';

    expect(() => createHarness()).toThrow(
      'CLOUDINARY_URL must be a valid Cloudinary URL',
    );
  });
});
