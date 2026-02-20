import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

/**
 * PrismaService = PrismaClient pakket inn i en NestJS-service.
 *
 * Prisma 7: Vi må bruke en "driver adapter" (PrismaPg) for Postgres.
 * Adapteren får connectionString (DATABASE_URL), og PrismaClient får adapteren.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        "DATABASE_URL mangler. Sjekk at apps/api/.env finnes og inneholder DATABASE_URL=..."
      );
    }

    const adapter = new PrismaPg({ connectionString });

    // Prisma 7: riktig måte
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}