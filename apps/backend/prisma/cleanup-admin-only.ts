import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, nickname: true },
  });

  if (!admin) {
    throw new Error('No admin user found. Cleanup would leave the database without an admin.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.moderationAuditLog.deleteMany();
    await tx.articleComment.deleteMany();
    await tx.articleLike.deleteMany();
    await tx.supportRequest.deleteMany();
    await tx.alertEvent.deleteMany();
    await tx.alertRule.deleteMany();
    await tx.refreshToken.deleteMany({ where: { userId: { not: admin.id } } });
    await tx.userCity.deleteMany({ where: { userId: { not: admin.id } } });
    await tx.article.deleteMany({ where: { authorId: { not: admin.id } } });
    await tx.user.deleteMany({ where: { id: { not: admin.id } } });
  });

  console.log(`Cleanup complete. Preserved admin: ${admin.nickname} <${admin.email}>`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
