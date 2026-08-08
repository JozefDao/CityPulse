import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: {
      avatarUrl: {
        startsWith: '/uploads/avatars/',
      },
    },
    data: {
      avatarUrl: null,
    },
  });

  console.log(`Cleared legacy local avatarUrl for ${result.count} user(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
