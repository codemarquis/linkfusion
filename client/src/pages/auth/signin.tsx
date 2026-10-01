import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import type { PublicUser } from "@shared/api";
import { AuthShell, FieldError } from "@/components/auth/AuthShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

const OAUTH_ERRORS: Record<string, string> = {
  oauth: "Sign-in with that provider failed. Please try again.",
  unverified: "That account doesn't have a verified email address. Verify it with the provider, or sign up with email.",
};

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const oauthError = OAUTH_ERRORS[new URLSearchParams(window.location.search).get("error") ?? ""];

  const login = useMutation({
    mutationFn: () => api<PublicUser>("POST", "/api/auth/login", { email, password }),
    onSuccess: (user) => queryClient.setQueryData(["/api/auth/user"], user),
  });
  const error = login.error instanceof ApiError ? login.error : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage your links"
      footer={
        <>
          New to LinkFusion?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
        </>
      }
    >
      {(oauthError || (error && !error.fields.email)) && (
        <Alert variant="destructive">
          <AlertDescription>{oauthError ?? error?.message}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FieldError message={error?.fields.email} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
