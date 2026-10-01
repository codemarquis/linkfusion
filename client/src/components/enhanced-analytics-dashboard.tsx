import { useQuery } from "@tanstack/react-query";
import { Link2, MousePointerClick, TrendingUp, Zap } from "lucide-react";
import type { AnalyticsSummary } from "@shared/api";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export default function EnhancedAnalyticsDashboard() {
  const { data } = useQuery<AnalyticsSummary>({ queryKey: ["/api/analytics/summary?days=7"] });
  const stats = [
    { label: "Total links", value: data?.totalLinks, icon: Link2 },
    { label: "Active links", value: data?.activeLinks, icon: Zap },
    { label: "All-time clicks", value: data?.totalClicks, icon: MousePointerClick },
    { label: "Clicks, last 7 days", value: data?.clicksInPeriod, icon: TrendingUp },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value === undefined ? "—" : formatNumber(value)}</p>
            </div>
            <Icon className="h-6 w-6 text-primary/70" aria-hidden="true" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
