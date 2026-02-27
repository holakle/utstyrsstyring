import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

type AuthUser = {
  id: string;
  role: "ADMIN" | "USER";
  userTagId: string;
  username: string;
  name: string;
  isActive: boolean;
};

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}
  private readonly sessionCookie = "utstyr_session";

  private mapPrismaError(error: unknown): never {
    const knownError = error as { code?: string; meta?: { target?: string[] } } | undefined;
    if (knownError?.code === "P2002") {
      const fields = Array.isArray(knownError.meta?.target) ? knownError.meta?.target.join(", ") : "unique field";
      throw new BadRequestException(`Duplicate value for ${fields}`);
    }
    if (knownError?.code === "P2003") {
      throw new BadRequestException("Invalid relation reference in request");
    }
    throw error;
  }

  private hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
    const hash = scryptSync(password, salt, 64).toString("hex");
    return `scrypt$${salt}$${hash}`;
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [algo, salt, stored] = passwordHash.split("$");
    if (algo !== "scrypt" || !salt || !stored) return false;
    const computed = scryptSync(password, salt, 64).toString("hex");
    const a = Buffer.from(stored, "hex");
    const b = Buffer.from(computed, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private readCookie(req: Request, key: string) {
    const cookie = req.headers.cookie;
    if (!cookie) return undefined;
    const pairs = cookie.split(";").map((part) => part.trim());
    for (const pair of pairs) {
      const [k, ...rest] = pair.split("=");
      if (k === key) return decodeURIComponent(rest.join("="));
    }
    return undefined;
  }

  private async resolveUser(req: Request): Promise<AuthUser> {
    const token = this.readCookie(req, this.sessionCookie);
    if (!token) throw new UnauthorizedException("Not authenticated");
    const tokenHash = this.hashToken(token);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } });
      throw new UnauthorizedException("Session is invalid or expired");
    }
    if (!session.user.isActive) throw new ForbiddenException("User is inactive");

    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      id: session.user.id,
      role: session.user.role === "ADMIN" ? "ADMIN" : "USER",
      userTagId: session.user.userTagId,
      username: session.user.username,
      name: session.user.name,
      isActive: session.user.isActive,
    };
  }

  private async requireAdmin(req: Request) {
    const user = await this.resolveUser(req);
    if (user.role !== "ADMIN") throw new ForbiddenException("Admin role is required for this endpoint");
    return user;
  }

  private setSessionCookie(res: Response, token: string) {
    const isSecure = (process.env.SESSION_COOKIE_SECURE ?? "false").toLowerCase() === "true";
    const maxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);
    const maxAgeMs = Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
    res.cookie(this.sessionCookie, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      path: "/",
      maxAge: maxAgeMs,
    });
  }

  private clearSessionCookie(res: Response) {
    res.clearCookie(this.sessionCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: (process.env.SESSION_COOKIE_SECURE ?? "false").toLowerCase() === "true",
      path: "/",
    });
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

  @Post("auth/login")
  async login(
    @Body() body: { username?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!username || !password) throw new BadRequestException("username and password are required");

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");
    if (!this.verifyPassword(password, user.passwordHash)) throw new UnauthorizedException("Invalid credentials");

    const token = randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);
    const maxAgeDays = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);
    const expiresAt = new Date(Date.now() + Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });
    this.setSessionCookie(res, token);

    return { id: user.id, username: user.username, name: user.name, role: user.role };
  }

  @Post("auth/logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.readCookie(req, this.sessionCookie);
    if (token) {
      const tokenHash = this.hashToken(token);
      await this.prisma.session.deleteMany({ where: { tokenHash } });
    }
    this.clearSessionCookie(res);
    return { ok: true };
  }

  @Get("auth/me")
  async authMe(@Req() req: Request) {
    const me = await this.resolveUser(req);
    return me;
  }

  @Get("me")
  async me(@Req() req: Request) {
    const me = await this.resolveUser(req);
    return this.prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        userTagId: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @Get("users")
  async users(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        userTagId: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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
    @Req() req: Request,
    @Body() body: { name: string; username: string; password: string; email?: string; userTagId: string; role?: "ADMIN" | "USER" },
  ) {
    await this.requireAdmin(req);
    if (!body.name || !body.userTagId || !body.username || !body.password) {
      throw new BadRequestException("name, userTagId, username and password are required");
    }
    const created = await this.prisma.user.create({
      data: {
        name: body.name,
        username: body.username.trim().toLowerCase(),
        passwordHash: this.hashPassword(body.password),
        email: body.email,
        userTagId: body.userTagId,
        role: body.role ?? "USER",
      },
    });
    return this.prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        userTagId: true,
        role: true,
        isActive: true,
      },
    });
  }

  @Patch("users/:id")
  async updateUser(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { name?: string; username?: string; password?: string; email?: string; role?: "ADMIN" | "USER"; isActive?: boolean },
  ) {
    await this.requireAdmin(req);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        username: body.username?.trim().toLowerCase(),
        ...(body.password ? { passwordHash: this.hashPassword(body.password) } : {}),
        email: body.email,
        role: body.role,
        isActive: body.isActive,
      },
    });
    return this.prisma.user.findUniqueOrThrow({
      where: { id: updated.id },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        userTagId: true,
        role: true,
        isActive: true,
      },
    });
  }

  @Get("assets")
  async assets(
    @Req() req: Request,
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("location") location?: string,
  ) {
    await this.resolveUser(req);
    const where: Prisma.AssetWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { assetTagId: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
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
  async assetById(@Req() req: Request, @Param("id") id: string) {
    await this.resolveUser(req);
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
  async assetHistory(@Req() req: Request, @Param("id") id: string) {
    await this.resolveUser(req);
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
    @Req() req: Request,
    @Body()
    body: {
      name: string;
      assetTagId: string;
      status?: string;
      barcode?: string;
      serial?: string;
      airtagId?: string;
      category?: string;
      categoryId?: string;
      locationId?: string;
    },
  ) {
    await this.requireAdmin(req);
    const name = body.name?.trim();
    const assetTagId = body.assetTagId?.trim();
    if (!name || !assetTagId) throw new BadRequestException("name and assetTagId are required");
    try {
      return await this.prisma.asset.create({
        data: {
          name,
          assetTagId,
          barcode: body.barcode?.trim() || assetTagId,
          status: body.status ?? "AVAILABLE",
          serial: body.serial?.trim() || undefined,
          airtagId: body.airtagId?.trim() || undefined,
          category: body.category?.trim() || undefined,
          categoryId: body.categoryId,
          locationId: body.locationId,
        },
      });
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  @Patch("assets/:id")
  async updateAsset(
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      status?: string;
      barcode?: string;
      serial?: string;
      airtagId?: string;
      category?: string;
      categoryId?: string;
      locationId?: string;
    },
  ) {
    await this.requireAdmin(req);
    return this.prisma.asset.update({
      where: { id },
      data: {
        name: body.name,
        status: body.status,
        barcode: body.barcode?.trim(),
        serial: body.serial,
        airtagId: body.airtagId,
        category: body.category,
        categoryId: body.categoryId,
        locationId: body.locationId,
      },
    });
  }

  @Delete("assets/:id")
  async deleteAsset(@Req() req: Request, @Param("id") id: string) {
    await this.requireAdmin(req);
    return this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date(), status: "RETIRED" },
    });
  }

  @Post("assignments/checkout")
  async checkout(
    @Req() req: Request,
    @Body() body: { assetId: string; userId: string; dueDate?: string },
  ) {
    await this.requireAdmin(req);
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
    @Req() req: Request,
    @Body() body: { assetId: string },
  ) {
    await this.requireAdmin(req);
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
  async activeAssignments(@Req() req: Request, @Query("userId") userId?: string) {
    const me = await this.resolveUser(req);
    const scopedUserId = me.role === "ADMIN" ? userId : me.id;
    return this.prisma.assignment.findMany({
      where: { returnedAt: null, ...(scopedUserId ? { userId: scopedUserId } : {}) },
      include: { user: true, asset: { include: { categoryRel: true, locationRel: true } } },
      orderBy: { checkedOutAt: "desc" },
    });
  }

  @Get("events")
  async events(@Req() req: Request, @Query("assetId") assetId?: string, @Query("userId") userId?: string) {
    const me = await this.resolveUser(req);
    const scopedUserId = me.role === "ADMIN" ? userId : me.id;
    const [asset, user] = await Promise.all([
      assetId ? this.prisma.asset.findUnique({ where: { id: assetId } }) : null,
      scopedUserId ? this.prisma.user.findUnique({ where: { id: scopedUserId } }) : null,
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

  @Post("scan/lookup")
  async scanLookup(@Req() req: Request, @Body() body: { code?: string }) {
    await this.resolveUser(req);
    const code = body.code?.trim();
    if (!code) throw new BadRequestException("code is required");

    return this.prisma.asset.findMany({
      where: {
        deletedAt: null,
        OR: [
          { assetTagId: { contains: code, mode: "insensitive" } },
          { barcode: { contains: code, mode: "insensitive" } },
          { serial: { contains: code, mode: "insensitive" } },
          { airtagId: { contains: code, mode: "insensitive" } },
          { name: { contains: code, mode: "insensitive" } },
        ],
      },
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
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
  }

  @Post("seed")
  async seed(@Req() req: Request) {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      await this.requireAdmin(req);
    }
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
    const userPassword = process.env.SEED_USER_PASSWORD ?? "user123";
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
        update: {
          name: "Admin PC",
          username: "adminpc",
          passwordHash: this.hashPassword(adminPassword),
          role: "ADMIN",
          isActive: true,
        },
        create: {
          name: "Admin PC",
          username: "adminpc",
          passwordHash: this.hashPassword(adminPassword),
          userTagId: "ADMIN001",
          role: "ADMIN",
          email: "adminpc@example.com",
        },
      });
      await tx.user.upsert({
        where: { userTagId: "ADMIN002" },
        update: {
          name: "Admin Mobil",
          username: "adminmobile",
          passwordHash: this.hashPassword(adminPassword),
          role: "ADMIN",
          isActive: true,
        },
        create: {
          name: "Admin Mobil",
          username: "adminmobile",
          passwordHash: this.hashPassword(adminPassword),
          userTagId: "ADMIN002",
          role: "ADMIN",
          email: "adminmobile@example.com",
        },
      });
      const user = await tx.user.upsert({
        where: { userTagId: "U001" },
        update: {
          name: "Bruker 1",
          username: "user1",
          passwordHash: this.hashPassword(userPassword),
          role: "USER",
          isActive: true,
        },
        create: {
          name: "Bruker 1",
          username: "user1",
          passwordHash: this.hashPassword(userPassword),
          userTagId: "U001",
          role: "USER",
          email: "bruker1@example.com",
        },
      });
      await tx.user.upsert({
        where: { userTagId: "U002" },
        update: {
          name: "Bruker 2",
          username: "user2",
          passwordHash: this.hashPassword(userPassword),
          role: "USER",
          isActive: true,
        },
        create: {
          name: "Bruker 2",
          username: "user2",
          passwordHash: this.hashPassword(userPassword),
          userTagId: "U002",
          role: "USER",
          email: "bruker2@example.com",
        },
      });

      const drill = await tx.asset.upsert({
        where: { assetTagId: "A123" },
        update: {
          name: "Drill",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          barcode: "A123",
          status: "AVAILABLE",
          deletedAt: null,
        },
        create: {
          name: "Drill",
          assetTagId: "A123",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          barcode: "A123",
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
          barcode: "A124",
          status: "AVAILABLE",
          deletedAt: null,
        },
        create: {
          name: "Ladder",
          assetTagId: "A124",
          category: "Tools",
          categoryId: tools.id,
          locationId: warehouse.id,
          barcode: "A124",
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
          barcode: "A125",
          status: "AVAILABLE",
          deletedAt: null,
        },
        create: {
          name: "MacBook Pro",
          assetTagId: "A125",
          category: "IT",
          categoryId: it.id,
          locationId: hq.id,
          barcode: "A125",
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
