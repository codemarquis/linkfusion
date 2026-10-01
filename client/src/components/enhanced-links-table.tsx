import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, Copy, Download, ExternalLink, Lock, Pencil, QrCode, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link as RouterLink } from "wouter";
import type { Link, Paginated } from "@shared/api";
import LinkEditDialog from "@/components/link-edit-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";

const PAGE_SIZE = 10;

function status(link: Link): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!link.isActive) return { label: "Disabled", variant: "secondary" };
  if (link.expiresAt && new Date(link.expiresAt) <= new Date()) return { label: "Expired", variant: "destructive" };
  if (link.maxClicks !== null && link.clickCount >= link.maxClicks) return { label: "Limit reached", variant: "destructive" };
  return { label: "Active", variant: "default" };
}

export default function EnhancedLinksTable() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Link | null>(null);
  const [deleting, setDeleting] = useState<Link | null>(null);

  const query = `/api/links?page=${page}&limit=${PAGE_SIZE}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const { data, isLoading, isError } = useQuery<Paginated<Link>>({ queryKey: [query] });
  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/") });

  const toggle = useMutation({
    mutationFn: (link: Link) => api<Link>("PATCH", `/api/links/${link.id}`, { isActive: !link.isActive }),
    onSuccess: (link) => {
      refresh();
      toast({ title: link.isActive ? "Link enabled" : "Link disabled" });
    },
    onError: (err: Error) => toast({ title: "Couldn't update link", description: err.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (link: Link) => api("DELETE", `/api/links/${link.id}`),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      toast({ title: "Link deleted" });
    },
    onError: (err: Error) => toast({ title: "Couldn't delete link", description: err.message, variant: "destructive" }),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: text });
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <CardTitle>Your links {data ? <span className="text-muted-foreground font-normal">({formatNumber(data.total)})</span> : null}</CardTitle>
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="link-search"
            name="search"
            aria-label="Search links"
            placeholder="Search by alias, URL or title"
            className="pl-8"
            value={search}
            maxLength={100}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading links…</p>
        ) : isError ? (
          <p className="text-sm text-destructive py-8 text-center">Couldn't load your links. Please refresh.</p>
        ) : !data?.items.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {search ? "No links match your search." : "No links yet. Shorten your first URL above."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Short link</TableHead>
                  <TableHead className="hidden md:table-cell">Destination</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((link) => {
                  const s = status(link);
                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-primary hover:underline">
                            /{link.shortCode}
                          </a>
                          {link.hasPassword && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Password protected" />}
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Copy short link" onClick={() => copy(link.shortUrl)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {link.title && <div className="text-xs text-muted-foreground truncate max-w-[16rem]">{link.title}</div>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs">
                        <a href={link.originalUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground truncate flex items-center gap-1">
                          <span className="truncate">{link.originalUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(link.clickCount)}
                        {link.maxClicks !== null && <span className="text-muted-foreground"> / {formatNumber(link.maxClicks)}</span>}
                      </TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(link.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Switch
                            checked={link.isActive}
                            aria-label={link.isActive ? "Disable link" : "Enable link"}
                            disabled={toggle.isPending}
                            onCheckedChange={() => toggle.mutate(link)}
                          />
                          <Button variant="ghost" size="icon" aria-label="Analytics" asChild>
                            <RouterLink href={`/analytics?link=${link.id}`}><BarChart3 className="h-4 w-4" /></RouterLink>
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="QR code" asChild>
                            <RouterLink href={`/qr-codes?link=${link.id}`}><QrCode className="h-4 w-4" /></RouterLink>
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Download clicks as CSV" asChild>
                            <a href={`/api/links/${link.id}/clicks.csv?days=365`} download><Download className="h-4 w-4" /></a>
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(link)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(link)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>

      <LinkEditDialog link={editing} onClose={() => setEditing(null)} />
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete /{deleting?.shortCode}?</AlertDialogTitle>
            <AlertDialogDescription>The short link stops working immediately and its click history is deleted. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
