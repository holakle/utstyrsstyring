// prisma.config.ts (Prisma 7)
// Denne filen brukes av Prisma CLI (migrate, db push, osv.)
// Den forteller Prisma hvor schema ligger, hvor migrations skal ligge,
// og hva DATABASE_URL er.

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Sti til schema.prisma (relativt til DER denne filen ligger)
  schema: "prisma/schema.prisma",

  // Hvor migrations lagres
  migrations: {
    path: "prisma/migrations",
  },

  // Database-URL flyttet hit i Prisma 7
  datasource: {
    url: env("DATABASE_URL"),
  },
});