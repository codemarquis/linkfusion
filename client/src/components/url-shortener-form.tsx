import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Copy, Link2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { CreateLinkInput, Link } from "@shared/api";
import { FieldError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

const EMPTY = { originalUrl: "", customAlias: "", title: "", expiresAt: "", maxClicks: "", password: "" };

export default function UrlShortenerForm() {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [created, setCreated] = useState<Link | null>(null);
  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const create = useMutation({
    mutationFn: () => {
      const body: CreateLinkInput = {
        originalUrl: form.originalUrl,
        customAlias: form.customAlias || undefined,
        title: form.title || undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        maxClicks: form.maxClicks ? Number(form.maxClicks) : undefined,
        password: form.password || undefined,
      };
      return api<Link>("POST", "/api/links", body);
    },
    onSuccess: (link) => {
      setCreated(link);
      setForm(EMPTY);
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/links") || String(q.queryKey[0]).startsWith("/api/analytics") });
    },
  });
  const error = create.error instanceof ApiError ? create.error : undefined;
  const fields = error?.fields ?? {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: text });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Shorten a link</CardTitle>
        <CardDescription>Paste a long URL. Optional settings let you pick an alias, set an expiry, cap clicks or add a password.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Label htmlFor="originalUrl" className="sr-only">Long URL</Label>
              <Input id="originalUrl" type="url" inputMode="url" placeholder="https://example.com/a/very/long/link" required value={form.originalUrl} onChange={set("originalUrl")} />
              <FieldError message={fields.originalUrl} />
            </div>
            <Button type="submit" disabled={create.isPending || !form.originalUrl}>
              {create.isPending ? "Shortening…" : "Shorten"}
            </Button>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4" /> More options
            </CollapsibleTrigger>
            <CollapsibleContent className="grid gap-4 sm:grid-cols-2 pt-4">
              <div>
                <Label htmlFor="customAlias">Custom alias</Label>
                <Input id="customAlias" placeholder="spring-sale" maxLength={32} value={form.customAlias} onChange={set("customAlias")} />
                <FieldError message={fields.customAlias} />
              </div>
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="For your own reference" maxLength={200} value={form.title} onChange={set("title")} />
                <FieldError message={fields.title} />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires</Label>
                <Input id="expiresAt" type="datetime-local" value={form.expiresAt} onChange={set("expiresAt")} />
                <FieldError message={fields.expiresAt} />
              </div>
              <div>
                <Label htmlFor="maxClicks">Click limit</Label>
                <Input id="maxClicks" type="number" min={1} placeholder="Unlimited" value={form.maxClicks} onChange={set("maxClicks")} />
                <FieldError message={fields.maxClicks} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="linkPassword">Password protect</Label>
                <Input id="linkPassword" type="password" autoComplete="new-password" placeholder="Visitors must enter this to continue" value={form.password} onChange={set("password")} />
                <FieldError message={fields.password} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {error && Object.keys(fields).length === 0 && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
        </form>

        {created && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-3" role="status">
            <a href={created.shortUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-green-800 dark:text-green-300 truncate">
              {created.shortUrl}
            </a>
            <Button size="sm" variant="outline" onClick={() => copy(created.shortUrl)}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
