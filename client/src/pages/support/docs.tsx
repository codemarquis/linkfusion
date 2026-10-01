import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Endpoint = { method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; path: string; description: string };

const SECTIONS: Array<{ title: string; endpoints: Endpoint[] }> = [
  {
    title: "Authentication",
    endpoints: [
      { method: "POST", path: "/api/auth/register", description: "Create an account: { email, password, firstName, lastName }" },
      { method: "POST", path: "/api/auth/login", description: "Sign in: { email, password }. Sets the session cookie." },
      { method: "POST", path: "/api/auth/logout", description: "Sign out." },
      { method: "GET", path: "/api/auth/user", description: "The signed-in user, or 401." },
      { method: "GET", path: "/api/auth/providers", description: "Which sign-in methods are enabled." },
    ],
  },
  {
    title: "Links",
    endpoints: [
      { method: "GET", path: "/api/links?page=1&limit=20&search=", description: "Your links, newest first (max 100 per page)." },
      { method: "POST", path: "/api/links", description: "Create: { originalUrl, customAlias?, title?, expiresAt?, maxClicks?, password? }" },
      { method: "GET", path: "/api/links/:id", description: "One of your links." },
      { method: "PATCH", path: "/api/links/:id", description: "Update any of: originalUrl, title, expiresAt, maxClicks, isActive, password, removePassword." },
      { method: "DELETE", path: "/api/links/:id", description: "Delete a link and its click history." },
    ],
  },
  {
    title: "Analytics",
    endpoints: [
      { method: "GET", path: "/api/analytics/summary?days=30", description: "Totals, daily clicks and breakdowns for all your links." },
      { method: "GET", path: "/api/links/:id/analytics?days=30", description: "The same for a single link." },
      { method: "GET", path: "/api/analytics/export.csv?days=30", description: "Click log as CSV (all links)." },
      { method: "GET", path: "/api/links/:id/clicks.csv?days=30", description: "Click log as CSV (one link)." },
    ],
  },
  {
    title: "QR codes",
    endpoints: [
      { method: "GET", path: "/api/links/:id/qr?format=png|svg&download=1", description: "QR image using the link's saved style." },
      { method: "GET", path: "/api/links/:id/qr/settings", description: "Saved style (or defaults)." },
      { method: "PUT", path: "/api/links/:id/qr/settings", description: "Save style: { size 128–1024, darkColor, lightColor (#RRGGBB), errorCorrection L|M|Q|H }" },
      { method: "DELETE", path: "/api/links/:id/qr/settings", description: "Reset to the default style." },
    ],
  },
  {
    title: "Account",
    endpoints: [
      { method: "PATCH", path: "/api/profile", description: "Update { firstName, lastName }." },
      { method: "POST", path: "/api/profile/password", description: "Change password: { currentPassword, newPassword }." },
      { method: "GET", path: "/api/profile/export", description: "Download all your data as JSON." },
      { method: "DELETE", path: "/api/profile", description: 'Delete your account: { "confirm": "DELETE" }.' },
    ],
  },
];

const METHOD_COLORS: Record<Endpoint["method"], string> = {
  GET: "bg-blue-100 text-blue-800",
  POST: "bg-green-100 text-green-800",
  PATCH: "bg-amber-100 text-amber-800",
  PUT: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

export default function ApiDocs() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <Button variant="ghost" asChild><Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link></Button>
        <div>
          <h1 className="text-3xl font-bold">API reference</h1>
          <p className="text-muted-foreground mt-2">
            The JSON API behind the LinkFusion web app. Requests are authenticated with your sign-in session cookie and must come
            from the same origin (state-changing requests without a matching <code>Origin</code> header are rejected). Errors have
            the shape <code>{"{ message, code, fields? }"}</code>.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Short links</CardTitle>
            <CardDescription>Public, no authentication.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><code>GET /:code</code> redirects (302) to the destination, or shows a page if the link is unknown, disabled, expired or over its click limit.</p>
            <p>Password-protected links show a form that posts to <code>POST /:code/unlock</code>. Attempts are rate-limited.</p>
          </CardContent>
        </Card>

        {SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader><CardTitle>{section.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {section.endpoints.map((e) => (
                <div key={e.method + e.path} className="flex flex-col sm:flex-row sm:items-start gap-2">
                  <Badge className={`${METHOD_COLORS[e.method]} w-16 justify-center shrink-0`} variant="outline">{e.method}</Badge>
                  <div>
                    <code className="text-sm break-all">{e.path}</code>
                    <p className="text-sm text-muted-foreground">{e.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <p className="text-sm text-muted-foreground">
          Limits: 300 API requests per 15 minutes, 10 failed sign-ins per 15 minutes, 120 redirects per minute per IP address.
        </p>
      </div>
    </div>
  );
}
