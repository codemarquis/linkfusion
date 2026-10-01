import type { AnalyticsSummary, Breakdown } from "@shared/api";
import { clicks } from "@shared/schema";
import type { ClickRepository, ClickScope } from "../repositories/clickRepository";
import type { LinkRepository } from "../repositories/linkRepository";
import { toCsv } from "./csv";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function withPercentages(rows: Array<{ label: string | null; clicks: number }>, unknown = "Unknown"): Breakdown[] {
  const total = rows.reduce((sum, r) => sum + r.clicks, 0);
  return rows.map((r) => ({
    label: r.label ?? unknown,
    clicks: r.clicks,
    percentage: total ? Math.round((r.clicks / total) * 1000) / 10 : 0,
  }));
}

function fillDays(rows: Array<{ date: string; clicks: number }>, days: number) {
  const byDate = new Map(rows.map((r) => [r.date, r.clicks]));
  const out: Array<{ date: string; clicks: number }> = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, clicks: byDate.get(key) ?? 0 });
  }
  return out;
}

export function createAnalyticsService(deps: { clicks: ClickRepository; links: LinkRepository }) {
  const sinceDays = (days: number) => new Date(Date.now() - days * 86_400_000);

  return {
    async summary(opts: { userId?: string; linkId?: string; days: number }): Promise<AnalyticsSummary> {
      const scope: ClickScope = { userId: opts.userId, linkId: opts.linkId, since: sinceDays(opts.days) };
      const [daily, countries, devices, browsers, oses, referrers, topLinks, totalClicks, linkCounts] =
        await Promise.all([
          deps.clicks.daily(scope),
          deps.clicks.breakdown(scope, clicks.country),
          deps.clicks.breakdown(scope, clicks.device),
          deps.clicks.breakdown(scope, clicks.browser),
          deps.clicks.breakdown(scope, clicks.os),
          deps.clicks.breakdown(scope, clicks.referrerHost),
          deps.clicks.topLinks(scope),
          deps.clicks.total({ userId: opts.userId, linkId: opts.linkId }),
          deps.links.countAll(opts.userId),
        ]);
      const dailyClicks = fillDays(daily, opts.days);
      return {
        days: opts.days,
        totalLinks: linkCounts.total,
        activeLinks: linkCounts.active,
        totalClicks,
        clicksInPeriod: dailyClicks.reduce((sum, d) => sum + d.clicks, 0),
        dailyClicks,
        countries: withPercentages(countries).map((c) => ({
          ...c,
          code: c.label === "Unknown" ? "" : c.label,
          label: c.label === "Unknown" ? "Unknown" : (regionNames.of(c.label) ?? c.label),
        })),
        devices: withPercentages(devices),
        browsers: withPercentages(browsers),
        operatingSystems: withPercentages(oses),
        referrers: withPercentages(referrers, "Direct / none"),
        topLinks,
      };
    },

    async csv(opts: { userId?: string; linkId?: string; days: number }): Promise<string> {
      const rows = await deps.clicks.rows({ userId: opts.userId, linkId: opts.linkId, since: sinceDays(opts.days) });
      return toCsv(
        ["clicked_at", "short_code", "country", "device", "browser", "os", "referrer"],
        rows.map((r) => [r.clickedAt, r.shortCode, r.country, r.device, r.browser, r.os, r.referrerHost]),
      );
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
