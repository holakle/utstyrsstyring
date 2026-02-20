import { Body, Controller, Get, Post } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

/**
 * AppController = HTTP-endepunktene (API-ruter).
 * Web-appen (GUI) kommer til å kalle disse med fetch().
 */
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    return {
      ok: true,
      endpoints: ["/assets", "/events", "/users", "/seed", "/simulate/exit", "/simulate/enter"],
    };
  }

  /**
   * GET /assets
   * Returnerer alle gjenstander med status og hvem som evt holder dem.
   */
  @Get("assets")
  async assets() {
    return this.prisma.asset.findMany({
      include: { holderUser: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * GET /users
   * Returnerer alle brukere (for dropdown i GUI).
   */
  @Get("users")
  async users() {
    return this.prisma.user.findMany({ orderBy: { name: "asc" } });
  }

  /**
   * GET /events
   * Returnerer siste events (historikk).
   */
  @Get("events")
  async events() {
    return this.prisma.event.findMany({ orderBy: { ts: "desc" }, take: 200 });
  }

  /**
   * POST /seed
   * Legger inn demo-data (brukere + utstyr).
   * Kalles fra GUI-knapp.
   */
  @Post("seed")
  async seed() {
    await this.prisma.user.createMany({
      data: [
        { name: "Bruker 1", userTagId: "U001" },
        { name: "Bruker 2", userTagId: "U002" },
      ],
      skipDuplicates: true,
    });

    await this.prisma.asset.createMany({
      data: [
        { name: "Drill", category: "Verktøy", assetTagId: "A123" },
        { name: "Stige", category: "Utstyr", assetTagId: "A124" },
      ],
      skipDuplicates: true,
    });

    return { ok: true };
  }

  /**
   * (Valgfritt) GET /seed
   * Så du kan åpne /seed i nettleser uten 404.
   */
  @Get("seed")
  async seedGet() {
    return this.seed();
  }

  /**
   * POST /simulate/exit
   * “Simuler at en bruker tar et asset ut av lageret”.
   */
  @Post("simulate/exit")
  async simulateExit(@Body() body: { assetTagId: string; userTagId: string }) {
    const user = await this.prisma.user.findUnique({
      where: { userTagId: body.userTagId },
    });
    if (!user) return { ok: false, error: "User not found" };

    await this.prisma.asset.update({
      where: { assetTagId: body.assetTagId },
      data: { status: "OUT", holderUserId: user.id },
    });

    const ts = new Date();

    await this.prisma.event.createMany({
      data: [
        {
          ts,
          type: "EXIT",
          assetTagId: body.assetTagId,
          userTagId: body.userTagId,
          confidence: 0.9,
          details: { source: "GUI simulate" },
        },
        {
          ts,
          type: "CHECKOUT",
          assetTagId: body.assetTagId,
          userTagId: body.userTagId,
          confidence: 0.95,
          details: { source: "GUI simulate" },
        },
      ],
    });

    return { ok: true };
  }

  /**
   * POST /simulate/enter
   * “Simuler at et asset kommer tilbake inn på lager”.
   */
  @Post("simulate/enter")
  async simulateEnter(@Body() body: { assetTagId: string }) {
    await this.prisma.asset.update({
      where: { assetTagId: body.assetTagId },
      data: { status: "IN_WAREHOUSE", holderUserId: null },
    });

    const ts = new Date();

    await this.prisma.event.createMany({
      data: [
        {
          ts,
          type: "ENTER",
          assetTagId: body.assetTagId,
          confidence: 0.9,
          details: { source: "GUI simulate" },
        },
        {
          ts,
          type: "CHECKIN",
          assetTagId: body.assetTagId,
          confidence: 0.95,
          details: { source: "GUI simulate" },
        },
      ],
    });

    return { ok: true };
  }
}