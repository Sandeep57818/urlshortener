// backend/prisma/seed.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  const adminPass = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || "Admin@123456",
    12
  );

  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@example.com" },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      password: adminPass,
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  const demoPass = await bcrypt.hash("Demo@123456", 12);
  const demo = await prisma.user.upsert({
    where: { email: "demo@urlshort.io" },
    update: {},
    create: {
      email: "demo@urlshort.io",
      password: demoPass,
      name: "Demo User",
      role: Role.USER,
    },
  });

  // Seed sample URLs
  const sampleUrls = [
    { shortCode: "github", originalUrl: "https://github.com", title: "GitHub" },
    { shortCode: "google", originalUrl: "https://google.com", title: "Google" },
    { shortCode: "yt", originalUrl: "https://youtube.com", title: "YouTube" },
  ];

  for (const u of sampleUrls) {
    await prisma.url.upsert({
      where: { shortCode: u.shortCode },
      update: {},
      create: { ...u, userId: demo.id, clickCount: Math.floor(Math.random() * 500) },
    });
  }

  console.log(`✅ Admin: ${admin.email}`);
  console.log(`✅ Demo: ${demo.email} / Demo@123456`);
  console.log("🎉 Seed done!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
