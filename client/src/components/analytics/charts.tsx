import { Globe, Monitor, Smartphone, Tablet } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Breakdown, RecentClick } from "@shared/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export const PALETTE = ["#2196f3", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export const flag = (code: string | null | undefined) =>
  code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Donut chart with a legend; anything past the top six is grouped as "Other". */
export function DonutCard({ title, rows }: { title: string; rows: Breakdown[] }) {
  const top = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((sum, r) => sum + r.clicks, 0);
  const data = rest ? [...top, { label: "Other", clicks: rest, percentage: 0 }] : top;
  const total = data.reduce((sum, r) => sum + r.clicks, 0);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">No clicks in this period.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="clicks" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {data.map((r, i) => <Cell key={r.label} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [formatNumber(v), capitalize(name)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-semibold tabular-nums">{formatNumber(total)}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">clicks</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
              {data.map((r, i) => (
                <li key={r.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate">{capitalize(r.label)}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {Math.round((r.clicks / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor } as const;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (seconds < 60) return rtf.format(-Math.round(seconds), "second");
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), "minute");
  if (seconds < 86_400) return rtf.format(-Math.round(seconds / 3600), "hour");
  return rtf.format(-Math.round(seconds / 86_400), "day");
}

/** The latest clicks: which link, from where, on what. Nothing that identifies a visitor. */
export function RecentActivity({ clicks, className }: { clicks: RecentClick[]; className?: string }) {
  const regionNames = new Intl.DisplayNames(undefined, { type: "region" });
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Latest clicks across your links</CardDescription>
      </CardHeader>
      <CardContent>
        {clicks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clicks yet. Share a link to see activity here.</p>
        ) : (
          <ul className="divide-y">
            {clicks.map((c) => {
              const Icon = DEVICE_ICON[c.device as keyof typeof DEVICE_ICON] ?? Globe;
              return (
                <li key={`${c.clickedAt}-${c.shortCode}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="text-lg leading-none" aria-hidden="true">{flag(c.country)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">/{c.shortCode}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.country ? regionNames.of(c.country) : "Unknown location"} · {c.browser ?? "Unknown"}
                      {c.referrerHost ? ` · via ${c.referrerHost}` : ""}
                    </p>
                  </div>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={c.device ?? "unknown device"} />
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums" dateTime={c.clickedAt}>
                    {timeAgo(c.clickedAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
