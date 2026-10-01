import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import type { PublicUser, RegisterInput } from "@shared/api";
import { AuthShell, FieldError } from "@/components/auth/AuthShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function SignUp() {
  const [form, setForm] = useState<RegisterInput>({ email: "", password: "", firstName: "", lastName: "" });
  const set = (key: keyof RegisterInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  const register = useMutation({
    mutationFn: () => api<PublicUser>("POST", "/api/auth/register", form),
    onSuccess: (user) => queryClient.setQueryData(["/api/auth/user"], user),
  });
  const error = register.error instanceof ApiError ? register.error : undefined;
  const fields = error?.fields ?? {};

  const submit = (e: FormEvent) => {
    e.preventDefault();
    register.mutate();
  };

  return (
    <AuthShell
      title="Create your account"
      description="Short links, QR codes and analytics, free"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="text-primary font-medium hover:underline">Sign in</Link>
        </>
      }
    >
      {error && Object.keys(fields).length === 0 && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" autoComplete="given-name" required maxLength={100} value={form.firstName} onChange={set("firstName")} />
            <FieldError message={fields.firstName} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" autoComplete="family-name" required maxLength={100} value={form.lastName} onChange={set("lastName")} />
            <FieldError message={fields.lastName} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
          <FieldError message={fields.email} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={form.password} onChange={set("password")} aria-describedby="password-hint" />
          <p id="password-hint" className="text-xs text-muted-foreground mt-1">At least 10 characters. A short phrase works well.</p>
          <FieldError message={fields.password} />
        </div>
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-xs text-center text-muted-foreground">
          By signing up you agree to the <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>
    </AuthShell>
  );
}
