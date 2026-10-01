import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import type { Link, UpdateLinkInput } from "@shared/api";
import { FieldError } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { toLocalInput } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";

export default function LinkEditDialog({ link, onClose }: { link: Link | null; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ originalUrl: "", title: "", expiresAt: "", maxClicks: "", isActive: true, password: "", removePassword: false });

  useEffect(() => {
    if (link) {
      setForm({
        originalUrl: link.originalUrl,
        title: link.title ?? "",
        expiresAt: toLocalInput(link.expiresAt),
        maxClicks: link.maxClicks?.toString() ?? "",
        isActive: link.isActive,
        password: "",
        removePassword: false,
      });
    }
  }, [link]);

  const save = useMutation({
    mutationFn: () => {
      const body: UpdateLinkInput = {
        originalUrl: form.originalUrl,
        title: form.title || null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        maxClicks: form.maxClicks ? Number(form.maxClicks) : null,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
        ...(form.removePassword ? { removePassword: true as const } : {}),
      };
      // An unchanged, already-past expiry would fail validation; only send it if it changed.
      if (link && toLocalInput(link.expiresAt) === form.expiresAt) delete body.expiresAt;
      return api<Link>("PATCH", `/api/links/${link!.id}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/") });
      toast({ title: "Link updated" });
      onClose();
    },
  });
  const error = save.error instanceof ApiError ? save.error : undefined;
  const fields = error?.fields ?? {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open={Boolean(link)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit link</DialogTitle>
          <DialogDescription className="font-mono">{link?.shortUrl}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="edit-url">Destination</Label>
            <Input id="edit-url" type="url" value={form.originalUrl} onChange={(e) => setForm({ ...form, originalUrl: e.target.value })} />
            <FieldError message={fields.originalUrl} />
          </div>
          <div>
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-expires">Expires</Label>
              <Input id="edit-expires" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              <FieldError message={fields.expiresAt} />
            </div>
            <div>
              <Label htmlFor="edit-max">Click limit</Label>
              <Input id="edit-max" type="number" min={1} placeholder="Unlimited" value={form.maxClicks} onChange={(e) => setForm({ ...form, maxClicks: e.target.value })} />
              <FieldError message={fields.maxClicks} />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-password">{link?.hasPassword ? "New password" : "Password protect"}</Label>
            <Input id="edit-password" type="password" autoComplete="new-password" placeholder={link?.hasPassword ? "Leave blank to keep the current password" : "Optional"} value={form.password} disabled={form.removePassword} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <FieldError message={fields.password} />
            {link?.hasPassword && (
              <label className="flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={form.removePassword} onChange={(e) => setForm({ ...form, removePassword: e.target.checked, password: "" })} />
                Remove password protection
              </label>
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="edit-active">Active</Label>
              <p className="text-xs text-muted-foreground">Disabled links show visitors a "link disabled" page.</p>
            </div>
            <Switch id="edit-active" checked={form.isActive} onCheckedChange={(isActive) => setForm({ ...form, isActive })} />
          </div>
          {error && Object.keys(fields).length === 0 && <p className="text-sm text-destructive" role="alert">{error.message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
