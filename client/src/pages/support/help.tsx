import { ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { PublicPage, REPO_URL } from "@/components/layout/PublicPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const FAQS = [
  { q: "How do I shorten a link?", a: "Paste a long URL into “Shorten a link” on your dashboard and press Shorten. Under “More options” you can choose a custom alias, a title, an expiry date, a click limit and a password." },
  { q: "Can I change where a link goes?", a: "Yes. Use the pencil icon in your links table to edit the destination, title, expiry, click limit or password, or to disable the link." },
  { q: "How do password-protected links work?", a: "Visitors see a password form before they're redirected. The password is never put in the URL, is stored hashed, and attempts are rate-limited." },
  { q: "What happens when a link expires or reaches its limit?", a: "Visitors see a short page explaining that the link is no longer available. You can raise the limit or change the expiry at any time to reactivate it." },
  { q: "What do the analytics show?", a: "Clicks per day, countries, devices, browsers, operating systems, referring websites and your top links, for 7 to 365 days. Export everything as CSV from the Analytics page or per link." },
  { q: "Do you track visitors?", a: "No. Visitor IP addresses are never stored; the country is looked up on our own server and the IP is discarded. Visitors get no cookies, and link-preview bots aren't counted." },
  { q: "How do I get a QR code?", a: "Open QR Codes (or the QR icon next to a link), pick colors, size and error correction, save the style, then download PNG or SVG." },
  { q: "How do I delete my account?", a: "Go to Profile → Delete account and type DELETE to confirm. Your links stop working and all data is removed immediately. You can download your data first." },
];

export default function Support() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = FAQS.filter((f) => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));

  return (
    <PublicPage title="Help" subtitle="Answers to common questions about LinkFusion.">
      <div className="not-prose space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input id="faq-search" name="faq-search" aria-label="Search help" placeholder="Search help…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {results.length === 0 && <p className="text-muted-foreground">No answers match “{query}”.</p>}
        {results.map((f) => (
          <Card key={f.q}>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-1">{f.q}</h2>
              <p className="text-muted-foreground">{f.a}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Still stuck, or found a bug?</h2>
              <p className="text-muted-foreground text-sm">Open an issue on GitHub. Security problems: please <a href={`${REPO_URL}/security/policy`} className="underline" target="_blank" rel="noopener noreferrer">report them privately</a>.</p>
            </div>
            <Button asChild>
              <a href={`${REPO_URL}/issues/new/choose`} target="_blank" rel="noopener noreferrer">
                Open an issue <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicPage>
  );
}
