import { BarChart3, Clock, Link2, Lock, QrCode, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { icon: Link2, title: "Short links your way", text: "Random or custom aliases, titles, and one-click copy. Edit the destination any time." },
  { icon: Clock, title: "Expiry & click limits", text: "Links can switch off at a date or after a number of clicks, or be disabled instantly." },
  { icon: Lock, title: "Password protection", text: "Visitors enter a password before being redirected. Passwords are stored hashed." },
  { icon: QrCode, title: "QR codes", text: "Every link has a QR code. Pick colors, size and error correction; download PNG or SVG." },
  { icon: BarChart3, title: "Click analytics", text: "Daily clicks, countries, devices, browsers and referrers, with CSV export." },
  { icon: ShieldCheck, title: "Private by design", text: "Visitor IP addresses are never stored; countries are resolved on our own server." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">LinkFusion</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link href="/signin">Sign in</Link></Button>
            <Button asChild><Link href="/signup">Sign up</Link></Button>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">Short links, QR codes and honest analytics</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Create links you control, share them as QR codes, and see how they perform without tracking your visitors.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild><Link href="/signup">Get started free</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/signin">Sign in</Link></Button>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Features">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title}>
              <CardContent className="p-6">
                <div className="bg-primary/10 text-primary rounded-lg p-3 inline-flex mb-4"><Icon className="h-6 w-6" aria-hidden="true" /></div>
                <h2 className="text-lg font-semibold mb-2">{title}</h2>
                <p className="text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} LinkFusion</p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary">Privacy</Link>
            <Link href="/terms" className="hover:text-primary">Terms</Link>
            <Link href="/docs" className="hover:text-primary">API</Link>
            <Link href="/support" className="hover:text-primary">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
