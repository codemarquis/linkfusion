import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { api, isUnauthorized } from "./api";

/** Query keys are API paths, e.g. ["/api/links?page=2"]. A 401 resolves to null. */
const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  try {
    return await api("GET", queryKey.join("/"));
  } catch (err) {
    if (isUnauthorized(err)) return null;
    throw err;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (count, err) => !isUnauthorized(err) && count < 1,
    },
    mutations: { retry: false },
  },
});
