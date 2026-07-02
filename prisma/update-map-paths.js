const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  for (let index = 1; index <= 5; index += 1) {
    await prisma.map.update({
      where: { id: `tisha-map-${index}` },
      data: {
        filePath: `/maps/tisha-plaza/map-${index}.png`,
        sourceType: "png"
      }
    });
  }

  console.log("Updated Tisha Plaza map paths to PNG.");
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
