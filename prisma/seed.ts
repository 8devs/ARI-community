import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "ARI Community",
      locationText: "Adenhauerring, Worms",
    },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.appUser.upsert({
    where: { email: "admin@ari-worms.de" },
    update: {},
    create: {
      email: "admin@ari-worms.de",
      passwordHash,
      role: "SUPER_ADMIN",
      organizationId: org.id,
      name: "Administrator",
      isEmailVerified: true,
    },
  });

  // Create admin profile
  await prisma.profile.upsert({
    where: { id: admin.id },
    update: {},
    create: {
      id: admin.id,
      localUserId: admin.id,
      email: admin.email,
      name: admin.name ?? "Administrator",
      role: "SUPER_ADMIN",
      organizationId: org.id,
    },
  });

  console.log("Seed complete.");
  console.log(`  Organization: ${org.name} (${org.id})`);
  console.log(`  Admin user: ${admin.email} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
