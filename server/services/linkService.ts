import { randomInt } from "node:crypto";
import { z } from "zod";
import { createLinkSchema, RESERVED_ALIASES, updateLinkSchema, type Link } from "@shared/api";
import { badRequest, conflict, notFound } from "../errors";
import type { LinkChanges, LinkRepository, LinkWithStats } from "../repositories/linkRepository";
import type { QrRepository } from "../repositories/qrRepository";
import { hashPassword } from "./passwords";

const CODE_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/l/I
const CODE_LENGTH = 7;

export function generateShortCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function createLinkService(deps: { links: LinkRepository; qr: QrRepository; publicBaseUrl: string }) {
  const ownHost = new URL(deps.publicBaseUrl).hostname.toLowerCase();

  function rejectSelfReference(url: string) {
    if (new URL(url).hostname.toLowerCase() === ownHost) {
      throw badRequest("SELF_REFERENCE", "Links can't point back to this shortener", {
        originalUrl: "Points to this shortener",
      });
    }
  }

  function toDto(link: LinkWithStats): Link {
    return {
      id: link.id,
      shortCode: link.shortCode,
      shortUrl: `${deps.publicBaseUrl}/${link.shortCode}`,
      originalUrl: link.originalUrl,
      title: link.title,
      isCustomAlias: link.isCustomAlias,
      hasPassword: Boolean(link.passwordHash),
      expiresAt: link.expiresAt?.toISOString() ?? null,
      maxClicks: link.maxClicks,
      isActive: link.isActive,
      clickCount: link.clickCount,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
      ...(link.ownerEmail ? { owner: { id: link.userId, email: link.ownerEmail } } : {}),
    };
  }

  async function uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateShortCode();
      if (!RESERVED_ALIASES.has(code.toLowerCase()) && !(await deps.links.shortCodeExists(code))) return code;
    }
    throw new Error("Could not allocate a unique short code");
  }

  async function ownedOr404(userId: string, id: string): Promise<LinkWithStats> {
    const link = await deps.links.findOwned(userId, id);
    if (!link) throw notFound("Link"); // 404 (not 403) so ids of other users' links aren't confirmed
    return link;
  }

  return {
    toDto,
    ownedOr404,

    async create(userId: string, raw: unknown): Promise<Link> {
      const input = createLinkSchema.parse(raw);
      rejectSelfReference(input.originalUrl);
      let shortCode: string;
      if (input.customAlias) {
        if (await deps.links.shortCodeExists(input.customAlias)) {
          throw conflict("ALIAS_TAKEN", "That alias is already taken", { customAlias: "Already taken" });
        }
        shortCode = input.customAlias;
      } else {
        shortCode = await uniqueCode();
      }
      try {
        const row = await deps.links.create({
          userId,
          originalUrl: input.originalUrl,
          shortCode,
          isCustomAlias: Boolean(input.customAlias),
          title: input.title || null,
          passwordHash: input.password ? await hashPassword(input.password) : null,
          expiresAt: input.expiresAt ?? null,
          maxClicks: input.maxClicks ?? null,
        });
        return toDto({ ...row, clickCount: 0 });
      } catch (err) {
        if ((err as { code?: string }).code === "23505") {
          throw conflict("ALIAS_TAKEN", "That alias is already taken", { customAlias: "Already taken" });
        }
        throw err;
      }
    },

    async update(userId: string, id: string, raw: unknown): Promise<Link> {
      const input = updateLinkSchema.parse(raw);
      await ownedOr404(userId, id);
      const changes: LinkChanges = {};
      if (input.originalUrl !== undefined) {
        rejectSelfReference(input.originalUrl);
        changes.originalUrl = input.originalUrl;
      }
      if (input.title !== undefined) changes.title = input.title || null;
      if (input.expiresAt !== undefined) changes.expiresAt = input.expiresAt;
      if (input.maxClicks !== undefined) changes.maxClicks = input.maxClicks;
      if (input.isActive !== undefined) changes.isActive = input.isActive;
      if (input.password !== undefined) changes.passwordHash = await hashPassword(input.password);
      if (input.removePassword) changes.passwordHash = null;
      await deps.links.updateOwned(userId, id, changes);
      return toDto(await ownedOr404(userId, id));
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await deps.links.deleteOwned(userId, id))) throw notFound("Link");
    },

    async list(userId: string, query: { page: number; limit: number; search?: string }) {
      const { rows, total } = await deps.links.listOwned(userId, {
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        search: query.search,
      });
      return { items: rows.map(toDto), page: query.page, limit: query.limit, total };
    },
  };
}

export type LinkService = ReturnType<typeof createLinkService>;
export const idParam = z.object({ id: z.string().uuid() });
