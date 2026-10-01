import EnhancedAnalyticsDashboard from "@/components/enhanced-analytics-dashboard";
import EnhancedLinksTable from "@/components/enhanced-links-table";
import UrlShortenerForm from "@/components/url-shortener-form";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back{user?.firstName ? `, ${user.firstName}` : ""}</h1>
        <p className="text-muted-foreground">Create and manage your short links.</p>
      </div>
      <EnhancedAnalyticsDashboard />
      <UrlShortenerForm />
      <EnhancedLinksTable />
    </div>
  );
}
