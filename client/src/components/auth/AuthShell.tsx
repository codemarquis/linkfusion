import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FaApple, FaGithub, FaGoogle } from "react-icons/fa";
import { Link } from "wouter";
import type { AuthProviders } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PROVIDERS: Array<{ id: "google" | "apple" | "github"; name: string; icon: IconType }> = [
  { id: "google", name: "Google", icon: FaGoogle },
  { id: "apple", name: "Apple", icon: FaApple },
  { id: "github", name: "GitHub", icon: FaGithub },
];

export function AuthShell({ title, description, children, footer }: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { data: providers } = useQuery<AuthProviders>({ queryKey: ["/api/auth/providers"] });
  const unconfigured = providers ? PROVIDERS.filter((p) => !providers[p.id]) : [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center text-3xl font-bold text-primary mb-6">
          LinkFusion
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              {PROVIDERS.map(({ id, name, icon: Icon }) =>
                providers?.[id] ? (
                  <Button key={id} variant="outline" asChild>
                    <a href={`/api/auth/${id}`}>
                      <Icon className="mr-2 h-4 w-4" /> Continue with {name}
                    </a>
                  </Button>
                ) : (
                  <Button key={id} variant="outline" disabled title={`${name} sign-in isn't set up on this server yet`}>
                    <Icon className="mr-2 h-4 w-4" /> Continue with {name}
                  </Button>
                ),
              )}
              {unconfigured.length > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  {unconfigured.map((p) => p.name).join(", ").replace(/, ([^,]*)$/, " and $1")} sign-in{" "}
                  {unconfigured.length === 1 ? "isn't" : "aren't"} set up on this server yet.{" "}
                  <a className="underline" href="https://github.com/codemarquis/LinkFusion/blob/main/docs/oauth.md" target="_blank" rel="noreferrer">
                    How to enable
                  </a>
                </p>
              )}
            </div>
            <div className="relative text-center text-xs uppercase text-muted-foreground">
              <span className="bg-card px-2 relative z-10">or with email</span>
              <div className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            {children}
            <p className="text-center text-sm text-muted-foreground">{footer}</p>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:underline">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:underline">Terms</Link> ·{" "}
          <Link href="/support" className="hover:underline">Support</Link>
        </p>
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive mt-1" role="alert">{message}</p> : null;
}
