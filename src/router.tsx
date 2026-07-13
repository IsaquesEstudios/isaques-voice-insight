import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data instantly on navigation, then refetch in background
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
        placeholderData: (previousData: unknown) => previousData,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
