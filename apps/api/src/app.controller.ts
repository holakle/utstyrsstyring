import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";

type Actor = {
  role: "ADMIN" | "USER";
  userTagId?: string;
};

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  private getActor(headers: Record<string, string | string[] | undefined>): Actor {
    const roleHeader = headers["x-user-role"];
    const tagHeader = headers["x-user-tag"];
    const role = (Array.isArray(roleHeader) ? roleHeader[0] : roleHeader)?.toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
    const userTagId = Array.isArray(tagHeader) ? tagHeader[0] : tagHeader;
    return { role, userTagId };
  }

  private ensureAdmin(actor: Actor) {
    if (actor.role !== "ADMIN") {
      throw new BadRequestException("Admin role is required for this endpoint");
    }
  }

  private async enrichEvents(events: any[]) {
    const assetTags = [...new Set(events.map((e) => e.assetTagId).filter(Boolean))] as string[];
    const userTags = [...new Set(events.map((e) => e.userTagId).filter(Boolean))] as string[];
    const [assets, users] = await Promise.all([
      assetTags.length ? this.prisma.asset.findMany({ where: { assetTagId: { in: assetTags } } }) : [],
      userTags.length ? this.prisma.user.findMany({ where: { userTagId: { in: userTags } } }) : [],
    ]);
    const assetMap = new Map<string, any>(assets.map((a: any) => [a.assetTagId, a] as [string, any]));
    const userMap = new Map<string, any>(users.map((u: any) => [u.userTagId, u] as [string, any]));

    return events.map((e) => ({
      ...e,
      asset: e.assetTagId ? assetMap.get(e.assetTagId) ?? null : null,
      user: e.userTagId ? userMap.get(e.userTagId) ?? null : null,
    }));
  }

  @Get()
  root() {
    return {
      ok: true,
      endpoints: ["/me", "/users", "/assets", "/assignments/active", "/assignments/checkout", "/assignments/return", "/events", "/seed"],
    };
  }

  @Get("me")
  async me(@Headers() headers: Record<string, string | string[] | undefined>) {
    const actor = this.getActor(headers);
    const user = await this.prisma.user.findUnique({
      where: { userTagId: actor.userTagId ?? "U001" },
    });
    if (!user) throw new BadRequestException("No user found for current session");
    return user;
  }

  @Get("users")
  async users(@Headers() headers: Record<string, string | string[] | undefined>) {
    this.ensureAdmin(this.getActor(headers));
    return this.prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        assignments: {
          where: { returnedAt: null },
          include: { asset: true },
          orderBy: { checkedOutAt: "desc" },
        },
      },
    });
  }

  @Post("users")
  async createUser(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { name: string; email?: string; userTagId: string; role?: "ADMIN" | "USER" },
  ) {
    this.ensureAdmin(this.getActor(headers));
    if (!body.name || !body.userTagId) throw new BadRequestException("name and userTagId are required");
    return this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        userTagId: body.userTagId,
        role: body.role ?? "USER",
      },
    });
  }

  @Patch("users/:id")
  async updateUser(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param("id") id: string,
    @Body() body: { name?: string; email?: string; role?: "ADMIN" | "USER"; isActive?: boolean },
  ) {
    this.ensureAdmin(this.getActor(headers));
    return this.prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
        isActive: body.isActive,
      },
    });
  }

  @Get("assets")
  async assets(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("location") location?: string,
  ) {
    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { assetTagId: { contains: search, mode: "insensitive" } },
              { serial: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(category ? { OR: [{ category: { contains: category, mode: "insensitive" } }, { categoryRel: { name: category } }] } : {}),
      ...(location ? { locationRel: { name: location } } : {}),
    };

    return this.prisma.asset.findMany({
      where,
      include: {
        categoryRel: true,
        locationRel: true,
        assignments: {
          where: { returnedAt: null },
          include: { user: true },
          take: 1,
          orderBy: { checkedOutAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  @Get("assets/:id")
  async assetById(@Param("id") id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        categoryRel: true,
        locationRel: true,
        assignments: {
          where: { returnedAt: null },
          include: { user: true },
          take: 1,
          orderBy: { checkedOutAt: "desc" },
        },
      },
    });
    if (!asset || asset.deletedAt) throw new BadRequestException("Asset not found");
    return asset;
  }

  @Get("assets/:id/history")
  async assetHistory(@Param("id") id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new BadRequestException("Asset not found");

    const [assignments, rawEvents] = await Promise.all([
      this.prisma.assignment.findMany({
        where: { assetId: id },
        include: { user: true },
        orderBy: { checkedOutAt: "desc" },
      }),
      this.prisma.event.findMany({
        where: { assetTagId: asset.assetTagId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    return { assignments, events: await this.enrichEvents(rawEvents) };
  }

  @Post("assets")
  async createAsset(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body()
    body: {
      name: string;
      assetTagId: string;
      status?: string;
      serial?: string;
      airtagId?: string;
      category?: string;
      categoryId?: string;
      locationId?: string;
    },
  ) {
    this.ensureAdmin(this.getActor(headers));
    if (!body.name || !body.assetTagId) throw new BadRequestException("name and assetTagId are required");
    return this.prisma.asset.create({
      data: {
        name: body.name,
        assetTagId: body.assetTagId,
        status: body.status ?? "AVAILABLE",
        serial: body.serial,
        airtagId: body.airtagId,
        category: body.category,
        categoryId: body.categoryId,
        locationId: body.locationId,
      },
    });
  }

  @Patch("assets/:id")
  async updateAsset(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      status?: string;
      serial?: string;
      airtagId?: string;
      category?: string;
      categoryId?: string;
      locationId?: string;
    },
  ) {
    this.ensureAdmin(this.getActor(headers));
    return this.prisma.asset.update({
      where: { id },
      data: {
        name: body.name,
        status: body.status,
        serial: body.serial,
        airtagId: body.airtagId,
        category: body.category,
        categoryId: body.categoryId,
        locationId: body.locationId,
      },
    });
  }

  @Delete("assets/:id")
  async deleteAsset(@Headers() headers: Record<string, string | string[] | undefined>, @Param("id") id: string) {
    this.ensureAdmin(this.getActor(headers));
    return this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date(), status: "RETIRED" },
    });
  }

  @Post("assignments/checkout")
  async checkout(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { assetId: string; userId: string; dueDate?: string },
  ) {
    this.ensureAdmin(this.getActor(headers));
    if (!body.assetId || !body.userId) throw new BadRequestException("assetId and userId are required");

    const dueAt = body.dueDate ? new Date(body.dueDate) : null;

    return this.prisma.$transaction(async (tx) => {
      const [asset, user, active] = await Promise.all([
        tx.asset.findUnique({ where: { id: body.assetId } }),
        tx.user.findUnique({ where: { id: body.userId } }),
        tx.assignment.findFirst({ where: { assetId: body.assetId, returnedAt: null } }),
      ]);

      if (!asset || asset.deletedAt) throw new BadRequestException("Asset not found");
      if (!user || !user.isActive) throw new BadRequestException("User not found or inactive");
      if (active) throw new BadRequestException("Asset is already checked out");

      const assignment = await tx.assignment.create({
        data: { assetId: body.assetId, userId: body.userId, dueAt },
      });

      await tx.asset.update({
        where: { id: body.assetId },
        data: { status: "CHECKED_OUT", holderUserId: body.userId },
      });

      await tx.event.create({
        data: {
          ts: new Date(),
          type: "CHECKOUT",
          assetTagId: asset.assetTagId,
          userTagId: user.userTagId,
          confidence: 1,
          details: { dueAt },
        },
      });

      return assignment;
    });
  }

  @Post("assignments/return")
  async returnAsset(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { assetId: string },
  ) {
    this.ensureAdmin(this.getActor(headers));
    if (!body.assetId) throw new BadRequestException("assetId is required");

    return this.prisma.$transaction(async (tx) => {
      const [asset, active] = await Promise.all([
        tx.asset.findUnique({ where: { id: body.assetId } }),
        tx.assignment.findFirst({
          where: { assetId: body.assetId, returnedAt: null },
          orderBy: { checkedOutAt: "desc" },
          include: { user: true },
        }),
      ]);

      if (!asset) throw new BadRequestException("Asset not found");
      if (!active) throw new BadRequestException("No active assignment for this asset");

      const returnedAt = new Date();
      const assignment = await tx.assignment.update({
        where: { id: active.id },
        data: { returnedAt },
      });

      await tx.asset.update({
        where: { id: body.assetId },
        data: { status: "AVAILABLE", holderUserId: null },
      });

      await tx.event.create({
        data: {
          ts: returnedAt,
          type: "RETURN",
          assetTagId: asset.assetTagId,
          userTagId: active.user.userTagId,
          confidence: 1,
          details: { assignmentId: active.id, returnedAt },
        },
      });

      return assignment;
    });
  }

  @Get("assignments/active")
  async activeAssignments(@Query("userId") userId?: string) {
    return this.prisma.assignment.findMany({
      where: { returnedAt: null, ...(userId ? { userId } : {}) },
      include: { user: true, asset: { include: { categoryRel: true, locationRel: true } } },
      orderBy: { checkedOutAt: "desc" },
    });
  }

  @Get("events")
  async events(@Query("assetId") assetId?: string, @Query("userId") userId?: string) {
    const [asset, user] = await Promise.all([
      assetId ? this.prisma.asset.findUnique({ where: { id: assetId } }) : null,
      userId ? this.prisma.user.findUnique({ where: { id: userId } }) : null,
    ]);

    const rawEvents = await this.prisma.event.findMany({
      where: {
        ...(asset ? { assetTagId: asset.assetTagId } : {}),
        ...(user ? { userTagId: user.userTagId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return this.enrichEvents(rawEvents);
  }

  @Post("seed")
  async seed() {
    await this.prisma.$transaction(async (tx) => {
      const [hq, warehouse] = await Promise.all([
        tx.location.upsert({ where: { name: "HQ" }, update: {}, create: { name: "HQ" } }),
        tx.location.upsert({ where: { name: "Warehouse" }, update: {}, create: { name: "Warehouse" } }),
      ]);
      const [tools, it] = await Promise.all([
        tx.category.upsert({ where: { name: "Tools" }, update: {}, create: { name: "Tools" } }),
        tx.category.upsert({ where: { name: "IT" }, update: {}, create: { name: "IT" } }),
      ]);

      const admin = await tx.user.upsert({
        where: { userTagId: "ADMIN001" },
        update: { name: "Admin", role: "ADMIN", isActive: true },
        create: { name: "Admin", userTagId: "ADMIN001", role: "ADMIN", email: "admin@example.com" },
      });
      const user = await tx.user.upsert({
        where: { userTagId: "U001" },
        update: { name: "Bruker 1", role: "USER", isActive: true },
        create: { name: "Bruker 1", userTagId: "U001", role: "USER", email: "bruker1@example.com" },
      });
      await tx.user.upsert({
        where: { userTagId: "U002" },
        update: { name: "Bruker 2", role: "USER", isActive: true },
        create: { name: "Bruker 2", userTagId: "U002", role: "USER", email: "bruker2@example.com" },
      });

      const drill = await tx.asset.upsert({
        where: { assetTagId: "A123" },
        update: {
          name: "Drill",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          status: "AVAILABLE",
          deletedAt: null,
        },
        create: {
          name: "Drill",
          assetTagId: "A123",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          status: "AVAILABLE",
        },
      });
      await tx.asset.upsert({
        where: { assetTagId: "A124" },
        update: {
          name: "Ladder",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          status: "AVAILABLE",
          deletedAt: null,
        },
        create: {
          name: "Ladder",
          assetTagId: "A124",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          status: "AVAILABLE",
        },
      });
      await tx.asset.upsert({
        where: { assetTagId: "A125" },
        update: {
          name: "MacBook Pro",
          category: "IT",
          categoryId: it.id,
          locationId: hq.id,
          status: "AVAILABLE",
          deletedAt: null,
        },
        create: {
          name: "MacBook Pro",
          assetTagId: "A125",
          category: "IT",
          categoryId: it.id,
          locationId: hq.id,
          status: "AVAILABLE",
        },
      });

      const existingActive = await tx.assignment.findFirst({
        where: { assetId: drill.id, returnedAt: null },
      });
      if (!existingActive) {
        await tx.assignment.create({
          data: {
            assetId: drill.id,
            userId: user.id,
            dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          },
        });
        await tx.asset.update({
          where: { id: drill.id },
          data: { status: "CHECKED_OUT", holderUserId: user.id },
        });
        await tx.event.create({
          data: {
            ts: new Date(),
            type: "CHECKOUT",
            assetTagId: "A123",
            userTagId: "U001",
            confidence: 1,
            details: { source: "seed" },
          },
        });
      }

      await tx.event.create({
        data: {
          ts: new Date(),
          type: "SEED",
          assetTagId: null,
          userTagId: "ADMIN001",
          confidence: 1,
          details: { source: "manual" },
        },
      });
      await tx.asset.updateMany({
        where: { status: "CHECKED_OUT", holderUserId: null },
        data: { status: "AVAILABLE" },
      });
      void admin;
    });

    return { ok: true };
  }
}
