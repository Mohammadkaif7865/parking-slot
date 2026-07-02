const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.location.upsert({
    where: { id: "tisha-plaza" },
    update: { name: "Tisha Plaza Parking", city: "Mumbai" },
    create: { id: "tisha-plaza", name: "Tisha Plaza Parking", city: "Mumbai" }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
