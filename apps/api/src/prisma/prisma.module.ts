import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * PrismaModule gjør PrismaService tilgjengelig i resten av appen.
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}