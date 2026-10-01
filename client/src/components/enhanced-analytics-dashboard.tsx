import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Link2, MousePointerClick, TrendingUp, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Link } from "wouter";
import type { AnalyticsSummary } from "@shared/api";
import { RecentActivity } from "@/components/analytics/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

/** Percentage change of the last 7 days against the 7 days before. */
function weekOverWeek(daily: AnalyticsSummary["dailyClicks"]): number | null {
  const sum = (days: typeof daily) => days.reduce((n, d) => n + d.clicks, 0);
  const last = sum(daily.slice(-7));
  const previous = sum(daily.slice(-14, -7));
  return previous ? Math.round(((last - previous) / previous) * 100) : null;
}

export default function EnhancedAnalyticsDashboard() {
  const { data } = useQuery<AnalyticsSummary>({ queryKey: ["/api/analytics/summary?days=30"] });
  const last7 = data?.dailyClicks.slice(-7).reduce((n, d) => n + d.clicks, 0);
  const trend = data ? weekOverWeek(data.dailyClicks) : null;

  const stats = [
    { label: "Total links", value: data?.totalLinks, icon: Link2 },
    { label: "Active links", value: data?.activeLinks, icon: Zap },
    { label: "All-time clicks", value: data?.totalClicks, icon: MousePointerClick },
    { label: "Clicks, last 7 days", value: last7, icon: TrendingUp, trend },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, trend: change }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold tabular-nums">{value === undefined ? "—" : formatNumber(value)}</p>
                {change !== undefined && change !== null && (
                  <p className={`mt-1 flex items-center text-xs ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(change)}% vs previous week
                  </p>
                )}
              </div>
              <Icon className="h-6 w-6 text-primary/70" aria-hidden="true" />
            </CardContent>
          </Card>
        ))}
      </div>

      {data && data.totalClicks > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Clicks, last 30 days</CardTitle>
                <CardDescription>{formatNumber(data.clicksInPeriod)} clicks</CardDescription>
              </div>
              <Link href="/analytics" className="text-sm text-primary hover:underline">Full analytics →</Link>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.dailyClicks} margin={{ left: 0, right: 0, top: 8 }}>
                  <defs>
                    <linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} minTickGap={32} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => [formatNumber(v), "Clicks"]} />
                  <Area type="monotone" dataKey="clicks" stroke="var(--primary)" strokeWidth={2} fill="url(#dash-fill)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <RecentActivity clicks={data.recentClicks.slice(0, 5)} />
        </div>
      )}
    </div>
  );
}
