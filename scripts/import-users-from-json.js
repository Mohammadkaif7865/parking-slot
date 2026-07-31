const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function cleanEmail(value) {
  const matches = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((email) => email.trim()))).join(", ");
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: node scripts/import-users-from-json.js <users.json>");
  }

  const users = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  let created = 0;
  let updated = 0;

  for (const user of users) {
    const mobile = String(user.mobile || "").replace(/\D/g, "");
    if (!/^[0-9]{10}$/.test(mobile)) continue;

    const existing = await prisma.userMaster.findUnique({ where: { mobile } });
    await prisma.userMaster.upsert({
      where: { mobile },
      create: {
        name: String(user.name || "").trim(),
        mobile,
        email: cleanEmail(user.email),
        address: String(user.address || "").trim(),
        active: true
      },
      update: {
        name: String(user.name || "").trim(),
        email: cleanEmail(user.email),
        address: String(user.address || "").trim(),
        active: true
      }
    });

    if (existing) updated += 1;
    else created += 1;
  }

  console.log(`Imported users: created=${created}, updated=${updated}, total=${created + updated}`);
}

main()
  .catch((error) => {
    console.error("User import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
