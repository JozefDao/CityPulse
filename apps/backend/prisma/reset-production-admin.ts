import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const KEEP_ARTICLE_SLUGS = [
  'bratislava-riverfront-run-best-weekday-windows',
  'prague-old-town-weekend-walk-rain-crowds',
  'vienna-outdoor-concert-planning-weather-aq',
  'malaga-beach-morning-calmest-hours',
  'krakow-evening-bike-commute-forecast-signals',
];

async function main() {
  const firstAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (!firstAdmin) {
    throw new Error('No admin user found. Cannot reset database to admin-only state.');
  }

    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
    if (!adminPassword) {
      throw new Error(
        'ADMIN_PASSWORD is required to reset the production admin password.',
      );
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await prisma.$transaction(async (tx) => {
    await tx.moderationAuditLog.deleteMany();
    await tx.articleComment.deleteMany();
    await tx.articleLike.deleteMany();
    await tx.supportRequest.deleteMany();
    await tx.alertEvent.deleteMany();
    await tx.alertRule.deleteMany();
    await tx.refreshToken.deleteMany();
    await tx.userCity.deleteMany({ where: { userId: { not: firstAdmin.id } } });
    await tx.article.deleteMany({ where: { authorId: { not: firstAdmin.id } } });
    await tx.article.deleteMany({ where: { authorId: firstAdmin.id, slug: { notIn: KEEP_ARTICLE_SLUGS } } });
    await tx.user.deleteMany({ where: { id: { not: firstAdmin.id } } });
    await tx.user.update({
      where: { id: firstAdmin.id },
      data: {
        passwordHash,
      },
    });
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.articleComment.count(),
    prisma.articleLike.count(),
  ]);

  console.log(
    JSON.stringify(
      {
        users: counts[0],
        comments: counts[1],
        likes: counts[2],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
