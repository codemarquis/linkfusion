import type { LinkRow } from "@shared/schema";
import type { ClickRepository } from "../repositories/clickRepository";
import type { LinkRepository } from "../repositories/linkRepository";
import type { ClickFacts } from "./clickContext";
import { verifyPassword } from "./passwords";

export type Resolution =
  | { kind: "redirect"; link: LinkRow }
  | { kind: "password"; link: LinkRow }
  | { kind: "not_found" | "inactive" | "expired" | "limit_reached" };

export function createRedirectService(deps: { links: LinkRepository; clicks: ClickRepository }) {
  async function resolve(code: string): Promise<Resolution> {
    const link = await deps.links.findByShortCode(code);
    if (!link) return { kind: "not_found" };
    if (!link.isActive) return { kind: "inactive" };
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return { kind: "expired" };
    if (link.maxClicks !== null && (await deps.links.countClicks(link.id)) >= link.maxClicks) {
      return { kind: "limit_reached" };
    }
    return link.passwordHash ? { kind: "password", link } : { kind: "redirect", link };
  }

  return {
    resolve,

    async unlock(code: string, password: string): Promise<Resolution | { kind: "wrong_password"; link: LinkRow }> {
      const result = await resolve(code);
      if (result.kind !== "password") return result;
      return (await verifyPassword(password, result.link.passwordHash))
        ? { kind: "redirect", link: result.link }
        : { kind: "wrong_password", link: result.link };
    },

    /** Fire-and-forget: a failure to record a click must never break the redirect. */
    record(link: LinkRow, facts: ClickFacts): void {
      if (facts.device === "bot") return; // link previews and crawlers aren't visits
      deps.clicks
        .insert({ urlId: link.id, ...facts })
        .catch((err) => console.error(`[clicks] failed to record click for ${link.id}:`, err.message));
    },
  };
}

export type RedirectService = ReturnType<typeof createRedirectService>;
