import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AnalyticsSummary, Link, Paginated, PublicUser, SystemStats } from "@shared/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";

const PAGE = 20;

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [linkPage, setLinkPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const { data: stats } = useQuery<SystemStats & { analytics: AnalyticsSummary }>({ queryKey: ["/api/admin/stats"] });
  const { data: links } = useQuery<Paginated<Link>>({ queryKey: [`/api/admin/links?page=${linkPage}&limit=${PAGE}`] });
  const { data: users } = useQuery<Paginated<PublicUser>>({ queryKey: [`/api/admin/users?page=${userPage}&limit=${PAGE}`] });
  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/admin") });
  const fail = (err: Error) => toast({ title: "Action failed", description: err.message, variant: "destructive" });

  const moderate = useMutation({
    mutationFn: (l: Link) => api("PATCH", `/api/admin/links/${l.id}`, { isActive: !l.isActive }),
    onSuccess: refresh,
    onError: fail,
  });
  const setAdmin = useMutation({
    mutationFn: (u: PublicUser) => api("PATCH", `/api/admin/users/${u.id}`, { isAdmin: !u.isAdmin }),
    onSuccess: refresh,
    onError: fail,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Administration</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Users", stats?.totalUsers],
          ["Links", stats?.totalLinks],
          ["Clicks (all time)", stats?.totalClicks],
          ["Clicks (7 days)", stats?.clicksLast7Days],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold tabular-nums">{value === undefined ? "—" : formatNumber(value as number)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="links">
        <TabsList>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="links">
          <Card>
            <CardHeader><CardTitle className="text-base">All links</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Short link</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links?.items.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">/{l.shortCode}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={l.originalUrl}>{l.originalUrl}</TableCell>
                      <TableCell className="text-sm">{l.owner?.email}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(l.clickCount)}</TableCell>
                      <TableCell>
                        <Switch checked={l.isActive} aria-label={l.isActive ? "Disable link" : "Enable link"} onCheckedChange={() => moderate.mutate(l)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {links && !links.items.length && <p className="text-sm text-muted-foreground py-6 text-center">No links yet.</p>}
              {links && <Pager page={linkPage} total={links.total} onPage={setLinkPage} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-base">Users</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Sign-in</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.items.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="text-sm">{[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                      <TableCell className="space-x-1">
                        {u.hasPassword && <Badge variant="outline">email</Badge>}
                        {u.providers.map((p) => <Badge key={p} variant="secondary" className="capitalize">{p}</Badge>)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <Switch checked={u.isAdmin} disabled={u.id === me?.id} aria-label="Administrator" onCheckedChange={() => setAdmin.mutate(u)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {users && <Pager page={userPage} total={users.total} onPage={setUserPage} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
