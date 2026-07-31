const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table, columns, rows) {
  if (!rows.length) return `-- No rows for ${table}\n`;
  const quotedColumns = columns.map((column) => `"${column}"`).join(", ");
  const values = rows
    .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(", ")})`)
    .join(",\n");
  return `INSERT INTO "${table}" (${quotedColumns}) VALUES\n${values}\nON CONFLICT DO NOTHING;\n`;
}

async function main() {
  const backupDir = path.join(process.cwd(), "backup");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const locations = await prisma.location.findMany({ orderBy: { createdAt: "asc" } });
  const maps = await prisma.map.findMany({ orderBy: { createdAt: "asc" } });
  const slots = await prisma.parkingSlot.findMany({ orderBy: { createdAt: "asc" } });
  const users = await prisma.userMaster.findMany({ orderBy: { createdAt: "asc" } });
  const bookings = await prisma.booking.findMany({ orderBy: { createdAt: "asc" } });
  const counters = await prisma.appCounter.findMany({ orderBy: { key: "asc" } });

  const backup = {
    createdAt: new Date().toISOString(),
    tables: {
      Location: locations,
      Map: maps,
      ParkingSlot: slots,
      UserMaster: users,
      Booking: bookings,
      AppCounter: counters
    }
  };

  const jsonPath = path.join(backupDir, `parking-db-backup-${timestamp}.json`);
  const sqlPath = path.join(backupDir, `parking-db-backup-${timestamp}.sql`);
  const schemaPath = path.join(backupDir, `schema-${timestamp}.prisma`);

  fs.writeFileSync(jsonPath, JSON.stringify(backup, null, 2));
  fs.copyFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), schemaPath);

  const sql = [
    "BEGIN;",
    insert("Location", ["id", "name", "parkingName", "city", "createdAt", "updatedAt"], locations),
    insert("Map", ["id", "locationId", "name", "filePath", "parkingLevel", "sourceType", "createdAt", "updatedAt"], maps),
    insert("ParkingSlot", ["id", "mapId", "slotNo", "zone", "type", "x", "y", "width", "height", "status", "createdAt", "updatedAt"], slots),
    insert("UserMaster", ["id", "name", "mobile", "email", "address", "active", "createdAt", "updatedAt"], users),
    insert("Booking", ["id", "slotId", "userId", "receiptNo", "allottee", "mobile", "email", "address", "level", "status", "createdAt", "updatedAt"], bookings),
    insert("AppCounter", ["key", "value", "updatedAt"], counters),
    "COMMIT;"
  ].join("\n\n");

  fs.writeFileSync(sqlPath, sql);
  console.log(`Backup completed:
JSON: ${jsonPath}
SQL: ${sqlPath}
Schema: ${schemaPath}
Rows: locations=${locations.length}, maps=${maps.length}, slots=${slots.length}, users=${users.length}, bookings=${bookings.length}, counters=${counters.length}`);
}

main()
  .catch((error) => {
    console.error("Backup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
