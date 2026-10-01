import { useMutation } from "@tanstack/react-query";
import { Download, KeyRound, Trash2, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { PublicUser } from "@shared/api";
import { FieldError } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (user) setNames({ firstName: user.firstName ?? "", lastName: user.lastName ?? "" });
  }, [user]);

  const saveNames = useMutation({
    mutationFn: () => api<PublicUser>("PATCH", "/api/profile", names),
    onSuccess: (u) => {
      queryClient.setQueryData(["/api/auth/user"], u);
      toast({ title: "Profile updated" });
    },
  });
  const changePw = useMutation({
    mutationFn: () => api("POST", "/api/profile/password", user?.hasPassword ? pw : { newPassword: pw.newPassword }),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: user?.hasPassword ? "Password changed" : "Password set" });
    },
  });
  const deleteAccount = useMutation({
    mutationFn: () => api("DELETE", "/api/profile", { confirm }),
    onSuccess: () => {
      queryClient.clear();
      window.location.assign("/");
    },
  });

  const fieldsOf = (err: unknown) => (err instanceof ApiError ? err.fields : {});
  const messageOf = (err: unknown) => (err instanceof ApiError && !Object.keys(err.fields).length ? err.message : "");

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">{user.email} · member since {formatDate(user.createdAt)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" /> Your details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); saveNames.mutate(); }}>
            <div className="grid sm:grid-cols-2 gap-4">
              {(["firstName", "lastName"] as const).map((key) => (
                <div key={key}>
                  <Label htmlFor={key}>{key === "firstName" ? "First name" : "Last name"}</Label>
                  <Input id={key} maxLength={100} value={names[key]} onChange={(e) => setNames({ ...names, [key]: e.target.value })} />
                  <FieldError message={fieldsOf(saveNames.error)[key]} />
                </div>
              ))}
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            {user.providers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Connected sign-in: {user.providers.map((p) => <Badge key={p} variant="secondary" className="ml-1 capitalize">{p}</Badge>)}
              </p>
            )}
            <Button type="submit" disabled={saveNames.isPending}>{saveNames.isPending ? "Saving…" : "Save"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> {user.hasPassword ? "Change password" : "Set a password"}</CardTitle>
          {!user.hasPassword && <CardDescription>You sign in with {user.providers.join(" / ") || "a provider"}. Set a password to also sign in with email.</CardDescription>}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); changePw.mutate(); }}>
            {user.hasPassword && (
              <div>
                <Label htmlFor="currentPassword">Current password</Label>
                <Input id="currentPassword" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
                <FieldError message={fieldsOf(changePw.error).currentPassword} />
              </div>
            )}
            <div>
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              <FieldError message={fieldsOf(changePw.error).newPassword} />
            </div>
            {messageOf(changePw.error) && <p className="text-sm text-destructive">{messageOf(changePw.error)}</p>}
            <Button type="submit" disabled={changePw.isPending || !pw.newPassword}>{changePw.isPending ? "Saving…" : "Update password"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Your data</CardTitle>
          <CardDescription>Download everything we store about you (profile and links) as JSON.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild><a href="/api/profile/export" download>Download my data</a></Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> Delete account</CardTitle>
          <CardDescription>Permanently deletes your account, all short links (they stop working) and their click history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="confirm">Type <span className="font-mono font-semibold">DELETE</span> to confirm</Label>
          <Input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          {deleteAccount.error && <p className="text-sm text-destructive">{(deleteAccount.error as Error).message}</p>}
          <Button variant="destructive" disabled={confirm !== "DELETE" || deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
            {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
