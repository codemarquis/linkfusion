import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@shared/api";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export function useAuth() {
  const { data, isLoading } = useQuery<PublicUser | null>({ queryKey: ["/api/auth/user"] });
  return { user: data ?? null, isLoading, isAuthenticated: Boolean(data) };
}

export async function signOut() {
  await api("POST", "/api/auth/logout").catch(() => undefined);
  queryClient.clear();
  window.location.assign("/");
}
