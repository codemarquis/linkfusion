import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSearch } from "wouter";
import type { AnalyticsSummary, Breakdown, Link, Paginated } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

const RANGES = [7, 30, 90, 365];

const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";

function BreakdownCard({ title, rows, withFlags = false }: { title: string; rows: Array<Breakdown & { code?: string }>; withFlags?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clicks in this period.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.label}>
                <div className="flex justify-between text-sm">
                  <span className="truncate">{withFlags ? `${flag(r.code ?? "")} ` : ""}{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">{formatNumber(r.clicks)} · {r.percentage}%</span>
                </div>
                <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${r.percentage}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const params = new URLSearchParams(useSearch());
  const [days, setDays] = useState(30);
  const [linkId, setLinkId] = useState(params.get("link") ?? "all");

  const { data: links } = useQuery<Paginated<Link>>({ queryKey: ["/api/links?limit=100"] });
  const path = linkId === "all" ? `/api/analytics/summary?days=${days}` : `/api/links/${linkId}/analytics?days=${days}`;
  const { data, isLoading, isError } = useQuery<AnalyticsSummary>({ queryKey: [path] });
  const csv = linkId === "all" ? `/api/analytics/export.csv?days=${days}` : `/api/links/${linkId}/clicks.csv?days=${days}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Anonymous click statistics. Visitor IP addresses are never stored.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={linkId} onValueChange={setLinkId}>
            <SelectTrigger className="w-56" aria-label="Link"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All links</SelectItem>
              {links?.items.map((l) => (
                <SelectItem key={l.id} value={l.id}>/{l.shortCode}{l.title ? ` · ${l.title}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36" aria-label="Period"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((d) => <SelectItem key={d} value={String(d)}>Last {d} days</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <a href={csv} download><Download className="h-4 w-4 mr-2" /> Export CSV</a>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading analytics…</p>
      ) : isError || !data ? (
        <p className="text-destructive">Couldn't load analytics. Please refresh.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Clicks in period", data.clicksInPeriod],
              ["All-time clicks", data.totalClicks],
              ["Links", data.totalLinks],
              ["Active links", data.activeLinks],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatNumber(value as number)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clicks per day</CardTitle>
              <CardDescription>UTC days, last {days} days</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyClicks} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} minTickGap={24} fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip formatter={(v: number) => [formatNumber(v), "Clicks"]} />
                  <Area type="monotone" dataKey="clicks" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <BreakdownCard title="Countries" rows={data.countries} withFlags />
            <BreakdownCard title="Devices" rows={data.devices} />
            <BreakdownCard title="Browsers" rows={data.browsers} />
            <BreakdownCard title="Operating systems" rows={data.operatingSystems} />
            <BreakdownCard title="Referrers" rows={data.referrers} />
            {linkId === "all" && (
              <BreakdownCard
                title="Top links"
                rows={data.topLinks.map((l) => ({
                  label: `/${l.shortCode}${l.title ? ` · ${l.title}` : ""}`,
                  clicks: l.clicks,
                  percentage: data.clicksInPeriod ? Math.round((l.clicks / data.clicksInPeriod) * 1000) / 10 : 0,
                }))}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
